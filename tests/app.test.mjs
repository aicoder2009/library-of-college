// End-to-end checks for app.html's sync engine, Essays page, Recently deleted,
// merge, import/export and rendering, run against a fake server.
//   node tests/app.test.mjs            (or pass a path to another app.html)
import { makeServer, makeDevice } from "./harness.mjs";

let pass = 0, fail = 0;
const ok = (cond, msg) => { if(cond){ pass++; } else { fail++; console.log("  FAIL:", msg); } };
const section = s => console.log("\n# " + s);
const bodies = s => (s.entries || []).map(e => e.body).sort();

// Entry factory executed inside a device (uses its newId + persist).
const add = (dev, body, cats = [0]) => dev.run(`(() => { const en = { id: newId(), title: ${JSON.stringify(body)}, body: ${JSON.stringify(body)},
  cats: ${JSON.stringify(cats)}, pinned: false, tags: [], createdAt: Date.now(), updatedAt: Date.now() };
  state.entries.unshift(en); persist(); return en.id; })()`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
section("1. basic sync: first device writes rev 1, second device boots into it");
{
  const srv = makeServer();
  const A = makeDevice("A", srv);
  await A.signIn();
  ok(A.run("isLocked()") === false, "lock screen dropped after boot");
  add(A, "first story");
  await A.settle();
  ok(srv.state?.rev === 1 && srv.state.entries.length === 1, "server has 1 entry at rev 1");
  ok(A.run("dirty") === false && A.run("state.rev") === 1, "A clean at rev 1");
  ok(!("_dirty" in srv.state), "_dirty never reaches the server");
  const B = makeDevice("B", srv);
  await B.signIn();
  ok(B.run("state.entries.length") === 1 && B.run("state.rev") === 1, "B boots into server state");
}

// ---------------------------------------------------------------------------
section("2. offline phone dumps twice, laptop once — nothing lost");
{
  const srv = makeServer();
  const phoneStore = new Map();
  const phone = makeDevice("phone", srv, { storage: phoneStore });
  await phone.signIn();
  add(phone, "seed"); await phone.settle();
  const laptop = makeDevice("laptop", srv);
  await laptop.signIn();
  phone.online = false;
  add(phone, "phone story 1");
  add(phone, "phone story 2");
  await phone.settle();
  ok(phone.run("dirty") === true && phone.run("syncState") === "offline", "phone holds unsynced edits offline");
  add(laptop, "laptop story"); await laptop.settle();
  ok(srv.state.rev === 2, "laptop pushed rev 2");
  // phone reopens (fresh page load from its own cache) once back online
  const phone2 = makeDevice("phone-reopen", srv, { storage: phoneStore });
  await phone2.signIn();
  const b = bodies(srv.state);
  ok(b.includes("phone story 1") && b.includes("phone story 2") && b.includes("laptop story") && b.includes("seed"),
    "server ends with all 4 stories: " + b.join(" | "));
  ok(phone2.run("dirty") === false, "phone clean after recovery");
  ok(phone2.toasts.some(t => /Recovered unsynced/.test(t)), "recovery toast shown");
}

// ---------------------------------------------------------------------------
section("3. stale device with MORE edits can no longer overwrite the server");
{
  const srv = makeServer();
  const A = makeDevice("A", srv); await A.signIn();
  add(A, "base"); await A.settle();
  const B = makeDevice("B", srv); await B.signIn();
  add(B, "B edit"); await B.settle();           // server rev 2
  // A never pulled; makes 3 quick edits then syncs once
  add(A, "A1"); add(A, "A2"); add(A, "A3");
  await A.settle();
  const b = bodies(srv.state);
  ok(b.includes("B edit") && ["A1", "A2", "A3"].every(x => b.includes(x)), "B's edit survives A's push: " + b.join(" | "));
  ok(srv.conflicts >= 1, "A got a 409 and merged");
}

// ---------------------------------------------------------------------------
section("4. deletes travel as tombstones — a stale device can't resurrect them");
{
  const srv = makeServer();
  const A = makeDevice("A", srv); await A.signIn();
  const x = add(A, "doomed"); add(A, "keeper"); await A.settle();
  const B = makeDevice("B", srv); await B.signIn();
  A.run(`trashEntries([${JSON.stringify(x)}]); persist();`); await A.settle();
  ok(!srv.state.entries.some(e => e.id === x), "server dropped the entry");
  ok(srv.state.trash.some(e => e.id === x) && srv.state.deleted[x], "server has it in trash + tombstone");
  // B still has it; B edits something else → 409 → merge must honour the delete
  add(B, "B new"); await B.settle();
  ok(!srv.state.entries.some(e => e.id === x), "stale B did not resurrect it");
  ok(B.run(`state.entries.some(e => e.id === ${JSON.stringify(x)})`) === false, "B dropped it locally too");
  ok(B.run(`state.trash.some(e => e.id === ${JSON.stringify(x)})`) === true, "B sees it in Recently deleted");
  ok(bodies(srv.state).includes("B new") && bodies(srv.state).includes("keeper"), "other entries intact");
}

// ---------------------------------------------------------------------------
section("5. an edit made after the delete wins (offline editor)");
{
  const srv = makeServer();
  const A = makeDevice("A", srv); await A.signIn();
  const x = add(A, "contested"); await A.settle();
  const B = makeDevice("B", srv); await B.signIn();
  A.run(`trashEntries([${JSON.stringify(x)}]); persist();`); await A.settle();
  await sleep(3);
  B.online = false;
  B.run(`(() => { const e = byId(${JSON.stringify(x)}); e.body = "edited later"; e.updatedAt = Date.now(); persist(); })()`);
  await B.settle();
  B.online = true;
  B.run("push()"); await B.settle();
  const e = srv.state.entries.find(e => e.id === x);
  ok(e && e.body === "edited later", "edited copy is back on the server");
  ok(!srv.state.deleted[x] && !srv.state.trash.some(t => t.id === x), "tombstone + trash copy cleared");
}

// ---------------------------------------------------------------------------
section("6. restore from Recently deleted beats the tombstone on other devices");
{
  const srv = makeServer();
  const A = makeDevice("A", srv); await A.signIn();
  const x = add(A, "oops"); await A.settle();
  const B = makeDevice("B", srv); await B.signIn();
  B.run(`trashEntries([${JSON.stringify(x)}]); persist();`); await B.settle();
  A.run("lastPull = 0"); await A.visible(); // A pulls (not dirty, server ahead)
  ok(A.run(`state.trash.some(t => t.id === ${JSON.stringify(x)})`), "A picked up the delete on focus");
  await sleep(3);
  A.run(`restoreEntries(state.trash.filter(t => t.id === ${JSON.stringify(x)})); persist();`); await A.settle();
  add(B, "B other"); await B.settle(); // B still has tombstone locally → 409 → merge
  ok(srv.state.entries.some(e => e.id === x), "restored entry survives B's merge");
  ok(!srv.state.deleted[x], "tombstone gone");
}

// ---------------------------------------------------------------------------
section("7. prompts: newest edit wins, removals stick");
{
  const srv = makeServer();
  const A = makeDevice("A", srv); await A.signIn();
  A.run(`state.prompts = [{ id: "p1", q: "Why us?", sch: "Stanford", createdAt: 1 }, { id: "p2", q: "Old prompt", sch: "MIT", createdAt: 1 }]; persist();`);
  await A.settle();
  const B = makeDevice("B", srv); await B.signIn();
  await sleep(3);
  A.run(`(() => { const p = promptById("p1"); p.due = "2027-01-05"; p.updatedAt = Date.now(); persist(); })()`);
  await A.settle();
  B.run(`removePrompt(promptById("p2"))`); await B.settle();
  const ps = srv.state.prompts;
  ok(ps.length === 1 && ps[0].id === "p1" && ps[0].due === "2027-01-05", "p1 keeps A's deadline, p2 stays removed");
  // A (stale on p2) edits p1 again → merge must not bring p2 back
  await sleep(3);
  A.run(`(() => { const p = promptById("p1"); p.status = "drafting"; p.updatedAt = Date.now(); persist(); })()`);
  await A.settle();
  ok(srv.state.prompts.length === 1 && srv.state.prompts[0].status === "drafting", "p2 not resurrected by stale A");
}

// ---------------------------------------------------------------------------
section("8. migration: caches written before the dirty flag");
{
  const srv = makeServer();
  srv.state = { entries: [{ id: "s1", title: "server", body: "server", cats: [0], tags: [], createdAt: 1, updatedAt: 1 }], prompts: [], rev: 40, backupRev: 0 };
  // old cache with a local-only entry and an old-scheme rev ahead of the server's
  const st = new Map([["liboc-v1:u1", JSON.stringify({ entries: [
    { id: "s1", title: "server", body: "server", cats: [0], tags: [], createdAt: 1, updatedAt: 1 },
    { id: "l1", title: "local", body: "local only", cats: [0], tags: [], createdAt: 2, updatedAt: 2 }], rev: 45, backupRev: 0 })]]);
  const A = makeDevice("A", srv, { storage: st }); await A.signIn();
  ok(srv.state.entries.some(e => e.id === "l1") && srv.state.rev === 41, "old cache ahead → merged + pushed as rev 41");
  ok(JSON.parse(st.get("liboc-v1:u1"))._dirty === false, "cache now carries the flag");
  // old cache behind the server → adopt the server copy (old behaviour)
  const st2 = new Map([["liboc-v1:u1", JSON.stringify({ entries: [
    { id: "gone", title: "deleted elsewhere", body: "x", cats: [0], tags: [], createdAt: 3, updatedAt: 3 }], rev: 10, backupRev: 0 })]]);
  const B = makeDevice("B", srv, { storage: st2 }); await B.signIn();
  ok(!B.run(`state.entries.some(e => e.id === "gone")`), "old cache behind → server wins, nothing resurrected");
  // old cache, offline at boot, then an edit: must merge before claiming a rev
  const st3 = new Map([["liboc-v1:u1", JSON.stringify({ entries: [], rev: 999, backupRev: 0 })]]);
  const C = makeDevice("C", srv, { storage: st3 });
  C.online = false; await C.signIn();
  add(C, "made offline");
  C.online = true; C.run("push()"); await C.settle();
  ok(srv.state.entries.some(e => e.id === "l1") && bodies(srv.state).includes("made offline"),
    "offline-booted old cache merged instead of overwriting (rev " + srv.state.rev + ")");
  ok(srv.state.rev < 999, "did not jump to the stale cache's rev");
}

// ---------------------------------------------------------------------------
section("9. merge in the bulk bar + undo; prompt picks follow");
{
  const srv = makeServer();
  const A = makeDevice("A", srv); await A.signIn();
  const a = add(A, "dup story"); await sleep(2);
  const b = add(A, "dup story extra detail", [1]); await sleep(2);
  const c = add(A, "dup story", [2]);
  A.run(`state.entries.find(e => e.id === ${JSON.stringify(b)}).tags = ["UC"]; persist();`);
  A.run(`state.prompts = [{ id: "p", q: "Q", sch: "UC", picks: [${JSON.stringify(c)}], createdAt: 1, updatedAt: 1 }]; persist();`);
  await A.settle();
  A.run(`selected = new Set([${[a, b, c].map(x => JSON.stringify(x)).join(",")}]); render();`);
  ok(A.els.get("mergeSel").hidden === false, "Merge button shows for 2+ selected");
  A.run(`document.getElementById("mergeSel").onclick()`);
  await A.settle();
  const s = srv.state;
  ok(s.entries.length === 1 && s.entries[0].id === a, "one entry left, the oldest");
  ok(s.entries[0].body === "dup story\n\ndup story extra detail", "bodies joined, exact duplicate dropped");
  ok(JSON.stringify(s.entries[0].cats) === "[0,1,2]" && s.entries[0].tags.includes("UC"), "cats + tags combined");
  ok(s.trash.length === 2, "the others went to Recently deleted");
  ok(JSON.stringify(s.prompts[0].picks) === JSON.stringify([a]), "prompt pick re-pointed to the merged entry");
  // undo via the toast button
  ok(A.toasts.some(t => /Merged 3 entries/.test(t)), "merge toast");
  A.run(`document.getElementById("tact").onclick()`); // Undo
  await A.settle();
  const u = srv.state;
  ok(u.entries.length === 3 && u.trash.length === 0, "undo brings all three back");
  ok(u.entries.find(e => e.id === a).body === "dup story" && JSON.stringify(u.entries.find(e => e.id === a).cats) === "[0]", "base entry restored as it was");
  ok(JSON.stringify(u.prompts[0].picks) === JSON.stringify([c]), "prompt pick restored");
  ok(!Object.keys(u.deleted).length, "no tombstones left behind");
}

// ---------------------------------------------------------------------------
section("10. import: old array backups and new {entries, prompts} backups");
{
  const srv = makeServer();
  const A = makeDevice("A", srv); await A.signIn();
  const doImport = text => A.run(`(() => {
    const realFR = globalThis.FileReader;
    globalThis.FileReader = function(){ this.readAsText = () => { this.result = ${JSON.stringify(text)}; this.onload(); }; };
    document.getElementById("importFile").onchange({ target: { files: [{}], value: "x" } });
    globalThis.FileReader = realFR;
  })()`);
  doImport(JSON.stringify([{ id: "old1", title: "Old", body: "old body", cats: [3], tags: [], createdAt: 5, updatedAt: 5 }]));
  ok(A.run(`!!byId("old1")`), "array-format backup imported");
  doImport(JSON.stringify({ app: "liboc", entries: [{ id: "new1", body: "n", cats: [9, 2] }],
    prompts: [{ id: "ip", q: "Prompt text", sch: "Yale", due: "bad", status: "weird" }] }));
  ok(A.run(`JSON.stringify(byId("new1").cats)`) === "[2]", "invalid category dropped on import");
  ok(A.run(`promptById("ip").due === "" && promptById("ip").status === "todo"`), "prompt fields validated");
  ok(A.toasts.some(t => /Imported 1 new entry and 1 prompt/.test(t)), "toast counts prompts");
  // tombstoned id comes back via import
  A.run(`trashEntries(["old1"]); persist();`);
  doImport(JSON.stringify([{ id: "old1", title: "Old", body: "old body", cats: [3], tags: [], createdAt: 5, updatedAt: 5 }]));
  ok(A.run(`!!byId("old1") && !state.deleted["old1"] && !state.trash.some(t => t.id === "old1")`), "import revives a deleted entry");
  await A.settle();
  // export round-trip
  A.run(`document.getElementById("expMenu").onclick({ target: { closest: () => ({ dataset: { exp: "json" } }) } })`);
  ok(A.run("state.backupRev === state.rev"), "JSON export marks the backup");
}

// ---------------------------------------------------------------------------
section("11. every view renders without throwing");
{
  const srv = makeServer();
  const A = makeDevice("A", srv); await A.signIn();
  // empty library, each category
  for(let i = 0; i < 7; i++){
    A.run(`goToCategory(${i})`);
    ok(/class="jogs"/.test(A.html("view")), `empty library jogs on category ${i}`);
  }
  const e1 = add(A, "Teaching my mom to code"), e2 = add(A, "Robotics captain", [1, 5]);
  A.run(`byId(${JSON.stringify(e2)}).tags = ["Stanford"]; persist();`);
  // Local calendar dates, like the app's date inputs (toISOString would be UTC).
  const iso = d => { const x = new Date(); x.setDate(x.getDate() + d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
  A.run(`state.prompts = [
    { id: "p1", q: "What matters to you, and why?", sch: "Stanford", due: "${iso(3)}", limit: 250, status: "drafting", picks: [${JSON.stringify(e2)}], createdAt: 1, updatedAt: 1 },
    { id: "p2", q: "Old map prompt with <b>html</b> & \\"quotes\\"", sch: "UC · MIT", createdAt: 2 },
    { id: "p3", q: "Done one", sch: "", due: "${iso(-2)}", status: "done", createdAt: 3, updatedAt: 3 },
    { id: "p4", q: "Overdue", sch: "Yale", due: "${iso(-1)}", createdAt: 4, updatedAt: 4 }]; persist();`);
  await A.settle();
  for(let i = 0; i < 7; i++){
    A.run(`goToCategory(${i})`);
    ok(/<h2>/.test(A.html("viewhead")), `category ${i} renders`);
  }
  ok(/your essay prompts/.test(A.html("viewhead")) === false, "(not on Why School now)");
  A.run("goToCategory(2)");
  ok(/your essay prompts/.test(A.html("viewhead")) && /clip from websites/.test(A.html("viewhead")), "Why School links");
  A.run("clipOpen = true; render()");
  ok(/javascript:/.test(A.html("viewhead")) && /bml/.test(A.html("viewhead")), "clipper guide with bookmarklet");
  A.run("query = 'robot'; qraw = 'robot'; render()");
  ok(/Search/.test(A.html("viewhead")) && /Robotics/.test(A.html("view")), "search view");
  A.run("query = qraw = ''; setTagFilter('Stanford')");
  ok(/rtag htag/.test(A.html("viewhead")) && /Back to Why School/.test(A.html("viewhead")), "tag view + back link");
  A.run("tagFilter = null; goToPage('essays')");
  const v = A.html("view"), h = A.html("viewhead");
  ok(/<h2>Essays<\/h2>/.test(h) && /4 to go|3 to go/.test(h), "essays header: " + h.replace(/\s+/g, " ").slice(0, 200));
  ok(v.indexOf('data-id="p4"') < v.indexOf('data-id="p1"') && v.indexOf('data-id="p1"') < v.indexOf('data-id="p2"')
    && v.indexOf('data-id="p2"') < v.indexOf('data-id="p3"'), "sorted: overdue, soonest, undated, done");
  ok(/&lt;b&gt;html&lt;\/b&gt;/.test(v), "prompt text escaped");
  ok(/1d late/.test(v) && /3d/.test(v), "days badges");
  ok(/data-page="essays"[^>]*>[\s\S]*?1d late/.test(A.html("nav")), "sidebar badge shows nearest deadline");
  A.run("expanded = 'p1'; render()");
  ok(/Copy brief/.test(A.html("view")) && /Robotics captain/.test(A.html("view")), "expanded prompt shows picks");
  A.run("pickFor = 'p1'; pickQ = ''; render()");
  ok(/id="pickq"/.test(A.html("view")) && /data-picktoggle/.test(A.html("view")), "picker renders");
  A.run("pickQ = 'mom'; document.getElementById('pickres').innerHTML = pickResultsHTML(promptById('p1'))");
  ok(/Teaching my mom/.test(A.html("pickres")) && !/Robotics/.test(A.html("pickres")), "picker filters by words");
  A.run("promptEdit = 'p1'; render()");
  ok(/id="peq"/.test(A.html("view")), "edit form renders");
  A.run("expanded = 'p2'; render()");
  ok(/No deadline yet/.test(A.html("view")), "old-shape prompt expands fine");
  A.run("addingPrompt = true; render()");
  ok(/id="pq"/.test(A.html("view")), "add form renders");
  // brief text
  const brief = A.run("promptBrief(promptById('p1'))");
  ok(/ESSAY PROMPT — Stanford/.test(brief) && /250-word limit/.test(brief) && /Robotics captain/.test(brief), "brief text");
  // trash view
  A.run(`trashEntries([${JSON.stringify(e1)}]); persist(); goToPage('trash')`);
  ok(/Recently deleted/.test(A.html("viewhead")) && /Teaching my mom/.test(A.html("view")) && /30 days left|29 days left/.test(A.html("view")), "trash view");
  ok(/data-page="trash"/.test(A.html("nav")), "trash nav item appears");
  A.run(`expanded = ${JSON.stringify(e1)}; render()`);
  ok(/Delete forever/.test(A.html("view")), "trash row expands");
  // readable export + print
  const md = A.run("readableMarkdown()");
  ok(/^# Library of College/.test(md) && /## Essays/.test(md) && /## Leadership/.test(md) && /Also in Problem-solver/.test(md), "markdown export");
  A.run("printLibrary()");
  ok(/<h1>Library of College<\/h1>/.test(A.printed || ""), "print view built");
  // qadd placeholder stable across renders
  A.run("goToCategory(1)");
  const p1 = A.els.get("qadd").placeholder; A.run("render(); render();");
  ok(p1 === A.els.get("qadd").placeholder && p1.length > 10, "jogger placeholder stable: " + p1);
  A.run("openDump()");
  ok(/Need a nudge\?/.test(A.els.get("dumpText").placeholder), "dump placeholder nudges");
}

// ---------------------------------------------------------------------------
section("12. clicks: delete → trash → restore; prompt pick toggles; status");
{
  const srv = makeServer();
  const A = makeDevice("A", srv); await A.signIn();
  const x = add(A, "click me"); await A.settle();
  const target = map => ({ closest: sel => map[sel] || null });
  A.run(`expanded = ${JSON.stringify(x)}`);
  A.ctx.__t = target({ ".entry": { dataset: { id: x } }, "[data-act]": { dataset: { act: "del" } } });
  A.run(`document.getElementById("view").onclick({ target: __t })`);
  await A.settle();
  ok(srv.state.entries.length === 0 && srv.state.trash.length === 1, "delete moved it to trash on the server");
  A.run(`document.getElementById("tact").onclick()`); // Undo straight from the toast
  await A.settle();
  ok(srv.state.entries.length === 1 && srv.state.trash.length === 0, "delete undo restores it");
  A.run(`document.getElementById("view").onclick({ target: __t })`); // delete again for the trash path
  await A.settle();
  A.ctx.__t = target({ ".trow": { dataset: { id: x } }, "[data-restore]": {} });
  A.run(`goToPage('trash'); document.getElementById("view").onclick({ target: __t })`);
  await A.settle();
  ok(srv.state.entries.length === 1 && srv.state.trash.length === 0 && !srv.state.deleted[x], "restore round-trips");
  A.run(`state.prompts = [{ id: "pp", q: "Prompt", sch: "Duke", createdAt: 1 }]; persist(); goToPage('essays');`);
  A.ctx.__t = target({ ".prow": { dataset: { id: "pp" } }, "[data-picktoggle]": { dataset: { picktoggle: x } } });
  A.run(`document.getElementById("view").onclick({ target: __t })`);
  ok(A.run(`promptById("pp").picks[0] === ${JSON.stringify(x)} && byId(${JSON.stringify(x)}).tags.includes("Duke")`), "pick + school tag");
  A.ctx.__t = target({ ".prow": { dataset: { id: "pp" } }, "[data-pstatus]": { dataset: { pstatus: "done" } } });
  A.run(`document.getElementById("view").onclick({ target: __t })`);
  await A.settle();
  ok(srv.state.prompts[0].status === "done" && srv.state.prompts[0].picks.length === 1, "status + picks synced");
  // field change commits without a full re-render
  A.ctx.__t = { dataset: { pfield: "limit" }, value: "650", closest: s => s === ".prow" ? { dataset: { id: "pp" } } : null };
  A.run(`document.getElementById("view").onchange({ target: __t })`);
  await A.settle();
  ok(srv.state.prompts[0].limit === 650, "word limit committed via change");
}

// ---------------------------------------------------------------------------
section("13. wipe guard: a big merge on the current and the previous backend");
for(const backend of ["current", "previous"]){
  const srv = makeServer({ backend });
  const A = makeDevice("A", srv); await A.signIn();
  const list = [];
  for(let i = 0; i < 12; i++){ list.push(add(A, "story " + i)); await sleep(1); }
  await A.settle();
  A.run(`selected = new Set(${JSON.stringify(list.slice(0, 9))}); document.getElementById("mergeSel").onclick()`);
  await A.settle();
  const landed = srv.state.entries.length === 4;
  if(backend === "current") ok(landed && A.run("syncState") === "synced", "current backend accepts a 9-way merge (tombstoned = deliberate)");
  else console.log(`  note: on the previous backend a 9-way merge of 12 ${landed ? "landed" : "is refused (stays " + A.run("syncState") + ")"}`);
}

// ---------------------------------------------------------------------------
section("14. clipper: hash stash → composer prefill after boot (draft-safe)");
{
  const srv = makeServer();
  const A = makeDevice("A", srv);
  // simulate what the IIFE does at load, then a sign-in
  A.ctx.sessionStorage.setItem("liboc-clip", JSON.stringify({ text: "Stanford's CS198 program trains undergrads to TA.",
    src: "https://cs198.stanford.edu/", title: "CS198 Program | Stanford Computer Science Department Undergraduate Section Leading" }));
  await A.signIn();
  ok(A.els.get("composer").classList.contains("on"), "composer opened");
  ok(/CS198/.test(A.els.get("body").value) && /Source: CS198 Program/.test(A.els.get("body").value), "body has text + source");
  ok(A.els.get("title").value.length <= 61 && A.els.get("title").value.endsWith("…"), "long title trimmed: " + A.els.get("title").value);
  ok(A.run("[...picked].join()") === "2", "filed under Why School");
  ok(A.ctx.sessionStorage.getItem("liboc-clip") === null, "clip consumed once");
  // with an existing draft
  A.run(`draft = { title: "My draft", body: "half a thought", picked: [0] };`);
  A.run(`openComposer(null, { title: "T", body: "clipped", cats: [2] })`);
  ok(A.els.get("title").value === "My draft" && /half a thought\n\nclipped/.test(A.els.get("body").value), "clip joins the draft");
  ok(A.run("[...picked].sort().join()") === "0,2", "draft categories kept");
}

// ---------------------------------------------------------------------------
section("15. pull on focus; 413; edits during an in-flight PUT");
{
  const srv = makeServer();
  const A = makeDevice("A", srv); await A.signIn();
  const B = makeDevice("B", srv); await B.signIn();
  add(B, "from B"); await B.settle();
  A.run("lastPull = 0");
  await A.visible();
  ok(A.run("state.entries.length") === 1, "A picked up B's entry on focus");
  // edits during an in-flight PUT stay dirty and go out next
  const slow = srv.handle.bind(srv);
  srv.handle = async (...a) => { await sleep(30); return slow(...a); };
  add(A, "first"); A.run("clearTimeout(pushT); doPush()");
  await sleep(5);
  add(A, "second while in flight");
  await A.settle();
  srv.handle = slow;
  ok(bodies(srv.state).includes("second while in flight") && A.run("dirty") === false, "mid-flight edit synced after");
  // 413
  A.run(`(() => { const big = "x".repeat(360000); const en = { id: newId(), title: "big", body: big, cats: [0], pinned: false, tags: [], createdAt: Date.now(), updatedAt: Date.now() }; state.entries.unshift(en); persist(); })()`);
  await A.settle();
  ok(A.run("syncState") === "offline" && A.toasts.some(t => /too big to sync/.test(t)), "413 reported");
}

section("16. match modal pick toggles only for the prompt it was opened from");
{
  const srv = makeServer();
  srv.handle = (orig => async (m, p, b) => p === "/match" ? [200, { matches: [{ id: "e1", why: "fits", fit: "strong" }] }] : orig(m, p, b))(srv.handle.bind(srv));
  const A = makeDevice("A", srv); await A.signIn();
  A.run(`state.entries = [{ id: "e1", title: "Story", body: "b", cats: [0], tags: [], createdAt: 1, updatedAt: 1 }];
    state.prompts = [{ id: "mp", q: "Describe a community.", sch: "Rice", createdAt: 1 }]; persist(); goToPage("essays");`);
  A.ctx.__t = { closest: s => s === ".prow" ? { dataset: { id: "mp" } } : s === "[data-pfind]" ? {} : null };
  await A.run(`document.getElementById("view").onclick({ target: __t })`);
  await new Promise(r => setTimeout(r, 20));
  ok(/data-mpick="e1"/.test(A.html("matchList")), "pick toggle shown for the Essays prompt");
  A.ctx.__t = { closest: s => s === "[data-mpick]" ? { dataset: { mpick: "e1" }, set textContent(v){ this._t = v; } } : null };
  A.run(`document.getElementById("matchList").onclick({ target: __t })`);
  ok(A.run(`promptById("mp").picks.includes("e1") && byId("e1").tags.includes("Rice")`), "toggle picks + tags");
  A.els.get("matchQ").value = "A totally different prompt";
  await A.run("matchRun()");
  ok(!/data-mpick/.test(A.html("matchList")), "no toggles once the prompt text is swapped");
}

section("17. an old app tab (pre-tombstone code) is locked out once a current client has written");
for(const backend of ["current", "previous"]){
  const srv = makeServer({ backend });
  const A = makeDevice("A", srv); await A.signIn();
  const x = add(A, "keep me"); add(A, "doomed"); await A.settle();
  A.run(`trashEntries([state.entries.find(e => e.body === "doomed").id]); persist();`); await A.settle();
  // What the old code PUTs: its boot-time copy, no trash/deleted, a high per-edit rev.
  const oldBody = { entries: [{ id: "stale", title: "stale", body: "stale", cats: [0], tags: [], createdAt: 1, updatedAt: 1 }],
    prompts: [], rev: 999, backupRev: 0 };
  const [status] = await srv.handle("PUT", "/entries", JSON.stringify(oldBody));
  if(backend === "current"){
    ok(status === 409, "old-client PUT refused");
    ok(srv.state.trash.length === 1 && Object.keys(srv.state.deleted).length === 1 && srv.state.entries.some(e => e.id === x),
      "trash, tombstones and newer entries intact");
  } else console.log(`  note: on the previous backend an old tab's PUT ${status === 200 ? "overwrites the library (reload old tabs after deploying)" : "is refused"}`);
}

section("18. Delete forever and Empty now stick across devices");
{
  const srv = makeServer();
  const A = makeDevice("A", srv); await A.signIn();
  const x = add(A, "purge me"), y = add(A, "purge me too"); await A.settle();
  A.run(`trashEntries([${JSON.stringify(x)}, ${JSON.stringify(y)}]); persist();`); await A.settle();
  const B = makeDevice("B", srv); await B.signIn();
  ok(B.run("state.trash.length") === 2, "B sees both in Recently deleted");
  await new Promise(r => setTimeout(r, 3));
  A.ctx.__t = { closest: s => s === ".trow" ? { dataset: { id: x } } : s === "[data-purge]" ? {} : null };
  A.run(`goToPage("trash"); document.getElementById("view").onclick({ target: __t })`); await A.settle();
  add(B, "B edit"); await B.settle(); // stale B still holds x in trash → merge must drop it
  ok(!srv.state.trash.some(t => t.id === x) && srv.state.trash.some(t => t.id === y), "purged copy didn't come back; the other stays");
  B.ctx.__t = { closest: s => s === "[data-emptytrash]" ? {} : null };
  B.run(`document.getElementById("viewhead").onclick({ target: __t })`); await B.settle();
  add(A, "A edit"); await A.settle();
  ok(srv.state.trash.length === 0, "Empty now sticks too");
  ok(!srv.state.entries.some(e => e.id === x || e.id === y), "and nothing was resurrected");
}

section("19. import refuses ids that could break out of an HTML attribute");
{
  const srv = makeServer();
  const A = makeDevice("A", srv); await A.signIn();
  A.run(`(() => {
    globalThis.FileReader = function(){ this.readAsText = () => { this.result = ${JSON.stringify(JSON.stringify({
      entries: [{ id: 'x" onmouseover="alert(1)', body: "evil" }, { id: "ok-1", body: "fine" }],
      prompts: [{ id: "p ok?", q: "bad id prompt" }, { id: "p2", q: "good", picks: ['y"><img', "ok-1"] }] }))}; this.onload(); }; };
    document.getElementById("importFile").onchange({ target: { files: [{}], value: "x" } });
  })()`);
  ok(A.run(`state.entries.map(e => e.id).join()`) === "ok-1", "only the safe entry id imported");
  ok(A.run(`state.prompts.map(p => p.id).join()`) === "p2" && A.run(`promptById("p2").picks.join()`) === "ok-1", "unsafe prompt id and pick dropped");
}

section("20. the composer draft survives sign-in, and a clip joins it");
{
  const srv = makeServer();
  const st = new Map([["liboc-draft:u1", JSON.stringify({ title: "Half-written", body: "about the robot", picked: [1] })]]);
  const A = makeDevice("A", srv, { storage: st });
  A.ctx.sessionStorage.setItem("liboc-clip", JSON.stringify({ text: "A clipped line.", src: "https://example.edu/", title: "Example" }));
  await A.signIn();
  ok(A.els.get("title").value === "Half-written" && /about the robot\n\nA clipped line\./.test(A.els.get("body").value),
    "per-account draft loaded at sign-in and the clip joined it");
  ok(A.run("[...picked].sort().join()") === "1,2", "draft + clip categories");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

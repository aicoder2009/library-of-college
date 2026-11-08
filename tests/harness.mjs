// Runs app.html's inline script in Node vm contexts — each one a "device" with
// its own localStorage and a stub DOM — against a fake server that applies the
// Lambda's GET/PUT /entries rules (409 when stale, the wipe guard, 413).
// No browser and no dependencies. Used by tests/app.test.mjs.
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const APP = process.argv[2] || fileURLToPath(new URL("../app.html", import.meta.url));
const html = fs.readFileSync(APP, "utf8");
const code = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));

export function makeServer({ trashAware = true } = {}){
  let item = null;
  return {
    puts: 0, conflicts: 0,
    get state(){ return item ? JSON.parse(item.state) : null; },
    set state(s){ item = s ? { state: JSON.stringify(s), rev: s.rev } : null; },
    async handle(method, path, bodyStr){
      if(path === "/entries" && method === "GET")
        return [200, item ? JSON.parse(item.state) : { entries: [], rev: 0, backupRev: 0 }];
      if(path === "/entries" && method === "PUT"){
        const body = JSON.parse(bodyStr);
        if(!Array.isArray(body.entries) || !Number.isFinite(body.rev)) return [400, { error: "Bad state" }];
        const s = JSON.stringify(body);
        if(s.length > 350000) return [413, { error: "Bank too large to sync" }];
        const cur = item ? JSON.parse(item.state) : null, curRev = cur ? cur.rev || 0 : 0;
        if(body.rev <= curRev){ this.conflicts++; return [409, { error: "stale", rev: curRev }]; }
        const curN = cur ? (cur.entries || []).length : 0;
        const keptN = body.entries.length + (trashAware && Array.isArray(body.trash) ? body.trash.length : 0);
        if(curN >= 10 && keptN < curN / 2){ this.conflicts++; return [409, { error: "stale", rev: curRev }]; }
        item = { state: s, rev: body.rev }; this.puts++;
        return [200, { ok: true }];
      }
      if(path === "/title") return [200, { title: "AI Title" }];
      if(path === "/classify") return [200, { title: "AI Title", cats: [1] }];
      return [404, { error: "Not found" }];
    }
  };
}

function makeEl(id){
  const set = new Set();
  return {
    id, attrs: {}, innerHTML: "", textContent: "", value: "", placeholder: "", title: "", hidden: false,
    disabled: false, style: {}, dataset: {}, offsetWidth: 100, scrollHeight: 20, isConnected: true,
    classList: { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c),
      toggle(c, on){ if(on === undefined) on = !set.has(c); on ? set.add(c) : set.delete(c); return on; } },
    setAttribute(k, v){ this.attrs[k] = String(v); }, getAttribute(k){ return this.attrs[k]; },
    focus(){}, blur(){}, select(){}, remove(){}, click(){}, scrollIntoView(){}, insertAdjacentHTML(){},
    appendChild(){}, querySelector(){ return null; }, querySelectorAll(){ return []; }, closest(){ return null; },
    addEventListener(){}, setSelectionRange(){}
  };
}

export function makeDevice(name, server, { storage } = {}){
  const els = new Map();
  const ls = storage || new Map();
  const ss = new Map();
  const toasts = [];
  const handlers = {};
  const store = m => ({ getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k) });
  const dev = { name, online: true, toasts, els, ls, handlers, server };
  const document = {
    getElementById(id){ if(!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
    createElement: tag => makeEl(tag), head: { appendChild(){} }, body: makeEl("body"),
    addEventListener(t, fn){ (handlers[t] ||= []).push(fn); },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    activeElement: null, visibilityState: "visible"
  };
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams, Blob, atob, structuredClone,
    crypto: globalThis.crypto, innerWidth: 1200,
    location: { hostname: "localhost", origin: "http://localhost:8765", hash: "", pathname: "/app", search: "",
      href: "http://localhost:8765/app", replace(){} },
    history: { replaceState(){} },
    localStorage: store(ls), sessionStorage: store(ss),
    navigator: { clipboard: { writeText: async t => { dev.clipboard = t; } } },
    matchMedia: () => ({ matches: false }),
    getSelection: () => ({ isCollapsed: true, toString: () => "" }), scrollTo(){},
    addEventListener(t, fn){ (handlers["win:" + t] ||= []).push(fn); },
    print(){ dev.printed = sandbox.document.getElementById("printout").innerHTML; },
    async fetch(url, opts = {}){
      if(!dev.online) throw new TypeError("Failed to fetch");
      const [status, data] = await server.handle(opts.method || "GET", new URL(url).pathname, opts.body);
      return { status, ok: status >= 200 && status < 300, json: async () => structuredClone(data) };
    }
  };
  sandbox.window = sandbox;
  sandbox.Clerk = { load: async () => {}, user: { id: "u1", primaryEmailAddress: { emailAddress: "t@x" } },
    session: { getToken: async () => "tok" }, signOut: async () => {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "app.js" });
  dev.ctx = sandbox;
  dev.run = src => vm.runInContext(src, sandbox);
  // capture toasts
  const t = document.getElementById("toast");
  let txt = "";
  Object.defineProperty(t, "textContent", { get: () => txt, set: v => { txt = v; toasts.push(v); } });
  let ih = "";
  Object.defineProperty(t, "innerHTML", { get: () => ih, set: v => { ih = v; toasts.push(v.replace(/<[^>]+>/g, " ")); } });
  dev.html = id => document.getElementById(id).innerHTML;
  dev.settle = async (ms = 3000) => {
    const t0 = Date.now();
    await new Promise(r => setTimeout(r, 5));
    while(Date.now() - t0 < ms){
      const busy = dev.run("syncing || pushT !== null");
      if(!busy) return;
      if(dev.run("pushT !== null && !syncing")) dev.run("clearTimeout(pushT); doPush()");
      await new Promise(r => setTimeout(r, 5));
    }
    throw new Error(name + ": sync never settled");
  };
  // Simulates clerkInit's signed-in path, awaiting boot().
  dev.signIn = async () => {
    dev.run(`KEY = "liboc-v1:u1"; KEY_UI = "liboc-ui:u1"; KEY_DRAFT = "liboc-draft:u1";
      state = load(); loadUI(); render(); if(state.entries.length) lockHide();`);
    await dev.run("boot()");
    await dev.settle();
  };
  dev.visible = async () => { for(const fn of handlers.visibilitychange || []) fn(); await dev.settle(); };
  return dev;
}

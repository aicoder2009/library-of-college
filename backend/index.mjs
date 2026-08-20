import { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

const db = new DynamoDBClient({});
const TABLE = process.env.TABLE;
const ISSUER = process.env.CLERK_ISSUER;      // e.g. https://xxxxx.clerk.accounts.dev
// Comma-separated list of permitted Clerk user IDs (the owner's accounts)
const ALLOWED = new Set((process.env.ALLOWED_USER_ID || "").split(","));

let jwks = null, jwksAt = 0;
async function getJwks(){
  if(!jwks || Date.now() - jwksAt > 3600e3){
    const r = await fetch(`${ISSUER}/.well-known/jwks.json`);
    jwks = (await r.json()).keys; jwksAt = Date.now();
  }
  return jwks;
}
const b64uJson = s => JSON.parse(Buffer.from(s, "base64url").toString());

async function verifyClerk(token){
  try{
    const [h, p, sig] = (token || "").split(".");
    if(!h || !p || !sig) return null;
    const header = b64uJson(h);
    if(header.alg !== "RS256") return null;
    const jwk = (await getJwks()).find(k => k.kid === header.kid);
    if(!jwk) return null;
    const key = createPublicKey({ key: jwk, format: "jwk" });
    if(!cryptoVerify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, Buffer.from(sig, "base64url")))
      return null;
    const c = b64uJson(p);
    const now = Date.now() / 1000;
    if(c.iss !== ISSUER) return null;
    if(c.exp < now - 5 || (c.nbf && c.nbf > now + 5)) return null;
    if(!ALLOWED.has(c.sub)) return null;
    return c;
  }catch{ return null; }
}

const resp = (code, body) => ({ statusCode: code,
  headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const handler = async (event) => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  // $default catches OPTIONS too; answer 204 so browser CORS preflights succeed
  if(method === "OPTIONS") return { statusCode: 204 };

  const auth = await verifyClerk((event.headers.authorization || "").replace(/^Bearer /, ""));
  if(!auth) return resp(401, { error: "Not signed in" });

  let body = null;
  try{
    if(event.body) body = JSON.parse(event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString() : event.body);
  }catch{ return resp(400, { error: "Bad JSON" }); }

  if(method === "GET" && path === "/entries"){
    const d = await db.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: "data" } } }));
    return resp(200, d.Item ? JSON.parse(d.Item.state.S) : { entries: [], rev: 0, backupRev: 0 });
  }
  if(method === "POST" && path === "/classify"){
    if(!body || !body.body) return resp(400, { error: "Bad request" });
    try{
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-4.1-nano",
          max_tokens: 80,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content:
`File this college-application evidence note. Categories:
0 Community/Perspective - identity, family, culture, background, communities, values, worldview
1 Leadership - leading people, organizing events, taking responsibility, influencing others
2 Why School - specific colleges, campus programs, classes, professors, campus communities
3 Why Major - interest in their intended field (business/entrepreneurship, AI, writing), projects, origin stories
4 Creative - making, building, art, music, design, creative expression
5 Problem-solver - untangling a specific problem, resilience, perseverance under constraints
6 My favorite topic - subjects they love and pursue on their own time

Reply ONLY with JSON: {"title": "3-6 word specific memorable label, no ending punctuation", "cats": [1-3 category numbers that GENUINELY fit - fewer is better, never pad]}

Note:
` + String(body.body).slice(0, 4000) }]
        })
      });
      const d = await r.json();
      const out = JSON.parse(d.choices?.[0]?.message?.content || "{}");
      const cats = [...new Set((out.cats || []).map(Number)
        .filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].slice(0, 3);
      const title = String(out.title || "").trim().replace(/^["“]|["”]$/g, "").slice(0, 60);
      if(!title && !cats.length) return resp(502, { error: "Classification failed" });
      return resp(200, { title, cats });
    }catch(e){ return resp(502, { error: "Classification failed" }); }
  }
  if(method === "POST" && path === "/match"){
    if(!body || typeof body.prompt !== "string" || body.prompt.trim().length < 4)
      return resp(400, { error: "Bad request" });
    const prompt = body.prompt.slice(0, 2000);
    // The breakdown roughly doubles the reasoning budget, so the client can opt out.
    // Absent flag = on, so an older client keeps its current behaviour.
    const deep = body.deep !== false;
    const d = await db.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: "data" } } }));
    const state = d.Item ? JSON.parse(d.Item.state.S) : { entries: [] };
    const entries = state.entries || [];
    if(!entries.length) return resp(200, { matches: [] });
    const notes = entries.map((e, i) => `${i}. ${e.title || "Untitled"} — ${
      String(e.body || "").slice(0, 600).replace(/\s+/g, " ")}`).join("\n");
    const task = deep
? `First, deconstruct what the prompt is secretly asking for beneath the surface.
Then, work out which college or university this prompt is from, and what that school in particular rewards in an answer to it.
Then, select the matching notes and explain the connection concretely.
Then, write a gap analysis: what is missing from these selected notes to answer the prompt completely.
Finally, generate a structural outline showing how to arrange these specific notes into a narrative arc.`
: `Select the notes and explain the connection concretely: name the specific detail, moment, or theme in the note and the part of the prompt it answers. Never a generic reason that could apply to any note.`;
    const schema = deep
? `{
  "deconstruction": "<what the prompt is actually asking for, max 30 words>",
  "college": "<the school this prompt is from, or an empty string if you can't identify it confidently>",
  "college_advice": "<advice that names that school and says what it rewards here, max 45 words>",
  "matches": [{"i": <note number>, "fit": "strong" or "possible", "why": "<the concrete link, one sentence, max 25 words>"}],
  "gap_analysis": "<what is missing to fully answer the prompt, max 40 words>",
  "outline": ["<bullet 1>", "<bullet 2>", "<bullet 3>"]
}

Identify the school only from what the prompt itself gives you — its wording, named programs, traditions, or stated values. Never guess: if you are not confident, set "college" and "college_advice" to empty strings. Naming the wrong school is worse than naming none.`
: `{"matches": [{"i": <note number>, "fit": "strong" or "possible", "why": "<the concrete link, one sentence, max 25 words>"}]}`;
    try{
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-5.6-sol",
          reasoning_effort: "low",
          max_completion_tokens: deep ? 2500 : 1500,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content:
`These are a student's evidence notes for college essays. Given the essay prompt, pick the notes that genuinely fit BEST as material for answering it, best first — usually 3-8, fewer if few genuinely fit.

${task}

Address the student as "you" (or use subjectless fragments) — never third person.

Reply ONLY with JSON:
${schema}

"strong" = answers the prompt as-is. "possible" = works with reframing, or covers only part of the prompt.

Essay prompt:
${prompt}

Notes:
${notes}` }]
        })
      });
      const d2 = await r.json();
      const out = JSON.parse(d2.choices?.[0]?.message?.content || "{}");
      const seen = new Set();
      const matches = [];
      for(const m of (out.matches || [])){
        const i = Number(m.i);
        if(!Number.isInteger(i) || i < 0 || i >= entries.length) continue;
        const id = entries[i].id;
        if(seen.has(id)) continue;
        seen.add(id);
        matches.push({ id, fit: m.fit === "strong" ? "strong" : "possible",
          why: String(m.why || "").slice(0, 200) });
        if(matches.length >= 8) break;
      }
      if(!deep) return resp(200, { matches });
      // Advice only ships alongside a named school — a confident-sounding line with no
      // school attached is exactly the hallucination the prompt tells it to suppress.
      const college = String(out.college || "").slice(0, 80);
      return resp(200, {
        deconstruction: String(out.deconstruction || "").slice(0, 300),
        college,
        college_advice: college ? String(out.college_advice || "").slice(0, 300) : "",
        gap_analysis: String(out.gap_analysis || "").slice(0, 400),
        outline: Array.isArray(out.outline) ? out.outline.map(String).slice(0, 5) : [],
        matches
      });
    }catch(e){ return resp(502, { error: "Match failed" }); }
  }
  if(method === "POST" && path === "/search"){
    if(!body || typeof body.q !== "string" || !body.q.trim())
      return resp(400, { error: "Bad request" });
    const q = body.q.slice(0, 300);
    const d = await db.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: "data" } } }));
    const state = d.Item ? JSON.parse(d.Item.state.S) : { entries: [] };
    const entries = state.entries || [];
    if(!entries.length) return resp(200, { matches: [] });
    const notes = entries.map((e, i) => `${i}. ${e.title || "Untitled"} — ${
      String(e.body || "").slice(0, 400).replace(/\s+/g, " ")}`).join("\n");
    try{
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-5.6-sol",
          reasoning_effort: "none", // interactive palette search — speed over deliberation
          max_completion_tokens: 700,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content:
`These are a student's evidence notes for college essays. The student is searching their library by IDEA, not exact words. Pick the notes genuinely related to the search — by theme, topic, person, place, event, or concept — best first, up to 8. Fewer if few relate; an empty list is a valid answer.

Reply ONLY with JSON: {"matches": [{"i": <note number>, "why": "<the connection, max 12 words, addressing the student as "you" or subjectless — never third person>"}]}

Search:
${q}

Notes:
${notes}` }]
        })
      });
      const d2 = await r.json();
      const out = JSON.parse(d2.choices?.[0]?.message?.content || "{}");
      const seen = new Set();
      const matches = [];
      for(const m of (out.matches || [])){
        const i = Number(m.i);
        if(!Number.isInteger(i) || i < 0 || i >= entries.length) continue;
        const id = entries[i].id;
        if(seen.has(id)) continue;
        seen.add(id);
        matches.push({ id, why: String(m.why || "").slice(0, 120) });
        if(matches.length >= 8) break;
      }
      return resp(200, { matches });
    }catch(e){ return resp(502, { error: "Search failed" }); }
  }
  if(method === "POST" && path === "/polish"){
    if(!body || !body.body) return resp(400, { error: "Bad request" });
    try{
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          max_tokens: 700,
          temperature: 0.4,
          messages: [{ role: "user", content:
`Lightly polish this college-essay evidence note. Fix grammar and awkward phrasing, tighten wordiness, and keep the writer's natural voice. Keep ALL facts exactly as given — never invent details, names, or embellishment. Plain first person, roughly the same length or shorter. Reply with the polished text only — no preamble, no quotes.

Note:
` + String(body.body).slice(0, 6000) }]
        })
      });
      const d = await r.json();
      const text = (d.choices?.[0]?.message?.content || "").trim();
      if(!text) return resp(502, { error: "Polish failed" });
      return resp(200, { text });
    }catch(e){ return resp(502, { error: "Polish failed" }); }
  }
  if(method === "POST" && path === "/title"){
    if(!body || !body.body) return resp(400, { error: "Bad request" });
    try{
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-4.1-nano",
          max_tokens: 30,
          temperature: 0.4,
          messages: [{ role: "user", content:
            "Write a title for this college-essay evidence note: a short, specific, memorable label of 3-6 words that makes the story easy to recognize in a list later. Reply with the title only - no quotes, no ending punctuation.\n\nNote:\n"
            + String(body.body).slice(0, 4000) }]
        })
      });
      const d = await r.json();
      const title = (d.choices?.[0]?.message?.content || "").trim()
        .replace(/^["“]|["”]$/g, "").slice(0, 60);
      if(!title) return resp(502, { error: "Title generation failed" });
      return resp(200, { title });
    }catch(e){ return resp(502, { error: "Title generation failed" }); }
  }
  if(method === "PUT" && path === "/entries"){
    if(!body || !Array.isArray(body.entries) || !Number.isFinite(body.rev))
      return resp(400, { error: "Bad state" });
    const s = JSON.stringify(body);
    if(s.length > 350000) return resp(413, { error: "Bank too large to sync" });
    // Optimistic concurrency: a PUT whose rev isn't ahead of the stored rev is
    // from a device that hasn't seen the latest state — reject so it can merge.
    const cur = await db.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: "data" } } }));
    const curState = cur.Item ? JSON.parse(cur.Item.state.S) : null;
    const curRev = curState ? (curState.rev || 0) : 0;
    if(body.rev <= curRev) return resp(409, { error: "stale", rev: curRev });
    // A sync that would wipe half the library is a bug, not an edit. The 409
    // makes the client merge the server's entries back in and re-push the union.
    const curN = curState ? (curState.entries || []).length : 0;
    if(curN >= 10 && body.entries.length < curN / 2)
      return resp(409, { error: "stale", rev: curRev });
    // Once per day, snapshot the pre-change state (kept ~14 days) so app-level
    // corruption is a one-item restore. Best-effort — never blocks the save.
    if(cur.Item){
      const day = new Date().toISOString().slice(0, 10);
      try{
        await db.send(new PutItemCommand({ TableName: TABLE,
          Item: { pk: { S: "backup#" + day }, state: cur.Item.state },
          ConditionExpression: "attribute_not_exists(pk)" }));
        const old = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
        await db.send(new DeleteItemCommand({ TableName: TABLE, Key: { pk: { S: "backup#" + old } } }));
      }catch(e){ /* today's snapshot already exists */ }
    }
    // Atomic guard: the write lands only if this rev is still ahead of the
    // stored one, so two devices racing the check above can't both win.
    try{
      await db.send(new PutItemCommand({ TableName: TABLE,
        Item: { pk: { S: "data" }, state: { S: s }, rev: { N: String(body.rev) } },
        ConditionExpression: "attribute_not_exists(pk) OR attribute_not_exists(#r) OR #r < :r",
        ExpressionAttributeNames: { "#r": "rev" },
        ExpressionAttributeValues: { ":r": { N: String(body.rev) } } }));
    }catch(e){
      if(e.name === "ConditionalCheckFailedException")
        return resp(409, { error: "stale", rev: curRev });
      throw e;
    }
    return resp(200, { ok: true });
  }
  return resp(404, { error: "Not found" });
};

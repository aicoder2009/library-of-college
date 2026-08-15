import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
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
    const d = await db.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: "data" } } }));
    const state = d.Item ? JSON.parse(d.Item.state.S) : { entries: [] };
    const entries = state.entries || [];
    if(!entries.length) return resp(200, { matches: [] });
    const notes = entries.map((e, i) => `${i}. ${e.title || "Untitled"} — ${
      String(e.body || "").slice(0, 600).replace(/\s+/g, " ")}`).join("\n");
    try{
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          max_tokens: 300,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content:
`These are a student's evidence notes for college essays. Given the essay prompt, pick the 5-8 notes that genuinely fit BEST as material for answering it, best first. Fewer if few genuinely fit.

Reply ONLY with JSON: {"matches": [{"i": <note number>, "why": "<one concrete reason, max 15 words>"}]}

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
        matches.push({ id, why: String(m.why || "").slice(0, 140) });
        if(matches.length >= 8) break;
      }
      return resp(200, { matches });
    }catch(e){ return resp(502, { error: "Match failed" }); }
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
    if(!body || !Array.isArray(body.entries)) return resp(400, { error: "Bad state" });
    const s = JSON.stringify(body);
    if(s.length > 350000) return resp(413, { error: "Bank too large to sync" });
    // Optimistic concurrency: a PUT whose rev isn't ahead of the stored rev is
    // from a device that hasn't seen the latest state — reject so it can merge.
    const cur = await db.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: "data" } } }));
    const curRev = cur.Item ? (JSON.parse(cur.Item.state.S).rev || 0) : 0;
    if(typeof body.rev !== "number" || body.rev <= curRev)
      return resp(409, { error: "stale", rev: curRev });
    await db.send(new PutItemCommand({ TableName: TABLE,
      Item: { pk: { S: "data" }, state: { S: s } } }));
    return resp(200, { ok: true });
  }
  return resp(404, { error: "Not found" });
};

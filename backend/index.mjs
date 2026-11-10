import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

const db = new DynamoDBClient({});
const TABLE = process.env.TABLE;
// Comma-separated issuer allowlist: the dev instance (localhost + legacy
// aliases) and the prod instance's proxy URL (https://liboc.vercel.app/__clerk).
const ISSUERS = new Set((process.env.CLERK_ISSUER || "").split(",")
  .map(s => s.trim()).filter(Boolean));
// The owner's Clerk user IDs (comma-separated). No longer an access gate — any
// signed-in Clerk user gets a library (account creation is gated by waitlist
// approval in Clerk). These IDs are (a) admins for /waitlist, and (b) mapped to
// the original single-user items (pk="data", "backup#<day>") so the founding
// library needs no migration.
const OWNERS = new Set((process.env.ALLOWED_USER_ID || "").split(","));

const jwksCache = new Map(); // issuer -> { keys, at }
async function getJwks(iss){
  const c = jwksCache.get(iss);
  if(!c || Date.now() - c.at > 3600e3){
    const r = await fetch(`${iss}/.well-known/jwks.json`,
      { signal: AbortSignal.timeout(3000) });
    const keys = (await r.json()).keys;
    jwksCache.set(iss, { keys, at: Date.now() });
    return keys;
  }
  return c.keys;
}
const b64uJson = s => JSON.parse(Buffer.from(s, "base64url").toString());

async function verifyClerk(token){
  try{
    const [h, p, sig] = (token || "").split(".");
    if(!h || !p || !sig) return null;
    const header = b64uJson(h);
    if(header.alg !== "RS256") return null;
    const c = b64uJson(p); // claims are untrusted until the signature verifies —
    if(!ISSUERS.has(c.iss)) return null; // iss only picks which JWKS to check against
    let jwk = (await getJwks(c.iss)).find(k => k.kid === header.kid);
    if(!jwk && Date.now() - (jwksCache.get(c.iss)?.at ?? 0) > 60e3){
      // Unknown kid on a >60s-old cache: Clerk may have rotated keys — refetch
      // once instead of 401ing everyone until the hourly cache expires. The 60s
      // floor keeps a garbage-token flood from hammering the JWKS endpoint.
      jwksCache.delete(c.iss);
      jwk = (await getJwks(c.iss)).find(k => k.kid === header.kid);
    }
    if(!jwk) return null;
    const key = createPublicKey({ key: jwk, format: "jwk" });
    if(!cryptoVerify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, Buffer.from(sig, "base64url")))
      return null;
    const now = Date.now() / 1000;
    if(c.exp < now - 5 || (c.nbf && c.nbf > now + 5)) return null;
    if(!c.sub || typeof c.sub !== "string" || c.sub.length > 64) return null;
    if(c.azp && !AZP.has(c.azp)) return null;
    return c;
  }catch{ return null; }
}

const resp = (code, body) => ({ statusCode: code,
  headers: { "content-type": "application/json", "cache-control": "no-store",
    "x-content-type-options": "nosniff" }, body: JSON.stringify(body) });

// Origins the frontend legitimately runs on (mirrors the API Gateway CORS list).
// A session token minted on any other origin is rejected even if its signature
// is valid — stops a token replayed from a page we don't serve. Self-hosters set
// ALLOWED_ORIGINS (comma-separated); the default is this deployment's list.
const AZP = new Set((process.env.ALLOWED_ORIGINS ||
  "https://liboc.vercel.app,https://evidence-bank.vercel.app,http://localhost:8765")
  .split(",").map(s => s.trim()).filter(Boolean));

// Best-effort per-user budget for the AI routes (cost guard, not a turnstile):
// counts live in container memory, so it resets on cold start and is per
// concurrent instance — fine for this traffic, and free.
const aiCalls = new Map(); // userId -> [timestamps]
function aiBudgetExceeded(sub){
  const now = Date.now();
  const w = (aiCalls.get(sub) || []).filter(t => now - t < 300e3);
  if(w.length >= 30) return true;
  w.push(now); aiCalls.set(sub, w);
  if(aiCalls.size > 500) aiCalls.clear(); // don't let a scan grow memory forever
  return false;
}

// ── AI: Claude, signed in by Workload Identity Federation ──────────────────
// No API key exists anywhere. The Lambda's IAM role asks AWS STS for a
// short-lived identity token addressed to Anthropic (the role's IAM policy
// allows no other audience), and the SDK trades it at Anthropic for a
// short-lived access token that it caches and refreshes on its own. The three
// ANTHROPIC_* env vars are identifiers, not secrets. The SDK loads lazily, so a
// packaging problem can only break the AI routes, never sync.
const MODEL = "claude-opus-5-5";
// The whole AI call, token included, gets one attempt within 24s. The rest of
// the Lambda's 28s covers auth, the library read and sending the 502.
const AI_TIMEOUT = 24000;
let claudeP = null;
function claude(){
  return claudeP ??= (async () => {
    if(!process.env.ANTHROPIC_FEDERATION_RULE_ID)
      throw new Error("ANTHROPIC_* federation env vars are not set");
    const [{ default: Anthropic }, { oidcFederationProvider }, { STSClient, GetWebIdentityTokenCommand }] =
      await Promise.all([import("@anthropic-ai/sdk"),
        import("@anthropic-ai/sdk/lib/credentials/oidc-federation"), import("@aws-sdk/client-sts")]);
    const sts = new STSClient({});
    return new Anthropic({
      maxRetries: 0, // a retry wouldn't fit the time budget
      credentials: oidcFederationProvider({
        identityTokenProvider: async () => (await sts.send(new GetWebIdentityTokenCommand({
          Audience: ["https://api.anthropic.com"], SigningAlgorithm: "RS256", DurationSeconds: 300 }),
          { abortSignal: AbortSignal.timeout(3000) })).WebIdentityToken,
        federationRuleId: process.env.ANTHROPIC_FEDERATION_RULE_ID,
        organizationId: process.env.ANTHROPIC_ORGANIZATION_ID,
        serviceAccountId: process.env.ANTHROPIC_SERVICE_ACCOUNT_ID,
        baseURL: "https://api.anthropic.com",
        // the SDK's token exchange has no timeout of its own
        fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(4000) }),
      }),
    });
  })().catch(e => { claudeP = null; throw e; });
}

// One Claude request. With a schema, structured outputs guarantee the reply's
// JSON shape and this returns the parsed object; without one, the reply text.
async function ask(route, { prompt, effort, maxTokens, schema = null, model = MODEL }){
  const t0 = Date.now();
  // The SDK fetches the Claude token inside create(), before its own `timeout`
  // starts counting, so a signal started here is what holds the whole call
  // (SDK load, token exchange, model) to the budget.
  const signal = AbortSignal.timeout(AI_TIMEOUT);
  const msg = await (await claude()).beta.messages.create({
    model,
    max_tokens: maxTokens, // covers the (always-on) thinking as well as the reply
    inference_geo: "us", // notes are processed only in the US (the owner's choice)
    output_config: { effort, ...(schema && { format: { type: "json_schema", schema } }) },
    // If a safety classifier declines (a note about, say, a security project
    // can trip one), Anthropic reruns the request on the model it recommends
    // for that kind of refusal instead of returning nothing.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: prompt }],
  }, { signal });
  const u = msg.usage || {};
  console.log(JSON.stringify({ ai: route, model: msg.model, ms: Date.now() - t0,
    in: u.input_tokens, out: u.output_tokens, geo: u.inference_geo, stop: msg.stop_reason }));
  if(msg.stop_reason !== "end_turn") throw new Error(`stop_reason ${msg.stop_reason}`);
  // After a mid-reply fallback, the answer is the text after the last fallback block.
  const from = msg.content.map(b => b.type).lastIndexOf("fallback") + 1;
  const text = msg.content.slice(from).filter(b => b.type === "text").map(b => b.text).join("").trim();
  return schema ? JSON.parse(text) : text;
}

// Reply shapes for structured outputs. Allowed values live in descriptions, not
// `enum` (the SDK's own schema transform doesn't pass enum through), and the
// routes still validate every field.
const str = { type: "string" };
const obj = properties => ({ type: "object", additionalProperties: false,
  required: Object.keys(properties), properties });
const PICK = obj({ i: { type: "integer" },
  fit: { type: "string", description: '"strong" or "possible"' }, why: str });
const SCHEMAS = {
  classify: obj({ title: str, cats: { type: "array", items: { type: "integer" } } }),
  match: obj({ matches: { type: "array", items: PICK } }),
  // Same order the prompt works in: the read, the school, the picks, the gaps, the outline.
  deepMatch: obj({ deconstruction: str, college: str, college_advice: str,
    matches: { type: "array", items: PICK }, gap_analysis: str, outline: { type: "array", items: str } }),
  search: obj({ matches: { type: "array", items: obj({ i: { type: "integer" }, why: str }) } }),
};

// The library as one numbered list; replies point at notes by these numbers.
const numbered = (entries, chars) => entries.map((e, i) => `${i}. ${e.title || "Untitled"} — ${
  String(e.body || "").slice(0, chars).replace(/\s+/g, " ")}`).join("\n");
// Note numbers back to entry ids: in range, no repeats, best first, at most 8.
function picked(list, entries, fields){
  const seen = new Set(), out = [];
  for(const m of list || []){
    const i = Number(m.i);
    if(!Number.isInteger(i) || i < 0 || i >= entries.length || seen.has(entries[i].id)) continue;
    seen.add(entries[i].id);
    out.push({ id: entries[i].id, ...fields(m) });
    if(out.length >= 8) break;
  }
  return out;
}

// The AI work behind each route, kept apart from HTTP and auth. Each resolves to
// the response body, or null when the reply came back empty.
export const ai = {
  async title(text){
    const title = (await ask("title", { effort: "low", maxTokens: 2000, prompt:
      "Write a title for this college-essay evidence note: a short, specific, memorable label of 3-6 words that makes the story easy to recognize in a list later. Reply with the title only - no quotes, no ending punctuation.\n\nNote:\n"
      + String(text).slice(0, 4000) })).replace(/^["“]|["”]$/g, "").slice(0, 60);
    return title ? { title } : null;
  },

  async classify(text){
    const out = await ask("classify", { effort: "low", maxTokens: 2000, schema: SCHEMAS.classify, prompt:
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
` + String(text).slice(0, 4000) });
    const cats = [...new Set((out.cats || []).map(Number)
      .filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].slice(0, 3);
    const title = String(out.title || "").trim().replace(/^["“]|["”]$/g, "").slice(0, 60);
    return title || cats.length ? { title, cats } : null;
  },

  async polish(text){
    const out = await ask("polish", { effort: "low", maxTokens: 4000, prompt:
`Lightly polish this college-essay evidence note. Fix grammar and awkward phrasing, tighten wordiness, and keep the writer's natural voice. Keep ALL facts exactly as given — never invent details, names, or embellishment. Plain first person, roughly the same length or shorter. Reply with the polished text only — no preamble, no quotes.

Note:
` + String(text).slice(0, 6000) });
    return out ? { text: out } : null;
  },

  async match(prompt, entries, deep){
    if(!entries.length) return { matches: [] };
    const task = deep
? `First, deconstruct what the prompt is secretly asking for beneath the surface.
Then, work out which college or university this prompt is from, and what that school in particular rewards in an answer to it.
Then, select the matching notes and explain the connection concretely.
Then, write a gap analysis: what is missing from these selected notes to answer the prompt completely.
Finally, generate a structural outline showing how to arrange these specific notes into a narrative arc.`
: `Select the notes and explain the connection concretely: name the specific detail, moment, or theme in the note and the part of the prompt it answers. Never a generic reason that could apply to any note.`;
    const shape = deep
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
    const out = await ask("match", { effort: "medium", maxTokens: deep ? 12000 : 6000,
      schema: deep ? SCHEMAS.deepMatch : SCHEMAS.match, prompt:
`These are a student's evidence notes for college essays. Given the essay prompt, pick the notes that genuinely fit BEST as material for answering it, best first — usually 3-8, fewer if few genuinely fit.

${task}

Address the student as "you" (or use subjectless fragments) — never third person.
In the text you write, refer to notes by their titles, never by their numbers: the student never sees the numbers.

Reply ONLY with JSON:
${shape}

"strong" = answers the prompt as-is. "possible" = works with reframing, or covers only part of the prompt.

Essay prompt:
${prompt}

Notes:
${numbered(entries, 600)}` });
    const matches = picked(out.matches, entries, m => ({
      fit: m.fit === "strong" ? "strong" : "possible", why: String(m.why || "").slice(0, 200) }));
    if(!deep) return { matches };
    // Advice only ships alongside a named school — a confident-sounding line with no
    // school attached is exactly the hallucination the prompt tells it to suppress.
    const college = String(out.college || "").slice(0, 80);
    return {
      deconstruction: String(out.deconstruction || "").slice(0, 300),
      college,
      college_advice: college ? String(out.college_advice || "").slice(0, 300) : "",
      gap_analysis: String(out.gap_analysis || "").slice(0, 400),
      outline: Array.isArray(out.outline) ? out.outline.map(String).slice(0, 5) : [],
      matches
    };
  },

  async search(q, entries){
    if(!entries.length) return { matches: [] };
    const out = await ask("search", { effort: "high", maxTokens: 6000, schema: SCHEMAS.search, prompt:
`These are a student's evidence notes for college essays. The student is searching their library by IDEA, not exact words. Pick the notes genuinely related to the search — by theme, topic, person, place, event, or concept — best first, up to 8. Fewer if few relate; an empty list is a valid answer.

Reply ONLY with JSON: {"matches": [{"i": <note number>, "why": "<the connection, max 12 words, addressing the student as "you" or subjectless — never third person>"}]}

Search:
${q}

Notes:
${numbered(entries, 400)}` });
    return { matches: picked(out.matches, entries, m => ({ why: String(m.why || "").slice(0, 120) })) };
  },
};

export const handler = async (event) => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  // $default catches OPTIONS too; answer 204 so browser CORS preflights succeed
  if(method === "OPTIONS") return { statusCode: 204 };

  // Public: landing-page waitlist signup. EVERY other route below requires auth.
  if(method === "POST" && path === "/waitlist"){
    if((event.body || "").length > 400) return resp(400, { error: "Bad request" });
    let email = "";
    try{ email = String(JSON.parse(event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString() : event.body).email || ""); }
    catch{ return resp(400, { error: "Bad JSON" }); }
    email = email.trim().toLowerCase();
    if(email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      return resp(400, { error: "That doesn't look like an email." });
    // Mirror into Clerk's waitlist so entries can be approved/invited from the
    // Clerk dashboard (instance sign-up mode is "waitlist"). Idempotent on
    // Clerk's side; a failure here must never block the signup itself.
    const mirrorToClerk = async () => {
      if(!process.env.CLERK_SECRET_KEY) return;
      try{
        await fetch("https://api.clerk.com/v1/waitlist_entries", {
          method: "POST",
          headers: { "content-type": "application/json",
            authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
          body: JSON.stringify({ email_address: email }),
          signal: AbortSignal.timeout(3000)
        });
      }catch{}
    };
    // One "waitlist" item holding the whole list (the Lambda role only has
    // Get/Put/Delete). Same optimistic-concurrency pattern as the app state:
    // conditional put on rev, retry once on a concurrent write.
    for(let attempt = 0; attempt < 2; attempt++){
      const d = await db.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: "waitlist" } } }));
      const rev = Number(d.Item?.rev?.N || 0);
      let list = [];
      try{ list = d.Item ? JSON.parse(d.Item.list.S) : []; }catch{}
      const pos = list.findIndex(x => x.email === email);
      if(pos >= 0){
        await mirrorToClerk(); // converge Clerk even if the first mirror failed
        return resp(200, { ok: true, dup: true, position: pos + 1 });
      }
      // size cap so an unauthenticated script can't run up the item
      if(list.length >= 2000) return resp(503, { error: "The waitlist is full for now." });
      list.push({ email, at: new Date().toISOString() });
      try{
        await db.send(new PutItemCommand({ TableName: TABLE,
          Item: { pk: { S: "waitlist" }, rev: { N: String(rev + 1) }, list: { S: JSON.stringify(list) } },
          ConditionExpression: rev ? "#r = :r" : "attribute_not_exists(pk)",
          ...(rev ? { ExpressionAttributeNames: { "#r": "rev" },
                      ExpressionAttributeValues: { ":r": { N: String(rev) } } } : {}) }));
        await mirrorToClerk();
        return resp(200, { ok: true, position: list.length });
      }catch(e){
        if(e.name !== "ConditionalCheckFailedException")
          return resp(500, { error: "That didn't go through. Try again in a moment." });
      }
    }
    return resp(500, { error: "That didn't go through. Try again in a moment." });
  }

  const auth = await verifyClerk((event.headers.authorization || "").replace(/^Bearer /, ""));
  if(!auth) return resp(401, { error: "Not signed in" });
  // Per-account library keys. Owner accounts keep the original item names so
  // the founding data never moves; everyone else is namespaced by user id.
  const isOwner = OWNERS.has(auth.sub);
  const DATA_KEY = isOwner ? "data" : "data#" + auth.sub;
  const BACKUP_PREFIX = isOwner ? "backup#" : "backup#" + auth.sub + "#";

  // Hard cap on raw body before parsing anything — the largest legitimate
  // payload is a 350KB state PUT; nobody needs to send more.
  if((event.body || "").length > 500000) return resp(413, { error: "Too large" });

  let body = null;
  try{
    if(event.body) body = JSON.parse(event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString() : event.body);
  }catch{ return resp(400, { error: "Bad JSON" }); }

  // AI routes spend real money per call; everything else is microcents.
  if(method === "POST" && ["/match", "/search", "/title", "/classify", "/polish"].includes(path)
      && aiBudgetExceeded(auth.sub))
    return resp(429, { error: "Too many AI requests — give it a few minutes." });

  if(method === "GET" && path === "/entries"){
    const d = await db.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: DATA_KEY } } }));
    return resp(200, d.Item ? JSON.parse(d.Item.state.S) : { entries: [], rev: 0, backupRev: 0 });
  }
  if(method === "GET" && path === "/waitlist"){
    if(!isOwner) return resp(403, { error: "Admins only" });
    const d = await db.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: "waitlist" } } }));
    let list = [];
    try{ list = d.Item ? JSON.parse(d.Item.list.S) : []; }catch{}
    return resp(200, { waitlist: list });
  }
  // AI routes. A failure logs one line (never note text) so an outage shows up
  // in CloudWatch instead of silently leaving entries Untitled.
  const AI_FAIL = { "/title": "Title generation failed", "/classify": "Classification failed",
    "/polish": "Polish failed", "/match": "Match failed", "/search": "Search failed" };
  if(method === "POST" && AI_FAIL[path]){
    const library = async () => {
      const d = await db.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: DATA_KEY } } }));
      return (d.Item ? JSON.parse(d.Item.state.S) : {}).entries || [];
    };
    let args;
    if(path === "/match"){
      if(!body || typeof body.prompt !== "string" || body.prompt.trim().length < 4)
        return resp(400, { error: "Bad request" });
      // The breakdown roughly doubles the work, so the client can opt out.
      // Absent flag = on, so an older client keeps its current behaviour.
      args = [body.prompt.slice(0, 2000), await library(), body.deep !== false];
    }else if(path === "/search"){
      if(!body || typeof body.q !== "string" || !body.q.trim())
        return resp(400, { error: "Bad request" });
      args = [body.q.slice(0, 300), await library()];
    }else{
      if(!body || !body.body) return resp(400, { error: "Bad request" });
      args = [body.body];
    }
    try{
      const out = await ai[path.slice(1)](...args);
      return out ? resp(200, out) : resp(502, { error: AI_FAIL[path] });
    }catch(e){
      console.error(JSON.stringify({ aiError: path, status: e?.status, name: e?.name,
        // a JSON parse error's message quotes the reply, which can quote a note
        msg: e?.name === "SyntaxError" ? "" : String(e?.message || "").slice(0, 300) }));
      return resp(502, { error: AI_FAIL[path] });
    }
  }
  if(method === "PUT" && path === "/entries"){
    if(!body || !Array.isArray(body.entries) || !Number.isFinite(body.rev))
      return resp(400, { error: "Bad state" });
    const s = JSON.stringify(body);
    if(s.length > 350000) return resp(413, { error: "Bank too large to sync" });
    // Optimistic concurrency: a PUT whose rev isn't ahead of the stored rev is
    // from a device that hasn't seen the latest state — reject so it can merge.
    const cur = await db.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: DATA_KEY } } }));
    const curState = cur.Item ? JSON.parse(cur.Item.state.S) : null;
    const curRev = curState ? (curState.rev || 0) : 0;
    if(body.rev <= curRev) return resp(409, { error: "stale", rev: curRev });
    // Clients from before tombstone sync (2026-11) neither send nor keep
    // `deleted`, so their whole-state PUT would wipe Recently deleted and every
    // tombstone, or overwrite newer edits. Once a current client has written
    // this library, refuse them: an old tab shows "offline" until it reloads
    // into the current app, whose boot merges its unsynced edits back in.
    const tomb = body.deleted && typeof body.deleted === "object" && !Array.isArray(body.deleted)
      ? body.deleted : null;
    if(curState && curState.deleted && !tomb)
      return resp(409, { error: "stale", rev: curRev });
    // A sync that would wipe half the library is a bug, not an edit. The 409
    // makes the client merge the server's entries back in and re-push the union.
    // Entries the client deliberately deleted (tombstoned) don't count as lost,
    // so a big delete or merge isn't mistaken for a wipe.
    const curEntries = curState ? curState.entries || [] : [];
    const deliberate = tomb ? curEntries.filter(e => e && tomb[e.id]).length : 0;
    if(curEntries.length >= 10 && body.entries.length + deliberate < curEntries.length / 2)
      return resp(409, { error: "stale", rev: curRev });
    // Once per day, snapshot the pre-change state so app-level corruption is a
    // one-item restore. DynamoDB TTL (attribute "ttl", enabled on the table)
    // reaps snapshots after ~15 days. Best-effort — never blocks the save.
    if(cur.Item){
      const day = new Date().toISOString().slice(0, 10);
      try{
        await db.send(new PutItemCommand({ TableName: TABLE,
          Item: { pk: { S: BACKUP_PREFIX + day }, state: cur.Item.state,
            ttl: { N: String(Math.floor(Date.now() / 1000) + 15 * 86400) } },
          ConditionExpression: "attribute_not_exists(pk)" }));
      }catch{ /* today's snapshot already exists */ }
    }
    // Atomic guard: the write lands only if this rev is still ahead of the
    // stored one, so two devices racing the check above can't both win.
    try{
      await db.send(new PutItemCommand({ TableName: TABLE,
        Item: { pk: { S: DATA_KEY }, state: { S: s }, rev: { N: String(body.rev) } },
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

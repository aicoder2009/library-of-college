# Library of College

A personal **college-essay evidence bank**: a place to dump stories, details, and moments as they come to you, then mine them with AI while drafting supplemental essays. The name riffs on the Library of Congress.

Live at [liboc.vercel.app](https://liboc.vercel.app) — account creation is gated by a waitlist; each signed-in user gets their own private library. This repo is public so others can read the code, borrow ideas, or self-host their own instance.

## Why this exists

Supplemental essays ("Why us?", community, leadership…) reward specific, lived details — and those details never surface on demand at the keyboard. LoC splits the problem in two: **capture** (frictionless dumping of raw stories into seven fixed categories) and **retrieval** (paste an essay prompt and let AI find which of your stories actually fit, and why).

## Features

- **Seven fixed categories** matched to how US applications are actually structured: Community/Perspective, Leadership, Why School, Why Major (supplementals), plus Creative, Problem-solver, and My favorite topic (UC PIQs / about-me).
- **Frictionless capture** — a quick-dump modal (`d`), per-category multiline dump bars, and a slide-over composer. AI auto-titles and auto-categorizes dumps (`/title`, `/classify`).
- **Prompt matching** (`/match`) — paste a real essay prompt; the model returns your best-fitting entries labeled *strong* or *possible*, each with a concrete "why", plus an optional **✦ Breakdown**: what the prompt is secretly asking, school-specific advice, a gap analysis, and a suggested outline.
- **⌘K palette with two search modes** — *Verbatim* (literal word-AND fuzzy matching, instant) and *✦ Ideas* (AI semantic search via `/search`, with a one-line "why" per hit).
- **Why School prompt map** — a per-school tracker of prompts, editable in place.
- **Used-in tags** — luggage-tag chips tracking which essay/school each story was spent on.
- **AI polish** (`/polish`) — session-only grammar tidy that never overwrites your raw entry.
- **Warm paper design** — serif reading view, highlighter-stroke headings, full dark-mode parity, all hand-rolled CSS.
- **Data safety** — optimistic-concurrency sync with entry-level merge (no lost writes across devices), daily server-side snapshots kept ~14 days, wipe protection that rejects suspiciously shrinking writes, and DynamoDB point-in-time recovery.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `⌘K` | Command palette (Tab switches Verbatim ⇄ ✦ Ideas) |
| `d` | Quick-dump modal |
| `n` | Composer |
| `/` | Search |
| `↑↓` / `j k` | Review entries |
| `⌘Enter` | Save |
| `Esc` | Cascading close (palette → dump → composer → collapse → tag filter → search) |

## Architecture

Deliberately minimal — no framework, no build step, no bundler:

```
index.html            the public landing page (waitlist signup), served at /
app.html              the entire app in one file, served at /app;
                      only external resource is ClerkJS
backend/index.mjs     one AWS Lambda (Node 20) behind an API Gateway HTTP API
DynamoDB              one table; each account's full library is a single JSON item
                      (waitlist signups in one more)
```

- **Sync model**: the client GETs/PUTs the whole state. Every PUT carries a `rev`; the Lambda rejects stale revs (409), the client then re-fetches, merges by entry id (newer `updatedAt` wins, nothing dropped), and retries. Simple, and safe across devices.
- **Auth**: [Clerk](https://clerk.com) (waitlist sign-up mode). The frontend mounts Clerk's sign-in; the Lambda verifies the RS256 session JWT against the instance JWKS. Any signed-in user gets their own library; `ALLOWED_USER_ID` marks the owner/admin account(s).
- **AI**: OpenAI, called only from the Lambda (the key never ships to the browser). Cheap fast models handle titling/classifying/polish; a reasoning model handles prompt matching and semantic search.
- **localStorage** is only a boot cache — server state always wins.

## Self-hosting

There's no one-command installer; it's a personal tool. But the surface area is small:

1. **DynamoDB**: create a table (any name) with partition key `pk` (string). Enable point-in-time recovery.
2. **Lambda**: deploy `backend/index.mjs` (Node 20) behind an API Gateway HTTP API with routes `GET/PUT /entries`, `POST /title|classify|match|search|polish`, `POST/GET /waitlist`, and `OPTIONS` passthrough. Set env vars: `TABLE`, `CLERK_ISSUER`, `ALLOWED_USER_ID`, `OPENAI_API_KEY`.
3. **Clerk**: create an app, restrict sign-ups, and put your user id(s) in `ALLOWED_USER_ID`.
4. **Frontend**: edit the `API` constant and the hostname-gated `CLERK_LIVE` key block near the top of the `<script>` in `app.html` and `login.html` (and `API` in `index.html` if you keep the landing page), then host everything anywhere static (`vercel deploy --prod`). The `/__clerk` proxy (`api/clerk-proxy.mjs`) is only needed when, like liboc, you can't point a CNAME at Clerk — on your own domain, skip it.

Sanity-check the JS before deploying (there's no test suite):

```sh
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' index.html > /tmp/x.js && node --check /tmp/x.js
node --check backend/index.mjs
```

## Repo layout

| Path | What |
|------|------|
| `index.html` | Public landing page (waitlist) |
| `login.html` | Sign-in page at `/login` |
| `app.html` | The entire app |
| `backend/index.mjs` | The entire API |
| `api/clerk-proxy.mjs` | Vercel edge proxy for Clerk's Frontend API (vercel.app-subdomain workaround) |
| `docs/design-system.md` | Design tokens, components, overlay + responsive rules |
| `tools/genicons.py` | Generates the favicon/app icons and `og-image.png` (Pillow) |
| `sw.js` | Minimal service worker |

## License

[MIT](LICENSE)

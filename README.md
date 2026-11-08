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
- **Essays page** — every prompt you're answering, with its deadline, word limit, and status, sorted by what's due next (the nearest deadline shows in the sidebar). Pick stories per prompt, then **Copy brief** for the prompt plus those stories word for word.
- **Used-in tags** — luggage-tag chips tracking which essay/school each story was spent on.
- **Clip to Library** — a bookmarklet: select text on a college's site, click it, and the composer opens with the passage and its link, filed under Why School.
- **Memory joggers** — specific questions in each category's dump bar and empty state; the quick-dump modal nudges with one from your thinnest category.
- **Recently deleted** — deleted entries wait 30 days before they're gone; **Merge** combines duplicate entries from the bulk bar.
- **Export** — a re-importable backup (entries + prompts), a readable Markdown document grouped by category, or print / save as PDF.
- **AI polish** (`/polish`) — session-only grammar tidy that never overwrites your raw entry.
- **Warm paper design** — serif reading view, highlighter-stroke headings, full dark-mode parity, all hand-rolled CSS.
- **Data safety** — optimistic-concurrency sync where a device that hasn't seen the latest write must merge before it can save (newest edit wins per entry; deletions travel as tombstones so stale copies can't bring them back), daily server-side snapshots kept ~14 days, wipe protection that rejects suspiciously shrinking writes, and DynamoDB point-in-time recovery.

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
backend/index.mjs     one AWS Lambda (Node 24) behind an API Gateway HTTP API
DynamoDB              one table; each account's full library is a single JSON item
                      (waitlist signups in one more)
```

- **Sync model**: the client GETs/PUTs the whole state. Every PUT claims the next `rev` after the one the client last saw; the Lambda rejects stale revs (409), and the client re-fetches, merges by id (newer `updatedAt` wins per entry and prompt; deletions travel as tombstones), and retries. Simple, and safe across devices.
- **Auth**: [Clerk](https://clerk.com) (waitlist sign-up mode). The frontend mounts Clerk's sign-in; the Lambda verifies the RS256 session JWT against the instance JWKS. Any signed-in user gets their own library; `ALLOWED_USER_ID` marks the owner/admin account(s).
- **AI**: Claude, called only from the Lambda, with inference kept in the US. No API key exists anywhere: the Lambda signs in with Workload Identity Federation, trading a short-lived AWS identity token for a short-lived Claude token that the Anthropic SDK refreshes on its own. Claude Opus 5.5 handles titling, sorting, polish, prompt matching and idea search.
- **localStorage** is only a boot cache — server state always wins.

## Self-hosting

There's no one-command installer; it's a personal tool. But the surface area is small:

1. **DynamoDB**: create a table (any name) with partition key `pk` (string). Enable point-in-time recovery, and TTL on attribute `ttl` (reaps the daily backups).
2. **Lambda**: run `npm ci --omit=dev` in `backend/` and deploy a zip of `index.mjs`, `package.json` and `node_modules` (Node 24; the AWS SDK comes with the runtime) behind an API Gateway HTTP API with routes `GET/PUT /entries`, `POST /title|classify|match|search|polish`, `POST/GET /waitlist`, and `OPTIONS` passthrough. Give its role `dynamodb:GetItem/PutItem/DeleteItem` on the table, plus `sts:GetWebIdentityToken` limited to the audience `https://api.anthropic.com` (condition key `sts:IdentityTokenAudience`). Set the env vars listed in [`backend/.env.example`](backend/.env.example). Configure API Gateway CORS with the same origins as `ALLOWED_ORIGINS`.
3. **Claude**: run `aws iam enable-outbound-web-identity-federation` once (it prints your account's token issuer URL). In the Claude Console under Keys & access → Workload identity, register that issuer (OIDC discovery), create a service account, and create a federation rule whose subject is the Lambda role's ARN (exact match), audience `https://api.anthropic.com`, scope `workspace:inference`. Put the rule, organization and service-account IDs in the Lambda env.
4. **Clerk**: create an app, put its Frontend API URL in `CLERK_ISSUER`, and restrict sign-ups (waitlist or allowlist) — anyone who can sign in gets a library and can spend your Claude credits. Optionally list admin user ids in `ALLOWED_USER_ID`.
5. **Frontend**: edit the `API` constant and the hostname-gated `CLERK_LIVE` key block near the top of the `<script>` in `app.html` and `login.html` (and `API` in `index.html` if you keep the landing page); swap the `liboc.vercel.app` URLs in the `<head>` meta tags for your own. Host everything anywhere static (`vercel deploy --prod`). The `/__clerk` proxy (`api/clerk-proxy.mjs`) is only needed when, like liboc, you can't point a CNAME at Clerk — then set `CLERK_PROXY_URL` and `CLERK_SECRET_KEY` in the Vercel env. On your own domain, skip it.

Sanity-check the JS and run the tests before deploying:

```sh
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' index.html > /tmp/x.js && node --check /tmp/x.js
node --check backend/index.mjs
node tests/app.test.mjs   # runs app.html in Node against a fake server — no dependencies
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

## Contributing

Issues and PRs are welcome — read [CONTRIBUTING.md](CONTRIBUTING.md) first. Security issues go through [SECURITY.md](SECURITY.md), not public issues.

## License

[MIT](LICENSE). Not affiliated with the Library of Congress or any college.

# Contributing

Thanks for looking. This is a small personal tool, so the bar is "keep it small."

## Ground rules

- **No build step, no framework, no new dependencies.** Each page is one self-contained HTML file; the only external script is ClerkJS.
- **Keep the design language.** Warm paper palette, serif reading view, sidebar + centered column. Every color needs a dark-mode twin. Tokens live in `docs/design-system/tokens.json` — see `docs/design-system/README.md`.
- **Don't change the data shape casually.** Each library is one JSON item synced with optimistic concurrency; changes must stay backward-compatible with existing libraries.
- **Secrets stay server-side.** OpenAI/Clerk secret keys belong in Lambda/Vercel env vars, never in the frontend or the repo.

## Before opening a PR

There's no test suite yet. CI syntax-checks every inline script; run the same locally:

```sh
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' app.html > /tmp/x.js && node --check /tmp/x.js
node --check backend/index.mjs
```

Then click through the change in a browser (light and dark mode, and a phone-width viewport). For bigger changes, open an issue first so we can agree on the approach.

By contributing you agree your work is released under the [MIT License](LICENSE).

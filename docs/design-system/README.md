# Warm Paper

The design system of Library of College, extracted from the three shipping pages (`index.html`, `login.html`, `app.html`). Every value here is the value the live app uses — nothing was rounded, renamed or idealised on the way in.

It is also published as a browsable design-system artifact with live component previews. The two are kept in sync by hand; this folder is the copy that travels with the code.

## What is here

| Path | What it is |
| --- | --- |
| `brand-book.md` | The written system: the three rules, copy conventions, visual foundations, the category table, iconography, and what deliberately isn't here. **Start here.** |
| `tokens.json` | The source of truth for every token, with a usage note on each. |
| `tokens.css` | Generated from `tokens.json` by `tools/gentokens.py`. Never edit by hand. |
| `components/<Name>/README.md` | Guidelines per component: the real CSS, when to use it, what the consumer provides, and the don'ts. |
| `components/<Name>/preview.html` | A standalone page rendering that component. Open it in a browser; it links `tokens.css` itself. |
| `components/Cover/preview.html` | The system's cover image, built from the luggage-tag silhouette and the category palette. |
| `assets/Marks/` | The product's real icons and Open Graph image, plus the rules for using them. |

## Changing a token

1. Edit `tokens.json`.
2. Run `python3 tools/gentokens.py` to rewrite `tokens.css`.
3. Update the matching `:root` declaration in `index.html`, `login.html` and `app.html`.

Step 3 is not optional and is not automated. The pages keep their tokens inline on purpose — the app loads no external stylesheet, and pulling one in would cost a request before first paint. `tokens.css` is documentation and a starting point for new surfaces, not a file the app ships.

A new color without a dark-theme counterpart is a bug. `c0`–`c6` are the one exception: the seven category pastels are identical in both themes by design.

## Reading a preview

Each preview is a fragment — a `<style>` block, a root element, and a `<link>` to `../../tokens.css`. It has no `<html>` or `<body>` wrapper, so a browser fills those in; that is enough to see the component correctly in both themes. To force a theme, open the file and put `data-theme="dark"` on the root element, or switch your OS appearance.

The published artifact's copies of these files are identical except for the `<link>` line, which the artifact's own frame supplies.

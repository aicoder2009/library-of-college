The `⌘K` overlay: one input, two tabs, a scrolling result list.

```css
.palscrim{position:fixed;inset:0;background:rgba(24,20,14,.35);display:none;z-index:25;
  align-items:flex-start;justify-content:center;padding:12vh 18px;
  backdrop-filter:blur(3px)}
.pal{background:var(--panel);border:1px solid var(--line);border-radius:14px;width:100%;
  max-width:560px;box-shadow:var(--shadow);overflow:hidden;display:flex;flex-direction:column;
  max-height:60vh}
@keyframes palin{from{transform:translateY(-8px) scale(.985);opacity:.5}}
```

It opens 12vh down, drops 8px into place over 0.16s, and caps at 60vh so the page behind it stays visible. `scrim-light` plus a 3px blur; the page is frozen with `html:has(.palscrim.on){overflow:hidden}`.

## The two tabs

- **Verbatim** — literal word-AND text matching, results as you type, matched words bolded in `ink` inside a `muted` snippet.
- **✦ Ideas** — semantic search, which runs only on Enter because it costs a model call. Results come back grouped under `palsec` headings (**Strong fit**, **Possible**) with a one-line reason in place of the snippet.

`Tab` switches between them and the keycap says so, sitting between the tabs and the model name. Anything AI-powered is prefixed `✦` and names its model in `faint` — the app never pretends a model call is instant or free.

## The consumer provides

The query handler per tab, the result rows (title, snippet or reason, category index, word count), and keyboard navigation: `↑↓` moves, Enter opens, Escape closes one layer.

## Rows

`radius-md`, 8px 10px, highlighted with `washon` — the same selected tint as a nav item. An 8px category dot leads; the word count trails in `faint`, tabular. Both title and snippet truncate on one line; the palette never grows a row to fit.

## Don't

Don't add a third tab, don't put actions in the palette (it finds entries, it does not run commands), and don't let it exceed 560px.

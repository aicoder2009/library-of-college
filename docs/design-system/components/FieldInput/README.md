Three text fields, one grammar: `1px solid line`, a `panel` or `bg` ground, and a focus ring that sits *inside* the field.

```css
.search{width:100%;font:inherit;font-size:13.5px;padding:7px 10px;border:1px solid var(--line);
  border-radius:8px;background:var(--panel);color:var(--ink)}
.search:focus{outline:2px solid var(--muted);outline-offset:-1px}
.taginput{font-size:12.5px;padding:3px 8px;border:1px solid var(--line);border-radius:7px;
  background:var(--bg);color:var(--ink);width:170px}
```

`outline-offset: -1px` on inputs, `+1px` on buttons — the ring never grows the field's footprint inside a tight row.

## The three

- **`.search`** — the sidebar filter, `panel` on `side`, `radius-md`, 13.5px. Placeholder in `faint`.
- **`.taginput`** — the inline used-in editor, `bg` on `panel` (it sits inside an open entry, so it inverts), `radius-sm`, 12.5px, 170px wide. Its suggestion popover is `panel` at `radius-lg` with `shadow`, offset 4px below, max 180px tall and scrolling; a "create" row is `muted` italic.
- **Waitlist input** — the landing page's one field: 15px, `11px 14px`, `radius-lg`, 220px minimum so it wraps beside its button instead of squashing.

## The consumer provides

Placeholder text, value, and handlers. Every field must call `stopPropagation` on keydown: single letters are global shortcuts in this app, and a field that lets them through will open a modal mid-word.

## Contrast

Placeholders are `faint`, which is deliberately below 4.5:1 — placeholder text never carries information a user needs. Put the requirement in a `meta` line under the field instead, in `muted` or `faint-text`.

## Don't

Don't float labels, don't put a label inside a field, and don't add a filled variant. A field is a bordered rectangle here.

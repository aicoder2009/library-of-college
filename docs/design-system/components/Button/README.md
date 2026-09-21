The app's only button, in four weights: default, `primary`, `ghost`, `danger`.

All four share one body — `1px solid line`, `panel` ground, `radius-md`, `7px 12px`, 14px — and differ only in how loudly they ask. Hover raises the border to `muted`; active nudges the button down half a pixel. Focus is `2px solid muted` at `outline-offset: 1px`.

```css
button{font:inherit;cursor:pointer;border:1px solid var(--line);background:var(--panel);
  color:var(--ink);border-radius:8px;padding:7px 12px;font-size:14px}
button:hover{border-color:var(--muted)}
button:active{transform:translateY(.5px)}
.primary{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.primary:hover{opacity:.88}
.ghost{border-color:transparent;background:transparent;color:var(--muted)}
.ghost:hover{color:var(--ink);border-color:var(--line)}
.danger:hover{color:var(--warn)}
```

## When to use which

- **`primary`** — the one commitment on the surface. Inverted: `ink` ground, `bg` text. Never two on one surface.
- **default** — everything reversible: Copy, Refile, Add tag.
- **`ghost`** — tools that live in a row and should not compete: Polish, Sign out, palette tabs.
- **`danger`** — carries no color at rest and turns `warn` only on hover, so a delete never shouts from across the page.
- **`.linkbtn`** — an underlined inline button for actions that belong inside a sentence ("Copy all 6"). Not a button shape at all.

`.new`, the sidebar's "New entry", is `primary` at full sidebar width with `radius-lg` and weight 600. It is the only full-width button in the app.

## The consumer provides

The label, and a handler. Buttons take no icons — the app ships no icon set. A button inside an expanded entry drops to 13.5px / `6px 11px`; one inside the bulk bar takes `radius-pill`.

## Don't

Don't add a third size, don't put a category color on a button, and don't animate anything but color and opacity.

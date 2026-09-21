The library's one list item, in its two states: a flat row separated by hairlines, and the same row expanded in place into a card.

This is the layout paradigm of the app. Rows never navigate away and never open a modal — they grow. Everything above and below stays where it was.

## Collapsed

```css
.entry{border-bottom:1px solid var(--line);margin:0 -10px}
.entry:first-child{border-top:1px solid var(--line)}
.entry:not(.open):hover{background:var(--wash)}
.ehead{display:flex;gap:12px;align-items:flex-start;padding:14px 10px;cursor:pointer}
.entry h3{margin:0;font-size:15px;font-weight:600;line-height:1.4}
.entry p.snip{margin:3px 0 0;font-size:13.5px;color:var(--muted);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
```

The negative margin lets the hover tint bleed past the text column so the row feels like a band, not a box. The snippet is clamped to exactly two lines.

## Open

```css
.entry.open{background:var(--panel);border:1px solid var(--line);border-radius:12px;
  margin:8px -18px;box-shadow:var(--lift)}
.entry.open h3{font-family:var(--serif);font-size:19px;line-height:1.35}
.full{white-space:pre-wrap;font-family:var(--serif);font-size:16px;line-height:1.75}
```

Opening does four things at once: the ground becomes `panel`, a border and `radius-xl` appear, the card widens 8px past the column on each side, and **the title switches from sans to serif**. That last change is the one that matters — it tells the writer they are now reading, not scanning.

Body text is `reading`, with `pre-wrap` so the writer's own line breaks survive verbatim. Never reflow what someone typed.

## The right rail

Pinned star and row picker at 0.22 opacity until the row is hovered, selected, or the list is in selecting mode; on a touch device they rest at 0.4 instead, since there is no hover. Word count below them in `faint` at 11px, tabular.

## The consumer provides

Title, body, category indices, used-in tags, timestamps, word count, and handlers for open, pin, select and the action row. An untitled entry renders its title slot in `muted` italic at weight 400.

## Don't

Don't turn a row into a link, don't open an entry in an overlay, and don't add a second line of metadata above the title. Everything secondary lives below the snippet or in the right rail.

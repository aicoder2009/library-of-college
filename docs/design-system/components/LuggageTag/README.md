The used-in tag: a luggage tag with a notched left point and a punched hole, marking which essay or school an entry has already been spent on.

Tags in this app are **not** general labels. A tag answers one question — where did this story get used — so that a writer never reuses the same anecdote across two supplementals without noticing.

```css
.rtag{position:relative;display:inline-flex;align-items:center;gap:5px;
  font-size:11.5px;font-weight:600;color:var(--tagink);background:var(--tagbg);
  padding:3px 9px 3px 15px;
  clip-path:polygon(9px 0,100% 0,100% 100%,9px 100%,0 50%)}
.rtag::before{content:"";position:absolute;left:5.5px;top:50%;transform:translateY(-50%);
  width:4.5px;height:4.5px;border-radius:50%;background:var(--panel)}
```

The hole is a pseudo-element painted in the color of whatever is *behind* the tag, so it reads as a punch-through. On `bg` that is `background: var(--bg)`; on a `panel` row it is `var(--panel)`. Get this wrong and the hole becomes a dot.

## Sizes

- **base** — 11.5px, in a row's tag strip and in the expanded entry's "Used in" line.
- **`.mini`** — 10.5px with a 13px left inset, for dense lists and palette rows.
- **`.htag`** — 14px with a 22px left inset and a 12px notch, used as a view heading when the writer filters by tag. This is the tag standing in for `HighlightHeading`.

`.tagadd` is the companion: a dashed pill that adds one. Dashed because it is an invitation, not a thing.

## The consumer provides

The tag text, which is written by the user, typically `School · Essay`. The first `·` or `,`-separated segment is what the app derives the school from — keep the separator.

## Contrast

`tagink` on `tagbg` is 4.6:1 in light and 7.9:1 in dark. Do not put tag text in `muted` or `faint`; the tag carries its own ink pair.

## Don't

Don't use the tag shape for categories (that is `CategoryChip`), for status, or for anything clickable that is not a filter.

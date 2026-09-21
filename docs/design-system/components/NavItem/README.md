A sidebar row: a dot, a label that truncates, and a count pushed to the right.

```css
.navitem{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:transparent;
  border:none;border-radius:8px;padding:7px 9px;font-size:14px;color:var(--ink)}
.navitem:hover{background:var(--wash)}
.navitem.on{background:var(--washon);font-weight:600}
.navn{margin-left:auto;color:var(--muted);font-size:12px;font-weight:400;padding-left:8px}
.navn.thin{color:var(--warn);opacity:.85;font-weight:600}
```

The item has no border at any state; it is a tinted region, not a card. Hover is `wash`, selected is `washon` plus weight 600. The count is `tabular-nums` so the column of numbers stays aligned as the library grows.

## Thin counts are the notification system

When a category has too few entries to draft from, its count turns `warn` and goes semibold (`.thin`). That recolored number is the only alert in the sidebar — there is no badge, no dot, no banner. Keep it that way.

## Groups

Items sit under `label`-styled group headings in `faint`: **Supplementals** (categories 0–3), **About me · UC PIQs** (4–6), and **Used in** for tag filters, whose dot is the outlined `.tagdot`.

## The consumer provides

The label, the count, the dot color or variant, and the selection handler. Labels come from the fixed category list and from user-authored tags, so the label must be allowed to ellipsis at 256px.

## At phone width

Below 760px the sidebar becomes a horizontally scrolling strip and each item becomes a bordered pill: `1px solid line`, `radius-pill`, `panel` ground, 13px, and the group headings disappear behind thin `navsep` dividers. The scrollbar is hidden. Do not collapse the nav into a hamburger — the categories are the app's spine and stay visible.

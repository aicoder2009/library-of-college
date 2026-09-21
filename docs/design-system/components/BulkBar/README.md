A floating pill that appears 18px from the bottom while rows are selected, holding the count and the actions that apply to all of them.

```css
.bulk{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--panel);
  border:1px solid var(--line);border-radius:999px;padding:7px 8px 7px 16px;display:none;
  gap:8px;align-items:center;box-shadow:var(--shadow);z-index:10;font-size:13.5px;
  white-space:nowrap}
.bulk.on{display:flex}
.bulk button{border-radius:999px;font-size:13.5px}
```

Asymmetric padding — 16px on the left for the count, 8px on the right where the first button's own padding takes over. Every button inside it takes `radius-pill` to match the container.

## The consumer provides

The selected count, and handlers for the actions that make sense in bulk: Refile (mini category chips), add tag, Delete, Clear. It appears and disappears with selection; it is never empty and never disabled.

## Order

Count, then constructive actions, then destructive, then Clear as a `ghost`. Delete is `danger` — no color until hover.

## At phone width

`max-width: calc(100vw - 20px)` and scrolls horizontally with the scrollbar hidden, rather than wrapping. A wrapped pill stops reading as one object.

## Don't

Don't show it while nothing is selected, don't put a category color in it, and don't let it overlap the toast — the toast sits at 76px for exactly this reason.

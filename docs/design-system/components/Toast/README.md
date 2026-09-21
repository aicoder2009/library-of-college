A single inverted pill, centered 76px from the bottom, carrying one sentence and at most one undo.

```css
.toast{position:fixed;bottom:76px;left:50%;transform:translateX(-50%);background:var(--ink);
  color:var(--bg);padding:9px 16px;border-radius:999px;font-size:14px;opacity:0;
  pointer-events:none;transition:.18s;z-index:30;white-space:nowrap}
.toast.on{opacity:1}
.tbtn{border:none;background:none;color:var(--bg);text-decoration:underline;
  font-weight:600;padding:0 0 0 8px}
```

It is `pointer-events: none` except for its undo button, and it fades rather than slides. It sits above the bulk bar's 18px so the two can be on screen together.

## Copy

The toast repeats the verb of the control that caused it, past tense: Save → "Saved", Pin → "Pinned", Delete → "Deleted "<title>"". No punctuation beyond the sentence, no icon, no color — a toast is never red or green, because the only failure state in this app is a stale sync, and that lives in the sidebar instead.

## The consumer provides

The message and, where the action is reversible, an undo handler. One toast at a time; a new one replaces the old.

## At phone width

`max-width: calc(100vw - 28px)` with ellipsis. Keep the message short enough that it does not need it.

## Don't

Don't stack toasts, don't use one for a question, and don't put two actions in it.

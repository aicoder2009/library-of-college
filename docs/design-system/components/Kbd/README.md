A keycap: a mono glyph on `panel` with a doubled bottom border, so it reads as a physical key without a shadow.

```css
.kbd{display:inline-block;border:1px solid var(--line);border-bottom-width:2px;
  border-radius:4px;padding:0 4.5px;font-size:10.5px;line-height:1.55;
  background:var(--panel);color:var(--muted)}
```

The 2px bottom border is the whole trick — it gives depth in both themes with no shadow token spent.

Two sizes: 10.5px in the sidebar hint line, and 12px with `min-width: 20px` and `radius: 5px` in running copy on the landing page, where keycaps appear inside sentences and need to hold their shape around a single character.

## The shortcuts this app defines

`⌘K` palette · `d` dump modal · `n` composer · `/` search · `↑↓` or `j/k` review · `⌘↵` save · `Esc` backs out one layer (palette → dump → composer → collapse → tag filter → search).

Because single letters are shortcuts, every text field in the app must stop propagation — a stray keystroke over the page opens a modal.

## The consumer provides

The key name as text. Use the real glyphs (`⌘`, `↵`, `↑↓`, `Esc`), not spelled-out words, and never an image.

## Don't

Don't put a keycap on a button — the shortcut belongs in the hint line or in prose, not inside the control it triggers.

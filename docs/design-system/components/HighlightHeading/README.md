A heading with a highlighter stroke drawn through the bottom of its line box, in the category's own color.

This is the signature mark of the system and the source of the product's icon. It is a gradient, not a background fill, so the words sit *on* the paper with a stroke over them rather than inside a colored box.

```css
.hl{background:linear-gradient(transparent 60%,var(--hc) 0);padding:0 3px;margin:0 -3px}
@media (prefers-color-scheme: dark){
  .hl{background:linear-gradient(transparent calc(100% - 3px),var(--hc) 0)}
}
```

The negative margin cancels the padding so the stroke over-runs the text by 3px on each side, the way a real marker would, without shifting the layout.

## The consumer provides

`--hc`, the stroke color, set inline on the element: `style="--hc:var(--c2)"`. It is always one of `c0`–`c6`. The heading itself is `view-heading` (serif 26px / 600), and the subtitle beneath it is `snippet` in `muted`, capped at `measure-sub`.

## Both themes

In light the stroke fills the bottom 40% of the line box. In dark that same wash over pale type reads as a smudge, so the rule flips to a 3px underline at the baseline — same color, same token, different geometry. Keep both rules; a single-geometry version looks wrong in one theme or the other.

## Don't

Don't stroke body text, a button, or more than one phrase per view. Don't use it with a color outside `c0`–`c6`. On the landing page the same class strokes exactly one letter of the wordmark, at `padding: 0 2px` — that is the only other permitted use.

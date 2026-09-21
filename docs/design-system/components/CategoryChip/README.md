A pill that files an entry into one of the seven categories, off by default and filled with the category's own color when on.

```css
.chip{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;
  padding:5px 12px;font-size:13px;font-weight:600;background:transparent;color:var(--muted)}
.chip:hover{border-color:var(--muted);color:var(--ink)}
.chip[data-c="0"]{--cc:var(--c0)} /* … through data-c="6" */
.chip.on{background:var(--cc);border-color:transparent;color:#241d12}
@media (prefers-color-scheme: dark){
  .chip.on{background:color-mix(in srgb,var(--cc) 16%,transparent);color:var(--cc);
    border-color:color-mix(in srgb,var(--cc) 40%,transparent)}
}
```

## Both themes, two different fills

Light: the pastel is the ground and `cat-ink` (#241d12) is the text — 9:1 or better on every one of the seven. Dark: the same pastel at full strength would glare, so the chip inverts to a 16% tint with the hue itself as the text and a 40% border. Both states must exist; a chip that only implements the light fill is unreadable on the dark ground.

## The consumer provides

A `data-c` index from 0 to 6, the category label, and the toggle handler. Chips are grouped under `chiplab` headings that mirror the sidebar's two groups, Supplementals and About me · UC PIQs.

`.mini` (11.5px / `3px 9px`) is the refile variant, used in the bulk bar and under an expanded entry where the chips sit inline with other controls.

## When to use

Only for the seven fixed categories, and only where the writer is *choosing*. To display a category that is already set, use `CategoryDot` with its name — chips are controls, dots are statements.

## Don't

Don't build a chip for a used-in tag; that shape is `LuggageTag`. Don't add an eighth category.

A dashed, transparent textarea that sits at the bottom of every category view and takes one detail per line.

```css
.quickadd{width:100%;font:inherit;font-size:14px;line-height:1.55;padding:9px 12px;
  margin-top:16px;border:1px dashed var(--line);border-radius:9px;background:transparent;
  color:var(--ink);resize:none;overflow:hidden;display:block}
.quickadd:hover{border-color:var(--faint)}
.quickadd::placeholder{color:var(--faint)}
.quickadd:focus{outline:none;border-color:var(--muted);border-style:solid;background:var(--panel)}
```

Dashed and transparent at rest, solid and `panel` on focus. The border style is the state: **dashed means a space waiting to be filled, solid means a thing that exists.** The same convention marks the `+ tag` button and the polished-text card.

It auto-grows (`overflow: hidden`, height set from `scrollHeight`) and never scrolls internally, so the writer always sees everything they have typed.

## The consumer provides

The target category, a per-line save handler, and placeholder text naming that category. Lines are saved as separate entries — this is a dump bar, not a composer.

## The polished card

`.polished` is the read-only sibling: a dashed `radius-lg` box on `bg` holding AI-tidied text in serif at 15px / 1.7, under a `label` heading with an inline `linkbtn` to accept it. It is session-only and never saved unless the writer replaces the original. Anything the AI produced is marked with `✦` and stays visually provisional.

## Don't

Don't use a dashed border for anything that already has content, and don't give the quick-add a Save button — Enter files the line, Escape leaves.

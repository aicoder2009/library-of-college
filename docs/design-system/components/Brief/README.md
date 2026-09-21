The AI breakdown card: a `wash`-tinted block with `radius-xl` and no border, holding headings, paragraphs and lists the model returned.

```css
.mbrief{margin:12px 2px 16px;padding:14px 16px;background:var(--wash);
  border-radius:12px;font-size:13.5px}
.mbrief h4{margin:0 0 6px;font-size:13.5px;font-weight:600;color:var(--ink)}
.mbrief p{margin:0 0 14px;color:var(--muted);line-height:1.55}
.mbrief ul{margin:0 0 14px;padding-left:22px;color:var(--muted);line-height:1.55}
.mbrief>:last-child{margin-bottom:0}
```

Headings are the same 13.5px as the body and separate by weight and color alone. The whole card is one step down in contrast from the writer's own text, which is the point: **what the model says is never allowed to look more finished than what the writer wrote.**

## The consumer provides

The prompt, the model's sections — deconstruction, what the library covers, gap analysis, outline — and, where a school was identified from the prompt's own wording, its name and school-specific advice. When the school is uncertain the field comes back empty and no advice ships; never guess a school into this card.

## Marking AI output

Every AI surface in the app is prefixed `✦` and, where it costs a call, names the model in `faint`. Reasons and gaps are set in `prompt` (italic serif) because the app is quoting a judgment, not asserting a fact.

## Don't

Don't give this card a border or a shadow, don't put a category color in it, and don't let it precede the writer's own entries in a result list — matches come first, the brief explains them.

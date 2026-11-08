A memory jogger: one specific question that shakes a story loose. Each category has six, written to be answerable in a sentence — "When did you take charge without the title?", not "Describe your leadership."

## Where they appear

- **The quick-add placeholder.** The category's dump bar shows one question instead of "Add to …" (the category name moves to the `title` tooltip). It rotates after each quick add and on each category switch — never per render, so it doesn't change under the writer mid-thought.
- **Empty states.** A category with nothing in it lists three as buttons; clicking one makes it the dump bar's question and focuses the bar.
- **The quick-dump modal.** Its placeholder ends with "Need a nudge?" and a question from whichever category has the fewest stories.

```css
.jogs{display:flex;flex-direction:column;align-items:flex-start;gap:6px;margin-top:12px}
.jog{border:1px dashed var(--line);background:none;color:var(--muted);font-family:var(--serif);
  font-style:italic;font-size:14.5px;text-align:left;border-radius:9px;padding:6px 12px}
.jog:hover{color:var(--ink);border-color:var(--muted)}
```

Dashed, because a jogger is an invitation to put something in the box — the same meaning the dashed border has everywhere. Serif italic, because it is a question in the writer's voice, not a UI label.

## The consumer provides

The category index, and a focus target for the answer (the quick-add bar). The questions are fixed copy; nothing is generated.

## Don't

Don't show joggers next to entries that already exist, don't phrase them as essay prompts, and don't rotate them on a timer.

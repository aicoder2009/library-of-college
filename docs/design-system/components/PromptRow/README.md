One essay prompt on the Essays page — the entry row's sibling. It uses the same `.entry` row and the same expand-in-place card, so the Essays page reads like every other page in the library. Rows sit soonest-deadline first; done prompts sink to the bottom.

## Collapsed

The school is the title, followed by a status label; the prompt text is the two-line snippet; one muted line gives the deadline, the word limit and how many stories are picked. Days left sit where an entry shows its word count.

```css
.pstat{font:700 10.5px/1 ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif;letter-spacing:.07em;
  text-transform:uppercase;color:var(--faint);vertical-align:2px;margin-left:6px;white-space:nowrap}
.pstat.drafting{color:var(--star)}
.pstat.done{color:var(--muted)}
.prow.done:not(.open){opacity:.6}
.pdays{font-size:11px;color:var(--faint);white-space:nowrap;font-variant-numeric:tabular-nums}
.pdays.soon{color:var(--warn);font-weight:600}
```

The status label is set in the `label` style, not as a chip: it is information, not a control. Days left turn `warn` and semibold within a week of the deadline (or once it has passed) — the same recolored-number signal as a thin category count. There is no badge.

## Open

The prompt in serif, then three fields in a row — **Deadline** (a native date input), **Word limit** and **Status** — then the picked stories, then actions: **Copy brief** (primary), **⌕ find evidence**, **Edit prompt**, and on the right **Remove** (`danger`) and **Collapse**.

```css
.pfields{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;margin-top:16px}
.pinput{font:inherit;font-size:13.5px;padding:6px 9px;border:1px solid var(--line);border-radius:7px;
  background:var(--bg);color:var(--ink);width:100%;min-width:0}
.chip.pstatbtn.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.ppick{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line)}
```

Status uses mini chips, but the selected one is `ink` on `bg` rather than a category color — statuses aren't categories. Field edits save in place without re-rendering the row, so the date picker keeps focus.

## The story picker

`＋ pick stories` (a dashed `tagadd`) opens an inline filter: a `pinput` over a scrolling `bg` list of stories, filtered by every typed word. Each option shows ＋ or ✓; stories already tagged with the prompt's school come first, wearing a mini luggage tag. Picking a story also adds that school's used-in tag. Enter picks the top unpicked match; Escape closes.

## The consumer provides

The prompt (`q`, `sch`, optional `due`, `limit`, `status`, `picks`), the list of stories, and handlers for each field. Prompts saved before the Essays page existed have only `q` and `sch` — render them as undated, limitless and "To do".

## Don't

Don't open a prompt in a modal or a separate screen, don't color statuses with category pastels, and don't turn days-left into a badge or a banner.

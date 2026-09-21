The design language of **Library of College**, a college-essay evidence bank: a warm paper surface, a serif reading column, and a small set of hand-cut marks (a highlighter stroke, a luggage tag, a colored dot) that carry meaning the text alone would not.

It is extracted verbatim from the product's three single-file pages — `index.html`, `login.html`, `app.html` — which ship with no build step, no framework and no external stylesheet. Every value here is the value the live app uses.

## The idea

The app is a place to keep the raw material of an essay: a story, a detail, an overheard line. So the surface behaves like paper that has been worked on. Text is warm-black on warm-white, hairlines separate rather than shadows, and the two pieces of real ornament — a highlighter stroke and a tag — are things a writer would actually do to paper.

Three rules hold the whole system together:

1. **Reading is serif, operating is sans.** A title in a list is `ui-title` (sans, 15px). The same title once the entry is open is `entry-title` (serif, 19px), and its body is `reading` (serif, 16px / 1.75). The typeface change is the mode change.
2. **Borders separate, shadow floats.** Use `line` for every division. Spend `lift` only on an entry that expanded in place, and `shadow` only on something that genuinely sits above the page: the palette, the composer, the toast.
3. **Color is categorical, never decorative.** `c0` through `c6` are seven fixed category identities with fixed indices. `warn` and `star` are the only other hues, and each means one thing.

## Content fundamentals

- **Second person, present tense, low ceremony.** "Drop it here and keep going." Not "Your entry has been successfully saved."
- **A control says exactly what happens, and the toast repeats the verb.** "Save" → "Saved." "Pin" → "Pinned." A toast may carry one undo affordance and nothing else.
- **Prompts are quoted, not asserted.** Anything the app is echoing back — a school's prompt, the AI's reason a story fits — is set in `prompt` (italic serif). Anything the app is claiming is sans.
- **Counts are plain numbers, never badges.** `12`, set in `muted` at the end of a nav row. Where a category is running thin, the same number turns `warn` and goes semibold. That recoloring is the whole notification system.
- **Empty states name the next action in the writer's words**, capped at 44ch: "Nothing here yet. Press `n` and start with the smallest true detail."
- **No emoji in product copy.** The one exception is the lock screen's single glyph above the sign-in card.
- **Sentence case everywhere.** Uppercase belongs only to the `label` and `brand` type styles, and it is applied in CSS with `text-transform`, never typed.

## Visual foundations

**Grounds.** `bg` is the page. `panel` is anything lifted off it — an open entry, an input, the palette. `side` is the sidebar and any full-bleed band that should recede. In the dark theme `panel` sits *above* `bg` and `side` sits *below* it; keep that relationship rather than inverting lightness mechanically.

**Text.** `ink` for anything a reader must read. `muted` for supporting copy at 12.5px and up. `faint` is for markers only — micro-labels, word counts, placeholders, a resting star — because it does not reach 4.5:1 on `bg` in either theme. If a sentence matters, it is `muted` or `ink`. On the landing page, fine print uses `faint-text`, which is the readable cousin of `faint`.

**Hover and selection.** Tint with `wash` on hover and `washon` when selected. Never move a row, never change its type weight on hover; the active nav item earns weight 600, hover does not.

**Borders.** `1px solid line`, always. A dashed `line` border marks a field that is optional and waiting — the quick-add bar, the "add tag" button, the polished-text card. Dashed means "you may put something here"; solid means "this exists".

**Focus.** `2px solid muted` with `outline-offset: 1px` on buttons and links, `-1px` on inputs so the ring sits inside the field. It is the same ring everywhere, and it is never removed.

**Radius.** Scale with the surface: `radius-md` for controls, `radius-xl` for an expanded entry, `radius-2xl` for an overlay, `radius-pill` for anything floating over the page (toast, bulk bar, switch).

**Motion.** Two animations exist, both under 0.2s: the composer slides 48px in from the right, the palette drops 8px and settles. Hover transitions are 0.12–0.15s on color and opacity only. Everything is disabled under `prefers-reduced-motion: reduce`. Do not add more.

**Layout.** A 256px sidebar and a reading column centered at `measure-read` (660px) with `space-8` side padding. Under 760px the sidebar becomes a horizontally scrolling strip of pill nav items and the column drops to 18px padding. The app has no cards-in-a-grid and no columns — rows expand in place, and overlays come from the edge. Do not introduce a kanban board or stacked sections; both were tried and rejected.

## Category color

Seven fixed indices, fixed colors, fixed names. An entry can hold several, but only where each genuinely fits.

| Index | Token | Name | Group |
| --- | --- | --- | --- |
| 0 | `c0` | Community/Perspective | Supplementals |
| 1 | `c1` | Leadership | Supplementals |
| 2 | `c2` | Why School | Supplementals |
| 3 | `c3` | Why Major | Supplementals |
| 4 | `c4` | Creative | About me · UC PIQs |
| 5 | `c5` | Problem-solver | About me · UC PIQs |
| 6 | `c6` | My favorite topic | About me · UC PIQs |

The seven are pastels of roughly equal lightness, so they read as a set rather than a ranking and none of them competes with `ink`. They are identical in both themes. Because they are too light to carry text, a category never appears as colored type: it appears as a 9px dot (`CategoryDot`), as a chip fill with `cat-ink` on top (`CategoryChip`), or as the highlighter stroke behind a heading (`HighlightHeading`). In the dark theme a selected chip inverts instead — the hue becomes the text on a 16% tint of itself — because `cat-ink` on a pastel would glare.

## Iconography

There is none, and that is a decision. The app ships no icon font, no SVG sprite and no external requests. Meaning is carried by three drawn marks instead:

- **The dot** — a 9px circle in a category color, the app's entire iconography for "what kind of story is this".
- **The highlighter stroke** — a linear gradient that fills the bottom 40% of a heading's line box, as if drawn over the words. In dark mode it thins to a 3px underline, because a translucent wash over dark type reads as a smudge.
- **The luggage tag** — a `clip-path` polygon with a notched left point and a punched hole, used for used-in tags. It is the only shape in the system that is not a rectangle or a circle.

Where a glyph is genuinely needed, use a text character in the current color: `★` for pinned, `✦` for AI features, `·` for separators, `⌘` in keycaps.

## Assets

`assets/Marks/` holds the product's real icons and social image, generated by `tools/genicons.py` in the repository: a bold serif "L" behind an orange highlighter stripe, the same gesture as `HighlightHeading`. The mark is raster PNG at five sizes plus the 1200×630 Open Graph image. There is no vector master and no SVG logo — if the wordmark changes, the generator is rerun rather than the files hand-edited.

## Typefaces

All three families are system stacks; the system ships no font files and loads nothing from a font host. `serif` resolves to Iowan Old Style on Apple platforms and Georgia elsewhere, which is why the reading column looks like a book on a Mac and like a broadsheet on Windows. That variance is accepted in exchange for zero network cost. If you build a surface that must match across platforms, state it and pick a webfont deliberately — do not assume the stack resolves the same way twice.

## Not synced

- **No component bundle.** The product is vanilla HTML and CSS with no exported components, so this system ships no `bundle.js` and no types. Each preview below is a live rendition built from the app's own CSS rules, copied verbatim; the rule text in each component's guidelines is the source of truth to copy from.
- **No font files**, by design (system stacks only).
- **No spacing scale.** The values in `spacing` are the ones that recur in the source, not a grid the source was built on.
- Source: `aicoder2009/library-of-college`, branch `claude/design-system-extraction-k5xij0`, from `index.html`, `login.html` and `app.html` at commit `1d2e8be`.

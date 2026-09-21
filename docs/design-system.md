# Library of College — Design System

> **See also [`design-system/`](design-system/)** — the extracted system as files: `tokens.json` and a generated `tokens.css`, a brand book, and fifteen components with live previews. That folder is the machine-readable form; this document is the prose reference for how the pages are actually built.

Documentation of the visual language and UI components in [index.html](../index.html) (the entire frontend — single file, no build step, no framework). All styles live in the one `<style>` block; there are no external stylesheets and no utility framework. This document records what exists — established conventions from CLAUDE.md apply: don't relitigate them.

## Principles

1. **Warm paper, not app-gray.** The palette reads like good paper stock — cream backgrounds, warm ink, muted category pastels. Nothing is pure white, pure black, or cool gray.
2. **Full dark-mode parity.** Every color is a CSS variable, and every variable that needs it is redefined under `@media (prefers-color-scheme: dark)`. A new color without a dark counterpart is a bug.
3. **Serif for reading, sans for chrome.** Entry bodies, view headings, open-entry titles, and the composer title use `--serif`; all UI chrome uses the system sans stack.
4. **Layout paradigm is locked.** Sidebar nav + centered reading column, expand-in-place entry rows, slide-over composer. Kanban boards and stacked-section layouts were explicitly rejected — do not reintroduce them.
5. **Semantic tokens only.** Components reference `--ink`/`--muted`/`--line`/etc., never raw hex. The only hardcoded colors are the token definitions themselves plus two intentional literals (scrim overlays, light-mode `.chip.on` text `#241d12`).

## Design Tokens

### Color

Defined on `:root`, overridden in the dark block. Category colors `--c0`–`--c6` are **not** overridden — the same pastels serve both modes (dark mode adapts them per-component, see Chips).

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#faf8f3` | `#191712` | Page background |
| `--panel` | `#fffdf8` | `#211e18` | Cards, modals, buttons, inputs |
| `--ink` | `#221f1a` | `#ede8dd` | Primary text; also fill of primary buttons/toast |
| `--muted` | `#756e64` | `#a29a8b` | Secondary text, hints, focus outlines |
| `--faint` | `#aca397` | `#6f695e` | Tertiary text, placeholders, idle icons |
| `--line` | `#e6e0d4` | `#322e26` | All borders and separators |
| `--side` | `#f3efe6` | `#141310` | Sidebar background (matches `theme-color` meta) |
| `--wash` | `rgba(34,31,26,.045)` | `rgba(237,232,221,.05)` | Hover fill |
| `--washon` | `rgba(34,31,26,.09)` | `rgba(237,232,221,.1)` | Selected/active fill |
| `--warn` | `#c2410c` | `#fb923c` | Destructive hover, warnings, lock errors |
| `--star` | `#c9922e` | `#e0b34c` | Pinned star |
| `--tagbg` | `#eadfc6` | `#35301f` | Luggage-tag fill, text selection |
| `--tagink` | `#6d5f42` | `#c9b988` | Luggage-tag text |
| `--c0`–`--c6` | see below | (same) | Category colors |

Category colors are fixed indices — index, name, and color never change:

| Token | Hex | Category | Sidebar group |
|---|---|---|---|
| `--c0` | `#f3b97a` | Community/Perspective | Supplementals |
| `--c1` | `#ef9a9a` | Leadership | Supplementals |
| `--c2` | `#b7d7a8` | Why School | Supplementals |
| `--c3` | `#a4c2ce` | Why Major | Supplementals |
| `--c4` | `#c7b5d8` | Creative | About me · UC PIQs |
| `--c5` | `#e9d47f` | Problem-solver | About me · UC PIQs |
| `--c6` | `#9dcfc3` | My favorite topic | About me · UC PIQs |

Two locally-scoped color vars: `--hc` (set inline per category heading, consumed by `.hl`) and `--cc` (set by `.chip[data-c]` rules, consumed by `.chip.on`).

### Typography

| Use | Stack | Size / line-height |
|---|---|---|
| Body / UI chrome | `ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif` | 15px / 1.5 |
| Reading & display | `--serif`: `ui-serif,"Iowan Old Style",Georgia,"Times New Roman",serif` | — |
| View heading `#viewhead h2` | serif | 26px, 600, `-.01em`, `text-wrap:balance` |
| Open-entry title | serif | 19px |
| Entry body `.full` | serif | 16px / 1.75, `pre-wrap` |
| Composer title | serif | 21px, 600 |
| Row title `h3` | sans | 15px, 600 |
| Snippets/hints | sans | 12–13.5px, `--muted`/`--faint` |
| Section labels (`.navgroup`, `.picklab`, `.chiplab`, `.palsec`, `.pollab`, `.paltab`) | sans | 10.5–12.5px, 700, uppercase, letter-spacing `.07–.09em` |

Counters (`.ewc`, `.navn`, `#cwc`, `.palhint`) use `font-variant-numeric: tabular-nums`.

### Radius

No formal scale — an observed ladder, roughly "bigger surface, bigger radius":

- **4px** `.kbd` · **6px** menu items (`.tagsug`, `.paltab`) · **7px** `.taginput` · **8px** buttons, nav items, list rows, search · **9px** `.new`, `.quickadd`, `.tagsugs` · **10px** `.piqguide`, `.polished` · **12px** `.entry.open`, `.mbrief` · **14px** modals (`.pal`, `.dumpbox`) · **999px** pills (`.chip`, `.tagadd`, `.bulk`, `.toast`)

### Spacing

There is no spacing scale; values are hand-tuned per component (gaps mostly 2–12px, paddings 7–30px). Match neighboring components rather than inventing a grid.

### Elevation

| Token | Light | Dark | Use |
|---|---|---|---|
| `--shadow` | `0 18px 50px rgba(30,25,15,.22)` | `0 18px 50px rgba(0,0,0,.5)` | Overlays: composer, palette, modals, bulk bar, tag suggestions |
| `--lift` | `0 8px 28px rgba(30,25,15,.08)` | `0 8px 28px rgba(0,0,0,.4)` | Open entry card |

### Motion

Short and functional; everything is disabled or reduced under `prefers-reduced-motion: reduce`.

| Duration | Use |
|---|---|
| `.12s` | Star / rowpick opacity fade-in |
| `.16s` | Palette pop-in (`palin`: translateY −8px + scale .985 + fade) |
| `.18s` | Toast fade |
| `.2s` | Composer slide-in (`slidein`: translateX 48px + fade) |
| `.5px` translateY | `button:active` press |

## Components

### Buttons

Base `button`: `--panel` fill, `--line` 1px border, radius 8px, 14px text, padding 7px 12px; hover moves border to `--muted`; active nudges down .5px.

| Variant | Look | Use |
|---|---|---|
| `.primary` | Inverted: `--ink` fill, `--bg` text | The one main action per surface (Save, File it, Find evidence) |
| `.ghost` | No border/fill, `--muted` text | Secondary toolbar actions (Export, Sign out) |
| `.danger` | Base look; text turns `--warn` on hover | Delete |
| `.linkbtn` | Bare underlined text | Inline actions in prose |
| `.new` | `.primary` styling at radius 9px, full-width | Sidebar "+ New entry" |

Focus: `:focus-visible` gets a 2px `--muted` outline (buttons and nav items).

### `.hl` — highlighter heading

The signature mark: a category-colored highlighter stroke behind serif heading text, via `linear-gradient(transparent 60%, var(--hc) 0)`. **Dark mode deliberately changes the geometry** — a 3px underline (`calc(100% - 3px)`) instead of a half-height stroke, because pastel fills would overwhelm dark text. The icon set (`tools/genicons.py`) riffs on this same mark.

### `.rtag` — luggage-tag chip

The "used-in" tracker (which essay/school an entry served — not general labels). Shape is a `clip-path` pentagon with a punched hole (`::before` dot matching the surface behind it). Fill `--tagbg`, text `--tagink`, 600 weight.

| Variant | Size | Use |
|---|---|---|
| base | 11.5px | Row tags, used-in lists |
| `.mini` | 10.5px | Match results (hole matches `--bg`) |
| `.htag` | 14px | Tag-view heading (bigger notch and hole) |

Clickable tags carry `[data-tag]` and darken slightly on hover (`filter:brightness(.96)`). Companions: `.tagx` remove button, `.tagadd` dashed pill, `.taginput` + `.tagsugs` dropdown (panel, `--shadow`, `[data-create]` row in muted italic).

### `.chip` — category picker

Pill (radius 999px) with `--line` border and muted text. `[data-c="0"–"6"]` sets `--cc` to the category color.

- **Light `.on`**: solid `--cc` fill, borderless, fixed dark text `#241d12` (readable on every pastel).
- **Dark `.on`**: `color-mix(in srgb, var(--cc) 16%, transparent)` fill, 40% border, text in `--cc` itself — a tinted outline instead of a solid pastel slab. This is the canonical pattern for using category colors in dark mode.
- `.mini`: 11.5px re-file variant inside open entries.

### Sidebar navigation

`.navitem`: borderless full-width row, radius 8px; hover `--wash`, active `.on` `--washon` + 600 weight. Leading `.cdot` (9px category dot; `.tagdot` outlined variant for tags; `.dump` textual glyph). Trailing `.navn` count in tabular figures — `.thin` counts turn `--warn` when a category is running low. `.navgroup` labels use the uppercase-label style. On mobile the same items restyle into bordered pill chips (see Responsive).

### Entry row (the core list object)

| State | Look |
|---|---|
| Collapsed | Borderless row between `--line` hairlines; sans 15px title + 2-line clamped snippet (`.snip`, search hits bolded in `--ink`); category dots + names; word count `.ewc` |
| Hover | `--wash` fill; star and rowpick fade from 22% to full opacity (always 40% on touch via `@media (hover:none)`) |
| `.sel` (bulk-selected) | `--wash` fill; `.rowpick` circle fills `--ink` with a `--bg` checkmark; bulk bar appears |
| `.open` (expanded in place) | Becomes a `--panel` card: 1px border, radius 12px, `--lift` shadow, negative margins so it outgrows the list; title switches to serif 19px; body `.full` serif 16px/1.75; `.eacts` action row under a hairline; `.polished` dashed inset for AI-tidied text |

`.star` (pin) turns `--star` when on. `.quickadd` is the per-category dashed dump bar — dashed border goes solid + `--panel` fill on focus.

### `.kbd`

Keycap: 1px `--line` border with 2px bottom edge, radius 4px, 10.5px `--muted` on `--panel`. Used in the sidebar hint and palette.

### Toast & bulk bar

Both fixed, bottom-centered, pill-shaped. `.toast`: inverted (`--ink` fill, `--bg` text), fades in/out, optional underlined `.tbtn` action (e.g. Undo). `.bulk`: `--panel` pill with `--shadow`, appears when rows are selected (Copy as one block / Tag / Clear).

## Overlay Patterns

Two scrim systems, both `rgba(24,20,14,…)` + 3px backdrop blur, both freezing page scroll via `html:has(.scrim.on,.palscrim.on){overflow:hidden}`:

- **`.scrim`** (z-20, 45% dark) hosts the composer, dump, and match modals.
- **`.palscrim`** (z-25, 35% dark) hosts the ⌘K palette, so it can layer above a modal.

| Surface | Shape | Notes |
|---|---|---|
| Composer `#composer .compose` | Right slide-over, max 480px, full height | Borderless serif title input over a hairline; flexing body textarea; category chips; `⌘Enter` save |
| ⌘K palette `.pal` | Top-centered card, max 560px, radius 14px, max-height 60vh | Two tabs (`Verbatim` literal word-AND / `✦ Ideas` AI semantic via `/search`), Tab key switches; `.palitem` rows with `.on` keyboard highlight |
| Quick dump `#dump .dumpbox` | Top-centered card, max 620px, radius 14px | Bare textarea + "File it"; AI titles and categorizes |
| Match `#matchModal .matchbox` | Dump-box variant, max 640px, scrollable | Prompt textarea, `.matchitem` results with italic `.matchwhy` lines, `.mbrief` wash-filled breakdown card |
| Touch ID lock `.lockscrim` | Full-screen `--bg` (z-60) | Serif card hosting the Clerk mount |

Escape cascade (established order): palette → dump → composer → collapse open entry → tag filter → search.

AI-feature hint copy names the model in a `.hint` line (e.g. "GPT-4.1 nano titles it…", "GPT-5.6 Sol picks your best-fitting stories").

## Keyboard & Accessibility

- Shortcuts: `⌘K` palette, `d` dump, `n` composer, `/` search, `↑↓`/`j`/`k` walk entries; on an open entry `e` edit, `c` copy, `u` used-in, `s` star; `Esc` cascade above. `.kbonly` elements hide on mobile.
- `:focus-visible` outlines on buttons/nav; inputs get a 2px `--muted` inset outline on focus.
- `prefers-reduced-motion` kills the slide/pop animations and transitions.
- `@media (hover:none)` keeps hover-revealed controls (star, rowpick) permanently visible at 40%.
- `::selection` uses `--tagbg`/`--ink`.

## Responsive (breakpoint: 760px)

Single breakpoint. The sidebar becomes a top bar: nav flips to a horizontally-scrolling row of pill chips (group labels hidden, thin `.navsep` dividers instead), "+ New entry" shrinks to inline, search flexes into the footer row, keyboard hints disappear. Reading column padding tightens, the composer goes full-width, open-entry negative margins shrink, and bulk bar/toast clamp to the viewport.

## Extending the system

When adding UI: define any new color as a `:root` token **with a dark override**, reuse the existing type/label styles, pick a radius from the observed ladder, use `--wash`/`--washon` for hover/selected states, `--shadow` for overlays and `--lift` for in-flow cards, and route category color through `--c0`–`--c6` (with the dark-mode `color-mix` treatment for fills). Verify with the standard `awk`/`node --check` snippet from CLAUDE.md before deploying.

A small toggle whose label is part of the control: 26×15 track, 11px knob, and text that goes from `muted` to `ink` when on.

```css
.switch{display:inline-flex;align-items:center;gap:7px;border:none;background:none;
  padding:2px 0;color:var(--muted);font-size:12.5px;font-weight:600}
.swtrack{width:26px;height:15px;border-radius:999px;border:1px solid var(--line);
  background:var(--wash);display:inline-flex;align-items:center;padding:1px;
  box-sizing:content-box;transition:background .15s,border-color .15s}
.swknob{width:11px;height:11px;border-radius:50%;background:var(--muted);
  transition:transform .15s,background .15s}
.switch[aria-checked="true"]{color:var(--ink)}
.switch[aria-checked="true"] .swtrack{background:var(--ink);border-color:var(--ink)}
.switch[aria-checked="true"] .swknob{transform:translateX(11px);background:var(--bg)}
```

Two signals change together — the track fills with `ink` and the label darkens — so the state is readable without relying on the 26px track alone.

## The consumer provides

`role="switch"` and `aria-checked` (the CSS keys off the attribute, so the accessible state and the visual state cannot drift), the label, and a handler. `box-sizing: content-box` on the track is load-bearing: the 1px padding is what gives the knob its inset.

## Where it is used

The ✦ Breakdown toggle on prompt matching, which decides whether a match request also returns a deconstruction, gap analysis and outline. It is on by default and costs a slower model call when on, so the label says what it adds, not "Advanced".

## Don't

Don't use it without a text label, don't put it in a form of several toggles (this app has one), and don't color the track with a category hue.

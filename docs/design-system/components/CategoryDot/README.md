A filled circle in a category color. It is the entire iconography of the app.

```css
.cdot{flex:none;width:9px;height:9px;border-radius:50%}   /* sidebar */
.dot{flex:none;width:7px;height:7px;border-radius:50%}    /* beside a title */
.ecat .dot{width:6px;height:6px}                          /* in a category caption */
```

Three sizes, each tied to a place: 9px in the sidebar and palette, 7px in the `.dots` cluster after an entry title, 6px beside a named category under a row. An entry in three categories shows three 7px dots with a 4px gap — that cluster is how a writer sees at a glance that a story is doing triple duty.

`.tagdot` is the variant for a used-in tag in the nav: `tagbg` fill with a 1.5px `tagink` ring, 8px, so a tag filter reads as an outline where a category reads as a solid.

## The consumer provides

The color, inline: `style="background:var(--c3)"`, always one of `c0`–`c6` by index. The mapping of index to meaning is fixed and listed in the brand book; do not renumber it.

## Accessibility

A dot is never the only signal. Every dot in the app sits beside its category name, or inside a row whose text already says what it is. Never use a dot alone to encode state.

## Don't

Don't outline a category dot, don't scale it past 10px, and don't introduce a second shape (square, diamond) for a different meaning — add a word instead.

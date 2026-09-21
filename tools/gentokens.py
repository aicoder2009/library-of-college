#!/usr/bin/env python3
"""Compile docs/design-system/tokens.json into docs/design-system/tokens.css.

tokens.json is the source of truth for the Warm Paper design system; this
script is the only thing that writes tokens.css. Run it from anywhere:

    python3 tools/gentokens.py
"""
import json, io, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = ROOT / "docs/design-system/tokens.json"
t = json.loads(src.read_text())
out = io.StringIO()
w = out.write

w("""/* Warm Paper — the design tokens of Library of College.
 *
 * GENERATED from docs/design-system/tokens.json. Edit that file, then rerun
 *   python3 tools/gentokens.py
 *
 * This file is documentation and a starting point for new surfaces. The three
 * shipping pages (index.html, login.html, app.html) keep their own inline
 * :root blocks on purpose: the app loads no external stylesheet, and adding
 * one here would cost a request on first paint. When a token changes, change
 * tokens.json and the inline blocks together.
 *
 * Themes: light (Paper) is the base. Dark (Lamplight) applies when the OS asks
 * for it, unless the document opts out with data-theme="light", and always
 * when the document sets data-theme="dark".
 */
""")

colors = t["color"]["tokens"]
themes = [th["id"] for th in t["color"]["themes"]]
first = themes[0]

def val(tok, theme):
    v = tok["value"]
    if isinstance(v, str):
        return v
    return v.get(theme, v.get(first))

def block(theme, families, indent=""):
    lines = []
    for tok in families:
        v = val(tok, theme)
        lines.append(f"{indent}  --{tok['name']}: {v};")
    return "\n".join(lines)

def themed(theme, indent=""):
    parts = [f"{indent}  /* Color */", block(theme, colors, indent)]
    parts.append(f"{indent}  /* Shadow */")
    parts.append(block(theme, t["shadow"]["tokens"], indent))
    return "\n".join(parts)

w("\n:root,\n:root[data-theme=\"light\"] {\n")
w(themed("light"))
w("\n}\n")

# only tokens that actually differ in dark
def differs(tok):
    v = tok["value"]
    return isinstance(v, dict) and v.get("dark") and v.get("dark") != v.get("light")

dark_tokens = [tk for tk in colors if differs(tk)]
dark_shadows = [tk for tk in t["shadow"]["tokens"] if differs(tk)]

def dark_body(indent=""):
    s = [f"{indent}  /* Color */", block("dark", dark_tokens, indent),
         f"{indent}  /* Shadow */", block("dark", dark_shadows, indent)]
    return "\n".join(s)

w("\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme=\"light\"]) {\n")
w(dark_body("  "))
w("\n  }\n}\n")

w("\n:root[data-theme=\"dark\"] {\n")
w(dark_body())
w("\n}\n")

w("\n:root {\n  /* Typeface stacks */\n")
for k, v in t["type"]["families"].items():
    w(f"  --font-{k}: {v};\n")
w("\n  /* Spacing — the values that recur in the source, not an arithmetic scale */\n")
for tok in t["spacing"]["tokens"]:
    w(f"  --{tok['name']}: {tok['value']};\n")
w("\n  /* Radius */\n")
for tok in t["radius"]["tokens"]:
    w(f"  --{tok['name']}: {tok['value']};\n")
w("}\n")

w("\n/* Type styles. Each class sets a complete text style; pair it with a color\n   token yourself, since the same style is used in ink, muted and faint. */\n")
for g in t["type"]["groups"]:
    fam = g["family"]
    w(f"\n/* {g['name']} */\n")
    for s in g["styles"]:
        w(f".{s['name']} {{\n")
        w(f"  font-family: var(--font-{s.get('family', fam)});\n")
        w(f"  font-size: {s['fontSize']};\n")
        lh = s.get("lineHeight")
        if lh is not None:
            w(f"  line-height: {lh};\n")
        if "fontWeight" in s:
            w(f"  font-weight: {s['fontWeight']};\n")
        if "letterSpacing" in s:
            w(f"  letter-spacing: {s['letterSpacing']};\n")
        if "fontStyle" in s:
            w(f"  font-style: {s['fontStyle']};\n")
        if s["name"] in ("label", "brand"):
            w("  text-transform: uppercase;\n")
        w("}\n")

dest = ROOT / "docs/design-system/tokens.css"
dest.write_text(out.getvalue())
print(f"wrote {dest.relative_to(ROOT)} ({len(out.getvalue())} bytes)")

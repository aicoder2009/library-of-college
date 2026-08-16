from PIL import Image, ImageDraw, ImageFont
import os

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEORGIA = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
GEORGIA_REG = "/System/Library/Fonts/Supplemental/Georgia.ttf"

# Sample exact palette from the existing icon
src = Image.open(f"{ROOT}/icon-192.png").convert("RGB")
BG = src.getpixel((5, 5))
# stripe: scan a row for the most orange pixel; letter: darkest pixel
stripe, letter = BG, BG
for y in range(src.height):
    for x in range(0, src.width, 3):
        p = src.getpixel((x, y))
        if p[0] - p[2] > 40 and p[0] > 180:
            stripe = p
        if sum(p) < sum(letter):
            letter = p
print("bg", BG, "stripe", stripe, "letter", letter)

def letter_icon(size, path):
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(GEORGIA, int(size * 0.78))
    bb = d.textbbox((0, 0), "L", font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    x, y = (size - w) / 2 - bb[0], (size - h) / 2 - bb[1]
    # stripe behind the letter, horizontal band ~28% tall, slightly above center
    sh = int(size * 0.28)
    sy = int(size * 0.30)
    d.rectangle([int(size * 0.08), sy, int(size * 0.92), sy + sh], fill=stripe)
    d.text((x, y), "L", font=f, fill=letter)
    img.save(path)
    print("wrote", path, img.size)

for name, size in [("favicon-32.png", 32), ("favicon-48.png", 48),
                   ("icon-192.png", 192), ("icon-512.png", 512)]:
    letter_icon(size, f"{ROOT}/{name}")

ats = Image.open(f"{ROOT}/apple-touch-icon.png").size[0]
letter_icon(ats, f"{ROOT}/apple-touch-icon.png")

# og-image 1200x630, mirroring the old layout: L-mark left, wordmark with
# highlight stripe + underline, gray tagline below
W, H = Image.open(f"{ROOT}/og-image.png").size
img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

fm = ImageFont.truetype(GEORGIA, 150)
bb = d.textbbox((0, 0), "L", font=fm)
mw, mh = bb[2] - bb[0], bb[3] - bb[1]
mx, my = 165, 290 - mh // 2
d.rectangle([mx - 35, my + mh * 0.30, mx + mw + 35, my + mh * 0.62], fill=stripe)
d.text((mx - bb[0], my - bb[1]), "L", font=fm, fill=letter)

# wordmark sized to fit
text = "Library of College"
fs = 110
while True:
    fw = ImageFont.truetype(GEORGIA, fs)
    bb = d.textbbox((0, 0), text, font=fw)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    if tw <= W - 420:
        break
    fs -= 4
tx, ty = 370, 290 - th // 2
d.rectangle([tx - 8, ty + th * 0.72, tx + tw + 8, ty + th * 1.08], fill=stripe)
d.text((tx - bb[0], ty - bb[1]), text, font=fw, fill=letter)
d.rectangle([tx - 8, ty + th * 0.98, tx + tw + 8, ty + th * 1.06], fill=letter)

tag = "Where the stories live until the essay needs them"
ts = 40
while True:
    ft = ImageFont.truetype(GEORGIA_REG, ts)
    bb = d.textbbox((0, 0), tag, font=ft)
    if bb[2] - bb[0] <= W - tx - 70:
        break
    ts -= 2
d.text((tx, ty + th + 65 - bb[1]), tag, font=ft, fill=(122, 112, 100))
img.save(f"{ROOT}/og-image.png")
print("wrote og-image.png", img.size)

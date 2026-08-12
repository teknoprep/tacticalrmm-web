#!/usr/bin/env python3
"""Generate the BlueCloud RMM favicon: a white T on the brand's circles.

Design constraints, all of them driven by the fact that a favicon is displayed at 16px:

  * BRIGHT. The earlier favicon was the website logo shrunk down, which is white on
    transparent -- so on a light tab strip it was very nearly invisible. Baby blue discs
    give it a solid, high-contrast silhouette on both light and dark browser themes.
  * The T is drawn from RECTANGLES, not set in a font. Any glyph turns to mush at 16px;
    a geometric T stays a T. Proportions are deliberately chunky for the same reason.
  * Three overlapping discs, echoing the cloud built from arcs in the website mark, rather
    than a new shape invented for the icon.
  * Each disc gets a slightly darker rim, so the edge is still defined against white.
  * Drawn at 512px and downsampled, which antialiases far better than drawing at 16.

Re-run after changing the palette:

    python3 src/branding/make-favicon.py

Writes assets/favicon.ico (6 sizes) and assets/favicon-preview.png for eyeballing.
Remember public/favicon.ico is a copy -- `npm run brand:sync` refreshes it.
"""
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))

BABY = (125, 223, 255, 255)    # #7DDFFF - lighter tint of the brand cyan
BABY_RIM = (0, 174, 227, 255)  # #00AEE3 - deeper tint, edge definition
WHITE = (255, 255, 255, 255)
SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def build():
    n = 512
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def circ(cx, cy, r, fill):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)

    cluster = [(180, 300, 150), (332, 300, 150), (256, 205, 150)]
    for cx, cy, r in cluster:
        circ(cx, cy, r, BABY_RIM)
    for cx, cy, r in cluster:
        circ(cx, cy, r - 13, BABY)

    bar_w, bar_h, stem_w, stem_h = 268, 62, 74, 168
    cx, top = 256, 172
    d.rounded_rectangle([cx - bar_w // 2, top, cx + bar_w // 2, top + bar_h],
                        radius=13, fill=WHITE)
    d.rounded_rectangle([cx - stem_w // 2, top + bar_h - 5,
                         cx + stem_w // 2, top + bar_h + stem_h],
                        radius=13, fill=WHITE)
    return img.resize((256, 256), Image.LANCZOS)


if __name__ == "__main__":
    out = build()
    ico = os.path.join(HERE, "assets", "favicon.ico")
    out.save(ico, format="ICO", sizes=SIZES)
    out.save(os.path.join(HERE, "assets", "favicon-preview.png"))
    print("wrote %s (%s)" % (ico, ", ".join("%dx%d" % s for s in SIZES)))

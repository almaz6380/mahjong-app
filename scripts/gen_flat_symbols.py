#!/usr/bin/env python3
"""Erzeugt die FLACHEN Board-Stein-Symbole (src/assets/flat/*.webp).

Fette, kräftig gefärbte CJK-Zeichen (WenQuanYi Zen Hei) auf transparentem
Hintergrund, auf Inhalt gecroppt. Werden von src/ui/StoneTile.tsx (`boardMotif`)
als Deckflächen-Motiv der Solitaire-Board-Steine genutzt — KEINE Runtime-Font
nötig, weil vorgerendert. Pin/Sou werden NICHT hier erzeugt (flache SVG in StoneTile).

Aufruf (venv mit Pillow):  .venv-img/bin/python scripts/gen_flat_symbols.py
Font:  /usr/share/fonts/truetype/wqy/wqy-zenhei.ttc  (Debian: fonts-wqy-zenhei)
"""
from PIL import Image, ImageDraw, ImageFont
import numpy as np, os

FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
OUT = "src/assets/flat"
RED, GREEN, BLUE, BLACK = "#c0392b", "#1e7a44", "#1f4e9c", "#232323"


def font(sz):
    return ImageFont.truetype(FONT, sz, index=0)


def crop(im):
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > 8)
    if len(xs) == 0:
        return im
    pad = 6
    return im.crop((max(xs.min() - pad, 0), max(ys.min() - pad, 0),
                    min(xs.max() + pad + 1, im.width), min(ys.max() + pad + 1, im.height)))


def glyph(ch, color, sz=240):
    im = Image.new("RGBA", (sz * 2, sz * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = font(sz)
    d.text((sz, sz), ch, font=f, fill=color, anchor="mm")
    for dx, dy in [(-2, 0), (2, 0), (0, -2), (0, 2)]:   # leichte Fettung
        d.text((sz + dx, sz + dy), ch, font=f, fill=color, anchor="mm")
    return crop(im)


def save(im, name):
    im.save(f"{OUT}/{name}.webp", "WEBP", lossless=True, quality=100)
    print(" ", name, im.size)


def main():
    os.makedirs(OUT, exist_ok=True)
    # Man: Ziffer (blau) oben + 萬 (rot) unten -> ein Hochformat-Bild
    digits = "一二三四五六七八九"
    wan = glyph("萬", RED, 230)
    for i, dg in enumerate(digits, 1):
        top = glyph(dg, BLUE, 220)
        W = max(top.width, wan.width) + 20
        H = top.height + wan.height + 30
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        canvas.alpha_composite(top, ((W - top.width) // 2, 6))
        canvas.alpha_composite(wan, ((W - wan.width) // 2, top.height + 20))
        save(crop(canvas), f"m{i}")
    for ch, name in [("東", "e"), ("南", "s"), ("西", "w"), ("北", "n")]:
        save(glyph(ch, BLACK, 300), f"wind-{name}")
    save(glyph("中", RED, 320), "zhong")
    save(glyph("發", GREEN, 300), "fa")
    for ch, name in [("梅", "plum"), ("蘭", "orchid"), ("菊", "chrys"), ("竹", "bamboo")]:
        save(glyph(ch, GREEN, 300), f"flower-{name}")
    for ch, name in [("春", "spring"), ("夏", "summer"), ("秋", "autumn"), ("冬", "winter")]:
        save(glyph(ch, BLUE, 300), f"season-{name}")
    print("done")


if __name__ == "__main__":
    main()

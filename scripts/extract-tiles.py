#!/usr/bin/env python3
"""Freistellen von Gemini-Motiven für die Board-Steine.

Zwei Betriebsarten:
  1. Magenta-Key (Standard): Motiv liegt auf reinem Magenta #FF00FF.
     python extract-tiles.py magenta <eingabe.png> <ausgabe.webp>
  2. Glyph-Lift: farbige Glyphe (Jade/Gold) von einer Elfenbein-Steinfläche
     heben; optionaler Crop-Bereich (relativ 0..1) grenzt die Glyphe ein.
     python extract-tiles.py glyph <eingabe.png> <ausgabe.webp> [x0 y0 x1 y1]

Ausgabe: WebP mit Alpha, auf Silhouette gecroppt, längste Seite 320 px.
Benötigt venv mit Pillow + numpy (siehe CLAUDE.md, Bild-Extraktions-Pipeline).
"""
import sys
import numpy as np
from PIL import Image

MAX_SIDE = 320
QUALITY = 82


def finish(img_rgba: np.ndarray, out_path: str) -> None:
    """Auf Alpha-Silhouette croppen (+2 % Rand), skalieren, als WebP speichern."""
    alpha = img_rgba[:, :, 3]
    ys, xs = np.where(alpha > 8)
    if len(xs) == 0:
        raise SystemExit('Kein Motiv gefunden (Alpha überall 0).')
    pad_x = int((xs.max() - xs.min()) * 0.02) + 2
    pad_y = int((ys.max() - ys.min()) * 0.02) + 2
    x0, x1 = max(0, xs.min() - pad_x), min(img_rgba.shape[1], xs.max() + pad_x)
    y0, y1 = max(0, ys.min() - pad_y), min(img_rgba.shape[0], ys.max() + pad_y)
    out = Image.fromarray(img_rgba[y0:y1, x0:x1], 'RGBA')
    out.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    out.save(out_path, 'WEBP', quality=QUALITY)
    print(f'{out_path}: {out.size[0]}x{out.size[1]}')


def extract_magenta(src: str, dst: str) -> None:
    """Alpha = wie stark sich ein Pixel vom Magenta-Hintergrund abhebt."""
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.int16)
    r, g, b = im[:, :, 0], im[:, :, 1], im[:, :, 2]
    # Magenta: R und B hoch, G niedrig -> min(R,B) - G ist dort stark positiv.
    key = np.minimum(r, b) - g
    alpha = np.clip((80 - key) * 4, 0, 255).astype(np.uint8)
    # Farbstich austreiben („spill suppression"). Alpha allein reicht nicht:
    # Halbdurchsichtige Stellen — Glas, weiche Kanten, Leuchtsäume — behalten
    # den Magenta-Ton des Hintergrunds und schimmern später überall rosa.
    # Grün auf min(R,B) anzuheben macht genau diese Pixel neutral und lässt die
    # Motivfarben in Ruhe: Elfenbein, Jade und Gold haben alle G >= min(R,B),
    # nur Magenta liegt darunter. (Ein violettes Motiv wäre die Ausnahme — dann
    # diesen Schritt abschalten, nicht die Schwelle verbiegen.)
    im[:, :, 1] = np.maximum(g, np.minimum(r, b))
    rgba = np.dstack([im.astype(np.uint8), alpha])
    finish(rgba, dst)


def extract_glyph(src: str, dst: str, box=None) -> None:
    """Alpha = Sättigungs-/Farbabstand von der cremefarbenen Steinfläche."""
    img = Image.open(src).convert('RGB')
    w, h = img.size
    if box:
        x0, y0, x1, y1 = (int(float(v) * (w if i % 2 == 0 else h)) for i, v in enumerate(box))
        img = img.crop((x0, y0, x1, y1))
    im = np.asarray(img).astype(np.float32)
    r, g, b = im[:, :, 0], im[:, :, 1], im[:, :, 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = (mx - mn) / np.maximum(mx, 1)  # 0..1
    # Elfenbein ist hell & entsättigt (Maserung bis ~0.3); Jade/Gold kräftig gesättigt.
    alpha = np.clip((sat - 0.33) * 1100, 0, 255).astype(np.uint8)
    # Magenta-Reste (falls Bildrand im Crop) hart ausblenden.
    alpha[np.minimum(r, b) - g > 60] = 0
    # Despeckle: morphologisches Öffnen entfernt einzelne Maserungs-Pixel.
    from PIL import ImageFilter
    a_img = Image.fromarray(alpha, 'L').filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    alpha = np.asarray(a_img)
    rgba = np.dstack([im.astype(np.uint8), alpha])
    finish(rgba, dst)


if __name__ == '__main__':
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    mode, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    if mode == 'magenta':
        extract_magenta(src, dst)
    elif mode == 'glyph':
        extract_glyph(src, dst, sys.argv[4:8] if len(sys.argv) >= 8 else None)
    else:
        raise SystemExit(f'Unbekannter Modus: {mode}')

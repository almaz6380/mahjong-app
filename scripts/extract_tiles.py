#!/usr/bin/env python3
"""Freistell-Pipeline für Gemini-Stein-Symbole (Winde/Drachen).

Vorgabe: ein Symbol pro Bild auf reinem Magenta (#FF00FF).
Verfahren:
  1. Magenta-Key  key = min(R,B) - G   (Magenta gross, Symbol klein/negativ)
  2. weiche Alpha-Rampe zwischen LOW/HIGH (saubere Anti-Aliasing-Kante)
  3. nur die groesste zusammenhaengende Flaeche behalten
     -> Funkel-Sternchen & Schlagschatten-Reste fliegen raus
  4. Magenta-Despill an den Halbtransparenz-Kanten
  5. auf Silhouette croppen (+ kleiner Rand), als WebP mit Alpha speichern

Aufruf:
  python extract_tiles.py <IN.png> <OUT.webp>
  python extract_tiles.py <in_ordner> <out_ordner>   # Batch (alle Bilder)
  python extract_tiles.py --blank <IN.png> <OUT.webp>  # einfarbiger Blankostein

--blank: Freistellung fuer den einfarbigen Elfenbein-Blankostein. Anders als bei
Symbolen wird ueber key = B - G gekeyt (Magenta UND sein eingebackener Kontakt-
schatten haben viel Blau, Elfenbein nicht), Gruen-Despill + staerkere Erosion
gegen den Randsaum, und der Ton wird auf ein mittleres Elfenbein vereinheitlicht
(Luminanz bleibt -> Glanz/Maserung erhalten, Farbe einfarbig).
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

LOW, HIGH = 45, 120      # key < LOW -> voll opak, key > HIGH -> voll transparent
ERODE = 9                # Kante um ~4px einschrumpfen (sauber, kein Farbsaum)
PAD_FRAC = 0.04          # Rand um die Silhouette (Anteil der laengeren Kante)


def extract(in_path: str, out_path: str) -> None:
    img = Image.open(in_path).convert("RGB")
    arr = np.asarray(img).astype(np.float32)
    R, G, B = arr[..., 0], arr[..., 1], arr[..., 2]

    key = np.minimum(R, B) - G                       # Magenta gross, Symbol klein
    alpha = np.clip((HIGH - key) / (HIGH - LOW), 0, 1)  # 1=Symbol, 0=Hintergrund

    # Fremdblobs (Funkel-Sternchen) verwerfen, ABER alle echten Zeichenteile
    # behalten: Zeichen wie 北/發 bestehen aus mehreren getrennten Strichgruppen.
    # Regel: alles kleiner als STRAY_FRAC der groessten Flaeche fliegt raus.
    STRAY_FRAC = 0.05
    solid = alpha > 0.5
    labels, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
        cutoff = sizes.max() * STRAY_FRAC
        for lbl, sz in enumerate(sizes, start=1):
            if sz < cutoff:
                alpha[labels == lbl] = 0.0

    # Kante einschrumpfen: der Gold->Magenta-Uebergang erzeugt orange/rote
    # Pixel, die der Key faelschlich behaelt -> duennen Randring wegerodieren,
    # danach leicht glaetten fuer saubere Anti-Aliasing-Kante.
    alpha = ndimage.grey_erosion(alpha, size=ERODE)
    alpha = ndimage.gaussian_filter(alpha, sigma=0.8)

    # Magenta-Entkontaminierung (Un-Multiply): beobachtete Farbe
    #   C = a*F + (1-a)*BG   mit BG = reines Magenta (255,0,255)
    # -> echte Vordergrundfarbe  F = (C - (1-a)*BG) / a
    # entfernt den rosa Saum an den weichen Kanten sauber.
    BG = np.array([255.0, 0.0, 255.0], dtype=np.float32)
    a = alpha[..., None]
    safe = np.maximum(a, 1e-3)
    F = (arr - (1.0 - a) * BG) / safe
    out = np.clip(F, 0, 255)

    rgba = np.dstack([out, alpha * 255.0]).astype(np.uint8)

    # auf Silhouette croppen
    ys, xs = np.where(alpha > 0.05)
    if len(xs):
        pad = int(max(arr.shape[:2]) * PAD_FRAC)
        y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, arr.shape[0])
        x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, arr.shape[1])
        rgba = rgba[y0:y1, x0:x1]

    Image.fromarray(rgba, "RGBA").save(out_path, "WEBP", lossless=True, quality=100)
    h, w = rgba.shape[:2]
    print(f"  {os.path.basename(in_path)} -> {os.path.basename(out_path)}  ({w}x{h})")


def extract_blank(in_path: str, out_path: str) -> None:
    """Einfarbiger Elfenbein-Blankostein: B-G-Key, Gruen-Despill, Vereinheitlichung."""
    img = Image.open(in_path).convert("RGB")
    arr = np.asarray(img).astype(np.float32)
    R, G, B = arr[..., 0], arr[..., 1], arr[..., 2]

    key = B - G                                   # Magenta/Schatten: Blau >> Gruen
    alpha = np.clip((45.0 - key) / (45.0 - 10.0), 0, 1)

    solid = alpha > 0.5
    labels, n = ndimage.label(solid)
    if n > 1:                                     # nur der Stein, Schatten-Blob raus
        sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
        keep = int(np.argmax(sizes)) + 1
        alpha[labels != keep] = 0.0
    alpha = ndimage.grey_erosion(alpha, size=9)   # gruenen Saum ganz weg
    alpha = ndimage.gaussian_filter(alpha, sigma=0.8)

    out = arr.copy()
    out[..., 1] = np.minimum(out[..., 1], np.maximum(out[..., 0], out[..., 2]))  # Gruen-Despill
    m = alpha > 0.6
    mean = out[m].mean(0)
    lum = (0.299 * out[..., 0] + 0.587 * out[..., 1] + 0.114 * out[..., 2]) / 255.0
    target = mean / (0.299 * mean[0] + 0.587 * mean[1] + 0.114 * mean[2])
    out = np.clip(lum[..., None] * target * 255.0 * 0.5 + out * 0.5, 0, 255)     # einfarbig

    rgba = np.dstack([out, alpha * 255.0]).astype(np.uint8)
    ys, xs = np.where(alpha > 0.05)
    if len(xs):
        pad = 0  # randlos: Silhouette fuellt die Bounding-Box -> keine Filz-Luecken
        y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, arr.shape[0])
        x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, arr.shape[1])
        rgba = rgba[y0:y1, x0:x1]
    Image.fromarray(rgba, "RGBA").save(out_path, "WEBP", lossless=True, quality=100)
    h, w = rgba.shape[:2]
    print(f"  [blank] {os.path.basename(in_path)} -> {os.path.basename(out_path)}  ({w}x{h})")


def main() -> None:
    if len(sys.argv) == 4 and sys.argv[1] == "--blank":
        extract_blank(sys.argv[2], sys.argv[3]); return
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    exts = (".png", ".jpg", ".jpeg", ".webp")
    if os.path.isdir(src):
        os.makedirs(dst, exist_ok=True)
        for f in sorted(os.listdir(src)):
            if f.lower().endswith(exts):
                stem = os.path.splitext(f)[0]
                extract(os.path.join(src, f), os.path.join(dst, stem + ".webp"))
    else:
        extract(src, dst)


if __name__ == "__main__":
    main()

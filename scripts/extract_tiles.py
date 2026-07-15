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
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

LOW, HIGH = 45, 120      # key < LOW -> voll opak, key > HIGH -> voll transparent
PAD_FRAC = 0.04          # Rand um die Silhouette (Anteil der laengeren Kante)


def extract(in_path: str, out_path: str) -> None:
    img = Image.open(in_path).convert("RGB")
    arr = np.asarray(img).astype(np.float32)
    R, G, B = arr[..., 0], arr[..., 1], arr[..., 2]

    key = np.minimum(R, B) - G                       # Magenta gross, Symbol klein
    alpha = np.clip((HIGH - key) / (HIGH - LOW), 0, 1)  # 1=Symbol, 0=Hintergrund

    # nur die groesste zusammenhaengende Flaeche (Symbol) behalten
    solid = alpha > 0.5
    labels, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
        keep = int(np.argmax(sizes)) + 1
        biggest = labels == keep
        # kleine Fremdblobs (Sternchen) komplett verwerfen
        stray = solid & ~biggest
        alpha[stray] = 0.0

    # Magenta-Despill: an halbtransparenten Kanten R/B Richtung G ziehen
    edge = (alpha > 0.02) & (alpha < 0.98)
    out = arr.copy()
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    r[edge] = np.minimum(r[edge], np.maximum(g[edge], b[edge]))
    b[edge] = np.minimum(b[edge], np.maximum(g[edge], r[edge]))

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


def main() -> None:
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

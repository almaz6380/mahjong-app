# Gemini-Roh-Designs der Mahjong-Steine

Original-Gemini-Bilder (PNG) + Zwischen-webp der Stein-Motive, die zu den
freigestellten Assets in `src/assets/*.webp` verarbeitet wurden. Hier gesichert,
damit sie **cross-session** (nach Repo-Klon) verfügbar bleiben — der frühere
Arbeitsordner `gemini-in/` ist gitignored und nur im Session-Container.

## Inhalt
- `wind-{e,s,w,n}.png` — Winde 東南西北
- `dragon-{green,white}.png` — Drachen 發 / 白 (roter Drache 中 = `src/assets/symbol-zhong.webp`)
- `wan-batch/wan-{1..9}.png` — Zahlen 一萬…九萬
- `blockb/` — Pin (Kreise) + Sou (Bambus/Vogel)
- `blockc/` — Blumen 梅蘭菊竹 + Jahreszeiten 春夏秋冬 (PNG + webp)
- `bonus/` — Mythen 龍鳳麒龜 + Schätze (Laterne/Fächer/Münze/Knoten) (PNG + webp)

Nicht enthalten: die reinen Prozess-Ausgaben `wan-out/`, `blockb-out/` (identisch
zu den finalen `src/assets/`-webp).

## Verarbeitung
Freistellung via `scripts/extract_tiles.py` (venv `.venv-img`, Pillow/numpy/scipy),
Magenta-Key `min(R,B)-G`. Rezepte/Details siehe `CLAUDE.md`.
Gemini-Vorgabe: ein Stein pro Bild auf reinem Magenta `#FF00FF`.

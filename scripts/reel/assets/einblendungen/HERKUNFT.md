# Herkunft: Einblendungen im Mahjong-Reel

**Auftrag Josef, 24./25.09.2026:** „Bei mahjong sollen die einblendungen von dem
kleinen jungen, dem opa, wie der junge den tempel raufgeht und die steine auch
abwechselnd etc eingebaut werden" → „neu bauen".

| Datei | Motiv | Seed |
|---|---|---|
| `junge.jpg` | kleiner Junge, rote Jacke, hält jubelnd einen Stein hoch | 8103 |
| `opa.jpg` | Großvater mit weißem Bart am Spieltisch | 8201 |
| `tempel.jpg` | der Junge (von hinten, klein) steigt die Treppe zur Pagode hinauf | 8301 |
| `steine.jpg` | Steine auf dem Holztisch, Kiefernzweig, Laterne | 8401 |

- **Modell:** `fal-ai/flux-pro/v1.1-ultra`, 9:16, je 0,06 $ (5 Bilder erzeugt, 0,30 $).
- **Prompts:** `scripts/reel/einblendungen-erzeugen.mjs` (Stil: Tuschmalerei,
  Jade/Petrol mit Goldakzent, wie `src/assets/home-temple.webp`).
- **Verworfen:** Junge mit Seed 8101. Die KI hatte oben rechts erfundene
  Schriftzeichen samt Siegelstempeln gemalt.
- **Auf 1080 px Breite verkleinert.** Kleine Siegelstempel in den unteren Ecken schneidet
  `make-reel.mjs` beim Zuschnitt weg (`crop=iw*0.88:ih*0.88:iw*0.06:ih*0.03`).

⚠ **Gemalt, nicht realistisch → KEIN AI-Plättchen** (Josef, 26.09.2026: „ki
wasserzeichen nur wenn realistische personen sichtbar sind"). Bis dahin trugen Junge, Opa
und Tempel das Plättchen. Das Beiblatt meldet jetzt `ki-figur (gemalte Einblendungen …, kein
Plättchen)`; die Leitplanke im Tageslauf (`vorflug.mjs`) lehnt ein Plättchen darauf ab.
Ein künftiges fotorealistisches Bild gehört in `EIN_REALISTISCH` (`make-reel.mjs`) und
bekommt es dann wieder.

⚠ **Bewusst Standbilder mit eigener Kamerafahrt, kein KI-Video.** KI-Video mit
Menschen hat bei WELLbooked! sichtbare Fehler gebracht.

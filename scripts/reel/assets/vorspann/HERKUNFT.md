# Herkunft: Filmszenen vor dem Mahjong-Reel (`--vorspann`)

**Auftrag Josef, 27.09.2026:** „mahjong soll so einen post machen wie ich ihn dir
gleich schickt“. Das Vorbild war sein bester Mahjong-Beitrag auf TikTok (18.08.2026,
1103 Aufrufe): Zuerst eine KI-Filmszene, eine alte Hand stellt einen Drachenstein
ab, danach das Spiel mit „Did you know?“ und einem Kulturfakt. Seine Freigabe für
fal.ai (≤ 0,70 $) und für den Clip: „ja“.

| Datei | Motiv | Modell | Kosten |
|---|---|---|---|
| `hand-drache-start.jpg` | Startbild: alte Hand, Stein mit gemaltem rotem Drachen, Holztisch, Laternen, Räucherrauch | `fal-ai/flux-pro/v1.1-ultra`, 9:16, Seed 9401 | 0,06 $ |
| `hand-drache.mp4` | 5 s daraus: Die Hand stellt den Stein ab und zieht sich zurück | `fal-ai/kling-video/v2.1/standard/image-to-video`, 5 s | 0,28 $ |

Verworfen: Startbild Seed 9402. Der Stein war zu klein und die Hand zu jung. Gesamt
0,40 $ (2 Bilder, 1 Clip).

**Prompt (Bild):** Photorealistic cinematic close-up, an elderly man's weathered
wrinkled hand gently placing a single cream-white mahjong tile on a dark polished
wooden table. The tile face shows a finely painted red dragon illustration, no
writing, no characters. Warm amber paper lantern bokeh in the background, thin
wisps of incense smoke, shallow depth of field, soft film grain, moody evening
light, 35mm, vertical composition, no text

**Prompt (Clip):** The weathered hand slowly and gently sets the mahjong tile down
on the wooden table, then lifts away. Incense smoke drifts softly, lantern lights
flicker in the warm bokeh background, slow subtle camera push-in, cinematic, calm.
Negativ: extra fingers, deformed hand, morphing, text, letters, watermark, blur.

**Geprüft:** alle zehn Bilder im Halbsekundenabstand. Die Finger bleiben sauber,
der Stein verformt sich nicht, der Drache bleibt derselbe. Auf 1080×1920 gebracht
(CRF 20, ohne Ton).

⚠ **Fotorealistische Hand → AI-Plättchen PFLICHT.** `make-reel.mjs` legt es mit
`--vorspann` automatisch auf die Szene (nicht aufs Spiel). Das Beiblatt meldet
`ki-menschen`, und die Leitplanke im Tageslauf verlangt das Plättchen.

⚠ **Anders als bei den Einblendungen wird hier KI-Video benutzt.** Bei den
Einblendungen gilt „Standbilder statt KI-Video“, weil KI-Video bei WELLbooked!
sichtbare Fehler brachte. Hier ist es trotzdem ein Video, weil das Vorbild mit
genau dieser Bewegung am besten lief. Das Risiko ist geringer: nur eine Hand und
ein Stein, keine ganze Person, fünf Sekunden. Jeder neue Clip wird vor der
Aufnahme hierher Bild für Bild geprüft.

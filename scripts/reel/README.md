# Reel-Generator für Mahjong Royale

Baut aus echtem Gameplay fertige Hochkant-Videos (1080×1920, H.264 + AAC,
30 fps) samt Caption- und Hashtag-Datei. Kostet **nichts** — keine
Bildmodelle, keine Stimmen, kein fal.ai.

```bash
npm run build
npx vite preview --port 5199 --host 127.0.0.1     # muss laufen!
export CHROMIUM_PFAD=/opt/pw-browsers/chromium    # nur in der Cloud-Sitzung

node scripts/reel/charge.mjs                      # die ganze Charge (20 Reels, ~25 min)
node scripts/reel/charge.mjs --nur 3              # nur die ersten drei
node scripts/reel/charge.mjs --ab 12              # nach Abbruch weitermachen
```

Einzeln:

```bash
node scripts/reel/record-solitaire.mjs --level 40 --lang en --server http://127.0.0.1:5199
node scripts/reel/make-reel.mjs --clip out/reels/mahjong-solitaire-lvl40-en.mp4 \
                                --format fakt --fakt 7 --name mein-reel
```

## Die drei Formate

| Format | Eingangskarte | Wofür |
|---|---|---|
| `paar` | „Can you spot the pair?" | fordert zum Mitraten auf → Kommentare → Auslieferung |
| `clear` | „Every single tile. Gone." | reines Befriedigungs-Format, der Klang trägt |
| `fakt` | „Did you know?" + Fakt | Lesezeit ist Watchtime, und Watchtime ist der Ranking-Faktor |

Die Fakten kommen **live aus `src/game/facts.ts`** (34 Stück, DE+EN,
redaktionell geprüft und bewusst harmlos). Nicht hierher kopieren — eine
zweite Kopie läuft auseinander.

## Aufbau

```
record-solitaire.mjs   spielt ein Level echt durch, nimmt per CDP-Screencast auf
   └─ *.json           Beipackzettel: Klickzeiten, Siegzeitpunkt, Paarzahl
synth.mjs              erzeugt die Tonspur — Nachbau des WebAudio-Synths der App
formate.mjs            Texte, Hashtags, Caption-Vorlagen
make-reel.mjs          Hook + Spiel + Abspann + Ton → fertiges Reel + .txt
charge.mjs             fährt den Plan ab
```

## Fallen, die hier schon zugeschnappt sind

1. **Der Preview-Server muss wirklich laufen.** Am 11.08. war er als
   abgekoppelter Prozess gestartet und starb nach zwei Reels; die Charge rannte
   18 Mal in denselben Fehler. Sie prüft das jetzt vorab und bricht nach drei
   Fehlschlägen ab.
2. **Zeitstempel niemals vom letzten Bild nehmen.** Der Screencast liefert nur
   bei Bildänderung — in einer Wartepause steht er still, und ein Klick bekäme
   die Zeit des letzten Bildwechsels. Die Uhr hängt deshalb an der Ankunft des
   **ersten** Bildes. Gegenprobe: Die Abstände müssen der Tempo-Rampe in
   `record-solitaire.mjs` entsprechen (0,31 s → 0,12 s).
3. **Kein Ton in der Aufnahme.** Der CDP-Screencast liefert nur Bild, und in der
   App ist der Klang beim Aufnehmen abgeschaltet. Der gesamte Ton entsteht
   nachträglich aus dem Beipackzettel.
4. **Playwrights mitgelieferter ffmpeg kann kein MP4** (nur VP8/WebM) — deshalb
   `ffmpeg-static`. `ffprobe` gibt es in der Cloud-Sitzung nicht; Längen misst
   `dauerVon()` über `ffmpeg -i`.
5. **`.app` nicht zu einer Flexbox machen**, um das Brett zu zentrieren — dabei
   kollabiert die Breite und das Brett schrumpft auf einen Streifen. Und
   Kopfzeile/Bedienleiste heißen `.hud` und `.controls`; ein Selektor auf
   `header` träfe die SVG-Definitionen aus `main.tsx`, auf die jeder Stein
   per `url(#gold)` verweist.
6. **Der Erfolgs-Hinweis der App** (`.ach-toast`) hängt an
   `env(safe-area-inset-top)`, das im Browser 0 ist — ohne Korrektur klebt er
   auf der eingeblendeten Statusleiste.

## Beim Hochladen

Steht in jeder `.txt` noch einmal, hier zum Nachschlagen:

- **Creator-Konto, nicht Business** — bei TikTok *und* Instagram ist die
  Musikbibliothek für Unternehmenskonten beschnitten. Der Trending-Sound ist bei
  einem frischen Kanal mehr wert als ein klickbarer Link in der Bio.
- **Trending-Sound in der App drüberlegen.** Unsere Tonspur läuft bewusst leise
  mit. ⚠ **Nicht bei bezahlten Beiträgen** — Trending-Sounds sind nur für
  organische Posts lizenziert.
- **Kein Store-Link in der Caption** (drückt die Auslieferung), nur „link in bio".
- **Auf Instagram den Facebook-Haken mitnehmen.** Die Mahjong-Zielgruppe ist dort
  älter und der Wettbewerb geringer als auf TikTok.

⚠ Der Abspann sagt „Free on the App Store & Google Play". Das stimmt für Mahjong
Royale (beide Stores seit 29.7.2026). **Für Anigosha gilt der Satz nicht** —
diese Vorlage nicht ungeprüft dorthin kopieren.

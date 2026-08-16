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

## Der Hook liegt ÜBER dem Spiel, nicht davor (seit 16.08.2026)

Bis dahin war der Hook ein **Vorspann**: erstes Bild der Aufnahme eingefroren,
Karte darüber, je nach Format 1,6 / 1,9 / **3,6** Sekunden lang. Erst danach
begann das Gameplay.

Das ist genau das Muster, an dem kurze Videos sterben. Auf TikTok und in Reels
entscheidet die erste Sekunde, ob weitergewischt wird, und ein Standbild gibt
keinen Grund zu bleiben — beim Format `fakt` waren es 3,6 Sekunden ohne jede
Bewegung. Die durchschnittliche Wiedergabedauer bricht ein, und an ihr hängt,
ob die Plattform ein Video über die erste Testgruppe hinaus ausliefert.

Jetzt läuft das Spiel **ab Bild 1** und die Karte liegt darüber: Lesezeit und
Bewegung gleichzeitig statt nacheinander. Nach `hookSek` blendet sie weg und
gibt das Brett frei. `hookSek` bedeutet damit nicht mehr „so lange steht das
Bild still", sondern nur noch „so lange ist die Karte zu sehen" — die Werte in
`formate.mjs` können also bleiben, was sie sind: Lesezeiten.

Drei Dinge hängen daran, alle in `make-reel.mjs`:

1. **Die Abdunklung ist ins `hook.png` gewandert.** Vorher lag sie als
   `eq=brightness` auf dem Standbild. Als eingebackene Fläche verschwindet sie
   mit derselben Blende wie die Karte, statt als zweite Ebene nachgezogen zu
   werden.
2. **`versatzSpiel` steht auf 0.** Vorher `HOOK_SEK - BLENDE_SPIEL`, weil das
   Gameplay erst nach dem Vorspann begann. ⚠ Bliebe der Versatz stehen, lägen
   **alle Steinklänge um Sekunden hinter dem Bild** — der Umbau ist deshalb
   nicht nur eine Frage der Optik.
3. **`BLENDE_SPIEL` ist ersatzlos weg**, es gibt keinen Schnitt vom Hook ins
   Spiel mehr. Geblieben ist nur die Blende zum Abspann.

Nebenwirkung, die uns entgegenkommt: Jedes Reel wird um `hookSek` kürzer
(Beispiel `paar`: 20,5 s → 19,0 s). Kürzer heißt höhere Abspielrate.

⚠ **Die Karte liegt bewusst in der Bildmitte**, obwohl sie dort einen Teil des
Bretts verdeckt. Unten und oben blenden TikTok und Instagram ihre eigene
Bedienung ein (Caption, Knöpfe, Fortschrittsbalken) — Text am Rand wird davon
überdeckt. Beim Format `paar` heißt das: Das Brett ist knapp zwei Sekunden lang
halb verdeckt, danach bleiben rund 15 Sekunden zum Mitraten.

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
5. **`playwright-core`, niemals `playwright`.** Das volle Paket lädt bei jeder
   Installation drei Browser herunter (~150 MB, eigener postinstall). Vercel
   installiert die devDependencies mit, bevor es baut — mit `playwright` in der
   `package.json` hinge an jedem Deploy des Web-Bundles ein Browser-Download,
   der mit dem Bundle nichts zu tun hat. Den Pfad liefert `browser.mjs`; ohne
   Fund bricht es mit einer Anleitung ab statt mit einem Stapelabzug.
   ⚠ Beide Pakete gehören in die `package.json`. Sie fehlten dort bis zum
   16.08.2026 und steckten nur in der `node_modules` der Sitzung, in der sie
   installiert wurden — eine frische Sitzung starb sofort mit
   „Cannot find module 'playwright'", und weil die Charge nach drei
   Fehlschlägen abbricht, meldete sie irreführend den Preview-Server.
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

- **TikTok als Business-Konto, Instagram als Creator-Konto.** Unter 1000 Followern
  gibt TikTok das Website-Feld nur Unternehmenskonten; Instagram macht den Link
  unabhängig von Kontoart und Followerzahl klickbar.
  ⚠ **Bis 16.08.2026 stand hier das Gegenteil** („Creator, nicht Business — sonst
  fehlt die volle Musikbibliothek"). Der Rat war falsch, und zwar aus einem Grund,
  der die Bibliotheksfrage gleich mit erledigt: siehe nächster Punkt.
- **Keine Chart-/Trending-Sounds unter die Reels.** Sie sind für *private* Beiträge
  lizenziert, nicht für Firmen, die ein Produkt bewerben — Mahjong Royale verdient
  über Werbung und Käufe, ein Chart-Hit darunter ist gewerbliche Nutzung. Genau
  deshalb ist die Bibliothek für Unternehmenskonten beschnitten; das ist kein
  Nachteil des Kontotyps, sondern die Lizenzlage. Wird es erkannt, ist das Video
  stumm — und ein stummes Reel ist tot.
  **Die Reels brauchen ohnehin keine Musik:** sie bringen Steinklänge und
  Sieg-Zeremonie mit, und beim Format `clear` ist genau das der Reiz („Sound on").
  Wer Musik will, nimmt die **Commercial Music Library** des Business-Kontos.
- **Kein Store-Link in der Caption** (drückt die Auslieferung), nur „link in bio".
- **Auf Instagram den Facebook-Haken mitnehmen.** Die Mahjong-Zielgruppe ist dort
  älter und der Wettbewerb geringer als auf TikTok.

⚠ Der Abspann sagt „Free on the App Store & Google Play". Das stimmt für Mahjong
Royale (beide Stores seit 29.7.2026). **Für Anigosha gilt der Satz nicht** —
diese Vorlage nicht ungeprüft dorthin kopieren.

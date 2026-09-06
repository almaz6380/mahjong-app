# Mahjong Royale (mahjong-app)

Spielesammlung mit **minimalistischer Startseite** (ein großer Play-Button + drehender 3D-Stein,
alle Modi hinter „Alle Spiele"): Mahjong Solitaire, **Mahjong Connect** (Lianliankan), 4-Spieler,
**Riichi** (japanisch) und mehrere Bonus-Spiele; dazu wählbare Stein-Designs (Skins), **natürlicher
Jade-Look** app-weit und „Wusstest du?"-Infokarten zwischen den Runden. Vite + React + TypeScript,
verpackt mit Capacitor für iOS und Android. Sprache im Projekt/mit dem Nutzer: **Deutsch**.

## Befehle

- `npm run dev` — Dev-Server
- `npm run build` — Web-Bundle nach `dist/`
- `npx cap sync` — dist/ + Plugins nach ios/ und android/ kopieren (nach jedem Build vor nativen Builds!)
- Web-Smoke-Test: puppeteer-core + System-Chrome (devDep). Achtung: Headless-Chrome startet
  englisch (i18n-Auto-Erkennung). Die Tagesbelohnung erscheint NICHT mehr automatisch —
  sie öffnet nur über das Truhen-Symbol auf der Startseite (Punkt = noch nicht abgeholt).

## Architektur (Kurzüberblick)

- `src/engine.ts`, `src/layouts.ts` — Solitaire-Kern; jedes Board rückwärts konstruiert = garantiert lösbar.
  **Achtung:** Das gilt für das *frische* Brett — der Spieler kann sich in eine Sackgasse spielen, für die es
  keine lösbare Verteilung mehr gibt (z. B. letztes Paar gestapelt). `reshuffleBoard` gibt dann dasselbe
  Brett zurück; `useGame.shuffle()` liefert `false`. Die Oberfläche muss darauf reagieren (GameScreen:
  „Neu"-Ausweg + kein Booster-Verbrauch; FigureRound/Blitz: automatisch neues Brett).
- **Level-Fortschritt (mehrfach kaputtgegangen, Regressionstest `node scripts/e2e-level-flow.mjs`):**
  Der Spielstand (`session.ts`) darf NUR in genau dem Level wiederverwendet werden, aus dem er stammt —
  sonst startet jedes Folgelevel wieder mit dem alten, halb geräumten Brett (`App.tsx`: `advanceLevel`
  verwirft `playInitial` + Session, zusätzlich Level-Vergleich beim Rendern). Das Level steigt erst beim
  Tippen auf „Weiter"; wird die App vorher geschlossen, hebt die Selbstheilung in `useProgress` (erstes
  Level ohne `bestStars`-Eintrag) den Stand nach.
- `src/game/figures.ts` — **Figuren-Generator**: 29 Grundformen × 5 Größen × Höhenprofil × Aushöhlung
  = **1392** einzigartige, deterministische Boards (Namen `fig-<n>`, i18n `fig.*`).
  **Kein flaches Profil** – jede Figur hat ≥2 Ebenen (einschichtige Bretter sind trivial), erzwungen über
  entfernte 'flach'-Stufe + `layers.length < 2`-Filter.
  **Bretter bleiben klein, damit die Steine groß sind** (max 8×9 Zellen): `SIZES` = 4×5 … 8×9, ASCII-Formen
  werden per `resample()` auf dieselben Raster gebracht. Die Sortierung nutzt
  `cells.length + 30 × tier + 12 × layerCount` (tier: ≤5×6 = 0, ≤6×7 = 1, ≤7×8 = 2, sonst 3).
  **Tiefe statt Fläche:** Erodieren verjüngt jede Ebene um einen Ring, auf kleiner Fläche ist damit nach
  zwei Stufen Schluss. Die Profile `Sockel`/`Turm`/`Stufenturm`/`Kranzturm` WIEDERHOLEN deshalb eine
  Ebene, statt sie weiter zu verjüngen — dadurch gibt es 4 Ebenen auch auf ≤5×6 (Steine bleiben ~75 px).
  Jede Ebene muss Teilmenge der darunter sein, sonst schweben Steine.
  **Level-Rampe (`levelFigures`)**: nicht jede Figur wird ein Level — Filter `LEVEL_MIN_TILES` = 36 und
  Schrittweite `LEVEL_STEP` = 3 ergeben **370 Level**; das sind die Stellschrauben für „zu leicht/zu
  schwer". Ergebnis: Level 1 = 36 Steine/2 Ebenen (~75 px), Level 25 ≈ 42/2 (~63 px), Level 100 ≈ 50/2
  (~55 px), Level 300 ≈ 72/4 (~48 px); Ø steigt von 40 Steinen/2,6 Ebenen auf 85/3,3. Scale-Deckel in
  `Board.tsx` = 1.85. Prüfskript:
  `node scripts/check-figures.mjs` (Maße, Rampe, Parität, Schweben, Lösbarkeit aller 1392, Modus-Filter).
  Steine im Solitaire mit 3D-Korpus (`<Tile solid>`, CSS `.tile.solid`); ab 40 Steinen (`SERIES_MIN_TILES`)
  mischen die Serien **Mythen** (龍鳳麒龜) & **Schätze** (Laterne/Fächer/Münze/Knoten) ins Deck
  (`deckForCount`) — Schwelle muss zur Brettgröße passen, sonst bleibt das Album leer.
- **`src/ui/Board.tsx` — Ausrichtung (subtil, leicht kaputtzumachen):** Der Stein ist bewusst
  asymmetrisch (Seitenkante nur links = `OVER_L`, unten Kante+Schatten = `OVER_B`; oben/rechts bündig).
  Deshalb gilt: (1) Board-Maße aus den **echten Steinpositionen** rechnen, nicht aus
  `maxCol`/`maxLayer` — bei Pyramiden ist die obere Ebene eingerückt, ihr Versatz zählt rechts nicht mit;
  (2) über **alle** Steine inkl. `removed`, sonst springt die Figur beim Spielen; (3) zentriert werden die
  **Deckflächen**, nicht die Silhouetten — sonst stehen die weißen Flächen sichtbar nach rechts versetzt
  (das Auge liest die Fläche, nicht die Kante). Die Kante ragt darum links aus der Box; ihr Platz wird in
  der Scale-Rechnung reserviert (`(boardW + OVER_L)`), sonst schneidet `.board-wrap` (overflow:hidden) sie ab.
  Verifikation: `node scripts/e2e-boards.mjs` bzw. Rand links/rechts im gerenderten Bild messen (Δ soll 0 sein).
- **iOS-Safari-Fallen beim Antippen** (in der Samsung-/Android-App gab es das nie, daher leicht zu übersehen):
  (1) `.board-wrap` braucht `overflow: clip` — mit `overflow: hidden` bleibt der Kasten scrollbar (der
  Steinkorpus ragt ~5 px heraus), und Safari scrollt den angetippten, fokussierten Stein „in den sichtbaren
  Bereich" → das ganze Brett rutscht bei jedem Tippen. `hidden` bleibt als Rückfall für < iOS 16 stehen,
  dazu setzt `Board.tsx` per `onScroll` jeden Scroll zurück. (2) `html { touch-action: manipulation }`,
  weil Safari `user-scalable=no` ignoriert — sonst zoomt der Doppeltipp beim schnellen Antippen zweier
  Steine ins Brett. (3) `:active`-Versatz nur unter `@media (hover: hover)`, sonst bleibt der Zustand auf
  iOS am Stein hängen. Messskript-Muster: `scrollWidth/clientWidth` von `.board-wrap` prüfen und einen
  Test-Scroll setzen — bleibt er stehen, kann Safari das Brett verschieben.
  (4) **Keine transform-/filter-Animationen auf Steinen** (`.tile`): Das Brett liegt unter einem
  gebrochenen `transform: scale(...)`. Hebt WebKit einen Stein darin für eine transform-/filter-Animation
  auf eine eigene Compositing-Ebene, rastert es den Rest neu und schnappt ihn um ~1 Gerätepixel zur Seite —
  die ganze Figur ruckt beim Antippen. Aus einer Bildschirmaufnahme gemessen: −0,88 px beim Auswählen,
  +1,28 px zurück genau 183 ms später (= Ende der alten `selectpop`-Animation von 0,18 s). Auswahl-
  Rückmeldung darum nur über Kontur/Farbe (`selectflash` animiert `outline-color`, reiner Malvorgang).
  Analyse-Rezept für solche Videos: Bilder per ffmpeg (npm-Paket `ffmpeg-static`, das Playwright-ffmpeg
  kann kein MP4/HEVC) als rawvideo ziehen, die Änderung je Rasterzelle vergleichen (ändert sich das GANZE
  Brett? → globales Neurastern) und die Verschiebung über einen Parabel-Fit auf die SAD-Kurve bei ±1 px
  sub-pixelgenau schätzen. Verstärkte Differenzbilder täuschen — die HEVC-Kompression re-quantisiert bei
  jeder Änderung das ganze Bild. Betrifft **alle** Compositing-Eigenschaften, also auch `opacity`:
  Die Match-Animation `removefade` ist deshalb ebenfalls nur noch unter `@media (hover: hover)` aktiv;
  auf Touch-Geräten verschwindet das Paar sofort (`.tile.removing { visibility: hidden }`), Rückmeldung
  kommt aus dem Klang. Auf Touch-Geräten animiert damit KEIN Stein mehr transform/filter/opacity.
- **Stein-Design** (`src/ui/Tile.tsx`): Motive stammen aus **Gemini-Bildern des Nutzers**. Rohbilder liegen
  im Repo unter `design-sources/gemini-tiles/`, freigestellt per `scripts/extract-tiles.py magenta <in> <out>`
  (Magenta-Key, 320 px, WebP) nach `src/assets/tiles/*.webp`; `motif()` lädt sie per `import.meta.glob`
  (fehlt ein Bild → gezeichneter SVG-Fallback, Not-Schalter `USE_IMG_MOTIFS`). Bild-Motive: myth1–4,
  season1–4, treasure1–4, elem-pin (Münze = Kreis-Pips), elem-sou (Bambusstab = Sou-Pips),
  face-marble (Deckfläche). Als SVG nachgezeichnet
  (schärfer in Kleinstgrößen, `Glyph`-Helper mit Goldkante): Zahlen = Lapis-Ziffer + Rubin-萬,
  Winde = Onyx, 中 rot / 發 jade / 白 schiefer, Blume = rote Scheibe. Skins mit eigener Flächenfarbe
  blenden Marmor+Goldrand aus (`.face-tex`), Neon hellt Lapis/Onyx/Slate auf (sonst unlesbar).
  **Auswahl-Tönung:** Der angetippte Stein wird golden (`--sel-tint` Fläche, `--sel-gold` Kontur).
  Das macht ein Rechteck `.sel-tint` IM SVG (`TileBody`, über der Marmor-Textur, unter Glanz und
  Motiv) — so färbt sich nur die Fläche, das Motiv bleibt scharf. Bewusst `fill` statt CSS-Filter:
  ein Filter hebt den Stein auf eine eigene Compositing-Ebene und lässt auf iOS das ganze Brett
  ruckeln (siehe „iOS-Safari-Fallen").
  **Hinweis:** Am 16./17.7.2026 lief parallel eine zweite Session am selben Thema (30 Commits,
  flacher „StoneTile"-Look + `src/assets/flat/`). Deren Roh-Designs liegen weiterhin in
  `design-sources/gemini-tiles/` (`README-parallel-session.md`); der Bambus stammt daher.
  Aktiv ist der Bild-/Marmor-Look dieser Session — vor Arbeiten am Stein-Look immer erst
  `git fetch` und den Remote-Stand prüfen.
- `src/mahjong4/` — 4-Spieler-Modus (Hongkong, KI per Shanten-Heuristik) **und Riichi**: `riichi.ts`
  (Yaku/Han/Fu/Dora-Wertung), `riichiGame.ts`+`useRiichi.ts` (Ablauf, geschlossene Variante),
  `ui/RiichiTable.tsx`; HK-Tisch `ui/Table4.tsx`
- `src/modes/connect/` — **Mahjong Connect** (BFS-Pfad ≤2 Kurven, garantiert lösbar via Auto-Mischen),
  Fortschritt in `progress.connectLevel`
- `src/modes/` — Bonus-Spiele (2048, Match-3, Memory, Sudoku, Tile Match, Zeit-Blitz, 3D-Dimensions),
  gemeinsame `ModeApi` in types.ts. Tages-Challenge (`daily`, 7×8/78 Steine) und Zeit-Blitz
  (`blitz`, 6×7/52) haben eigene kompakte Layouts in `layouts.ts` — die alten Riesenbretter
  (turtle/classic) hätten winzige Steine. Zen filtert zusätzlich auf `cols<=7 && rows<=8`.
- **Verdeckte Steine + Spezialsteine (`src/game/modifiers.ts`, seit 11.08.2026).**
  Deterministisch aus der Levelnummer, wie Figuren und Tages-Challenge: verdeckt ab
  Level **30** (2 Steine, je 25 Level einer mehr, gedeckelt auf 22 % des Bretts),
  Spezialsteine ab Level **50** (ab 120 zwei Paare). Reichweite: Level-Kampagne,
  Tages-Challenge, Zeit-Blitz — **nicht** Zen, Pagode, Feste.

  ⚠ **Die eine Regel, an der alles hängt: jede matchKey-Gruppe auf dem Brett muss
  GERADE bleiben.** `makePairs` bildet je Gruppe nur `floor(Größe/2)` Paare; bei
  ungerader Gruppe ist `pairs` kürzer als die Zahl der Positionen und
  `assignSolvable` lief darüber hinaus — reproduzierter `TypeError` bis in die
  Oberfläche (Blitz und Zen mischen bei Sackgassen selbsttätig ⇒ weißer Bildschirm).
  Ein Riegel in `assignSolvable` fängt das ab, aber ein Brett mit ungerader Gruppe
  ist trotzdem unlösbar und **kein Mischen repariert es**. Daraus folgt die Bauform:

  > **Spezialsteine treten als PAAR auf und ersetzen ein LÖSUNGSPAAR** aus der
  > Rückwärtskonstruktion (`generateBoardWithPairs` gibt die Zuordnung mit heraus).

  Zwei beliebige Steine derselben Gruppe zu nehmen wäre falsch: Die Parität bliebe
  heil, aber die früheren Partner der beiden fänden einander nie wieder.

  | Stein | Wirkung | Paritätsfalle |
  |---|---|---|
  | Mischen 🔀 | ruft `shuffle()`, kein Booster-Verbrauch | – |
  | Joker 🃏 | passt auf jeden Stein — **Joker 2 nimmt die Gestalt des geschlagenen Steins an** | ohne die Verwandlung blieben zwei Waisen aus verschiedenen Gruppen |
  | Bombe 💣 | räumt Nachbarn um beide Bombensteine | `blastSet` beschneidet auf **vollständige Paare** und lässt nur Steine ohne etwas darüber fallen |
  | Zeitbonus ⌛ | Blitz +10 s, Level/Tages-Challenge `startedAt += 8000` (bessere Sterne) | – |

  ⚠ **Die Bombe darf nicht `nb.up` als Trägertest nehmen** — die Ebenen liegen im
  Halbschritt versetzt, `up` kennt nur die exakte Koordinate darüber. Ein echter
  Überlappungstest muss es sein, sonst schweben Steine. Genau so passiert und im
  Fuzz gefangen.
  ⚠ **Faces nie mutieren:** `deckForCount` erweitert große Decks mit
  `out.push(base[i])`, dieselbe Objekt-Referenz steckt dann in mehreren Steinen.
  Immer `{ ...face }`.
  ⚠ **`hasMoves`/`freeSet` kennen `hidden` NICHT** — verdeckt ist reine Darstellung.
  Sonst entstünden Falsch-Sackgassen, die den Spieler grundlos ins Mischen treiben.
  ⚠ **Modifikatoren nur im ERZEUGUNGS-Pfad**, nie beim Fortsetzen aus
  `opts.initial`; sonst bekäme eine laufende Partie beim Laden neue Verdeckungen.
  Regressionstest dafür: `node scripts/check-altstand.mjs`.
  ⚠ **Kein Flip beim Aufdecken.** `rotateY` auf `.tile` ist verboten (iOS-Ruckeln,
  s. o.) — Aufdecken tauscht nur den SVG-Inhalt, ein reiner Malvorgang.
  Verdeckte Steine kosten außerdem Zeit: `parTimeMs(tileCount, hiddenCount)` legt
  je verdecktem Stein 2,5 s drauf, sonst fiele in genau diesen Leveln die
  Drei-Sterne-Quote.
  Prüfskript: **`node scripts/check-specials.mjs`** (Determinismus der Rampe,
  Parität über 58 Bretter, 4000 Bomben-Zündungen inkl. Schweber- und
  `reshuffleBoard`-Probe, 4000 Joker-Züge, 200 Memory-Level, **plus eine
  Gegenprobe, die absichtlich fehlschlagen muss** — ein Test, der nie anschlägt,
  prüft nichts).
- **Memory (`src/modes/memory/board.ts` + `MemoryScreen.tsx`)** läuft seit
  11.08.2026 auf **echten Figuren** statt auf einem `repeat(cols, 1fr)`-Raster:
  Level 1–12 flache Silhouette (`fig.cells.filter(c => c.layer === 0)` — dafür
  braucht der Figuren-Generator keine Änderung, obwohl er flache Profile sperrt),
  ab 13 gestapelt mit Blockade **nur von oben**. Anders als das Solitaire-Brett
  wird MIT Lücke gerastert (Karte 52×70 im Raster 58×76, Ebenenversatz 15/17) —
  bei dichtem Raster wäre „verdeckt" nicht von „daneben" zu unterscheiden, bei zu
  kleinem Versatz liest sich die untere Karte als Schlagschatten.
  Gepaart wird über `faceId`, **nicht** `matchKey` („alle Blumen passen zueinander"
  wäre in einem Gedächtnisspiel unfair). Der Größen-Umschalter ist weg, der
  Bestwert zählt jetzt **geschaffte Level** (`recordModeBest('memory', level, true)`)
  — das repariert nebenbei einen alten Fehler: `ModesScreen` las `best('memory')`,
  geschrieben wurde `memory-<size>`, der Bestwert war deshalb nie zu sehen.
  Ein **Rettungs-Mischen** ist Pflicht, weil es in diesem Modus keinen
  Mischen-Booster gibt. Der Flip **darf** hier bleiben: `.mem-cell` ist kein `.tile`.
- **Startseite:** minimales Layout in `src/App.tsx` (Play-Button, Seiten-Symbole `DailyIcon`/`EventIcon`,
  „Alle Spiele"-Sheet `src/ui/GamesSheet.tsx`); drehender 3D-Stein `src/ui/HeroTile3D.tsx` (CSS-3D-
  Schicht-Extrusion + runde Seitenwand; **Rotation per JS-rAF**: sanfte Ruhe-Drehung + Finger/Maus-
  Drehung mit Ausschwung, Pointer-Events auf `.hero3d-scene`, `touch-action:none`). Das 中 auf der
  Vorderseite ist ein **aus einem Gemini-Bild freigestelltes Symbol** (`src/assets/symbol-zhong.webp`).
  **Bild-Extraktions-Pipeline** (für Stein-Designs aus Gemini): Python-venv mit Pillow/numpy,
  Magenta-Hintergrund per Farb-Key entfernen bzw. nur das Symbol per Rot-Key aus der Mittelzone ziehen,
  auf Silhouette croppen, als WebP mit Alpha ablegen (Rezept im Session-Verlauf; Gemini-Vorgabe:
  ein Stein pro Bild auf **reinem Magenta #FF00FF**). **Freigestellte Gemini-Symbole** (Extraktion:
  Magenta-Key `min(R,B)-G`, auf Silhouette croppen, Sternchen mit weg): Münze `coin.webp` (Icon 'coin',
  überall), Truhe `reward-chest.webp` (RewardIcon), Geschenk `event-gift.webp` (EventIcon), Drachen-Wappen
  `emblem-shield.webp` (DailyIcon + HeroTile3D-Rückseite), sowie die 8 Icons der „Alle Spiele"-Liste
  `game-*.webp` (in App.tsx `gameItems`, CSS `.game-ico .game-img`) und **seit 11.8.2026 die sieben
  Modus-Karten** `mode-*.webp` (`src/modes/ModesScreen.tsx`, CSS `.mode-ico`) — benannt nach der
  `ModeId`, damit die Zuordnung ohne Tabelle stimmt. Die **Board-Steine** sind seit
  17.7.2026 ebenfalls auf Gemini-Motive umgestellt — siehe Abschnitt „Stein-Design" oben.
  ⚠ **Der Magenta-Key treibt seit 11.8. auch den Farbstich aus** (`extract-tiles.py`, „spill
  suppression"): Alpha allein reicht nicht, halbdurchsichtige Stellen — Glas, weiche Kanten,
  Leuchtsäume — behalten sonst den Ton des Hintergrunds. Bei der Sanduhr (`mode-blitz`) waren
  das **43 % aller Kantenpixel**, sie schimmerte durchgehend rosa; danach 0 %. Grün auf
  `min(R,B)` anzuheben trifft genau diese Pixel, weil Elfenbein, Jade und Gold alle darüber
  liegen. **Ein violettes Motiv wäre die Ausnahme** — dann den Schritt abschalten, nicht die
  Schwelle verbiegen.
  ⚠ **Das Bildfeld der Modus-Karten ist 58×44 und bewusst nicht quadratisch.** Die Motive haben
  sehr verschiedene Seitenverhältnisse (drei Steine liegen breit, das Sudoku-Raster steht fast
  quadratisch); in einem 44er-Quadrat schrumpfen die breiten auf halbe Höhe und wirken neben den
  hohen verloren.
  **Hintergrund = asiatisches Tempel-Motiv** (`src/assets/home-temple.webp`), auf der Startseite
  mit animierten Sakura-Blüten darüber.
  **Seit 11.08.2026 auf ALLEN Bildschirmen** (Josefs Wunsch, Variante „C" aus einer Sichtprüfung
  mit drei Fassungen). Vorher trug das Motiv nur die Startseite und der Rest wirkte daneben leer.
  Was dafür weichen musste:
  - Die Regel sitzt jetzt fest auf `html` statt auf `html.on-home`. Die **Klasse `on-home` ist
    ersatzlos entfallen**, mitsamt dem `useEffect` in `App.tsx`, der sie je Screen umschaltete.
  - `.board-wrap` und `.m4` hatten einen **deckenden Filz-Verlauf** aus den Theme-Variablen
    (`var(--felt)`/`--felt-2`) — der hat das Foto auf genau den Bildschirmen verdeckt, um die es
    ging. Beide stehen jetzt auf `background: none`; der `inset`-Schatten von `.board-wrap` bleibt
    und rahmt die Spielfläche als Vignette.
  - ⚠ **Damit hatten die gekauften Farbwelten ihre Filzfläche verloren** — `--felt`/`--felt-2`
    werden **nirgends mehr gemalt**. Aufgefallen ist es erst beim Durchgehen aller Bildschirme:
    Der Design-Screen verkauft einen Abschnitt **„Hintergrund"** für 300–1000 Münzen, und der
    hätte nichts mehr bewirkt. Ersatz ist **`--wash`** (`src/game/themes.ts`): eine Farbschicht
    über dem Foto, mittlere Lage im `background-image` von `html`. `classic` steht bewusst auf
    `transparent`, damit der Grundzustand unverändert aussieht; die bezahlten Welten färben das
    ganze Bild spürbar. Wer eine Welt ändert, muss `swatch`, `--felt-2` und `--wash` zusammen
    nachziehen.
    ⚠ Bewusst **kein `color-mix`** dafür: Safari kann es erst ab 16.2, das Deployment-Target
    steht auf iOS 15 — ein ungültiger Wert würde die ganze `background-image`-Angabe verwerfen
    und damit auch das Foto.
  - `.app-bg` ist **global** ausgeblendet (vorher nur auf der Startseite). Damit sind auch die
    Jade-Glows, das **Sumi-e-Tuschmotiv** und der Wasserzeichen-Stein aus `AppBackground.tsx` weg.
    Die Komponente bleibt in `main.tsx` gemountet — eine Zeile CSS holt sie zurück.
  - `--surface` 0,06 → **0,13**, `--surface-2` 0,11 → 0,18, `--line` 0,12 → 0,18, `--muted` 0,6 →
    0,72. Auf gleichmäßigem Jade trugen 6 % Milchglas; auf einem Foto zerfaserten die Zeilengrenzen
    der Unterseiten (Einstellungen, Shop, Erfolge, Statistik, Album). **An diesen Tokens hängt jeder
    Knopf und jede Zeile der App** — wer hier dreht, verändert alles.

  **WICHTIG — Safe-Area-Falle (viel Debugging gekostet):** iOS füllt den unteren Streifen
  (Home-Indikator/Safari-Leiste, ~100+ CSS-px) NUR mit einer Hintergrund-*Farbe*, NIE mit einem
  fixen oder Root-Hintergrund*bild*. Deshalb: (1) Bild liegt auf **`html`** (Root-Element),
  (2) `html` background-color = `#121e1d`, und (3) der **Bildunterrand ist bewusst in genau dieses
  #121e1d ausgelaufen** (in der webp eingebacken), damit Bildkante = Streifenfarbe = nahtlos.
  `body { background: transparent }`, sonst überdeckt body den Root-Hintergrund.
  ⚠ Der frühere Jade-Grundton `#123f2e` für Nicht-Home-Screens ist damit **weg** — es gibt nur noch
  eine Grundfarbe. Bild-Verarbeitung (Sternchen entfernen, Rand auslaufen) via Python-venv/Pillow
  im Session-Scratchpad.
  ⚠ **Am Gerät noch ungeprüft:** Die Ausweitung ist per Playwright-Screenshot verifiziert (Spiel,
  Einstellungen, Connect, 4-Spieler, Riichi, Startseite). Ob unten am Home-Indikator eine Naht
  entsteht, zeigt nur echtes iOS — im Browser gibt es diesen Streifen nicht.
- `src/ui/FactHost.tsx` + `src/game/facts.ts` — „Wusstest du?"-Infokarten zwischen Runden (`presentFact()`,
  Schalter `progress.showFacts`). **Reihenfolge beachten:** Die nächste Runde muss HINTER der Karte
  aufgebaut werden (GameScreen: `presentFact()` ohne await, dann `advanceLevel()`; `dismiss()` löst erst
  den Aufrufer aus und blendet die Karte ein Bild später aus). Sonst ist zwischen Karte und neuem Brett
  für ~1 Bild wieder die alte Sieg-Karte zu sehen („Belohnung, die sofort verschwindet").
- **Asia-Premium (v1.1):** Sumi-e-Tuschmotive im Hintergrund (`src/ui/SumiE.tsx`, wechselt je 50 Level via
  `setAmbientLevel`), Sieg-Zeremonie Ensō+福+Hanko (`WinCeremony.tsx`), Sakura-Partikel (`Sakura.tsx`,
  Reduced-Motion-aware), 3 Asia-Themes in themes.ts, Koto/Windspiel in sound.ts, Washi-Korn auf `.card`.
  **Modi:** Zen (`src/modes/zen/`), Pagoden-Aufstieg 100 Etagen (`src/modes/pagoda/`, `progress.pagodaFloor`),
  Mythen-Album (`src/ui/AlbumScreen.tsx`, Zählung via `useGame.onMatch`-Paar + `progress.album`),
  Saison-Feste (`src/game/festivals.ts` + `src/modes/festival/`, Banner auf Startseite, `progress.lastFestival`).
  Gemeinsame Runden-Shell: `src/ui/FigureRound.tsx`.
- **Ladebildschirm** (Web): Markup + Inline-CSS in `index.html` (`#splash`, paint vor dem JS-Bundle),
  Bild `public/splash.webp` (Drachen-Medaillon); `src/main.tsx` lädt kritische Bilder vor
  (home-temple/emblem/symbol/splash), füllt den Balken, zeigt Titel + Tagline + wechselnden
  „Wusstest du?"-Tipp (`facts.nextFact`), blendet nach Vorladen + ~1,4 s aus.
- **App-Icon** = drei Steine (中 vorne, Drache links, Münze rechts) **vor dem Tempel-Motiv**
  (`scripts/render-app-icon.mjs` → `assets/icon-*` → `npx @capacitor/assets generate`).
  Seit 11.08.2026 trägt es dasselbe `home-temple.webp` wie die App, damit Icon und
  Bildschirme dieselbe Welt zeigen.
  **Zwei Stellschrauben, an denen alles hängt:**
  - `TILES = 0.80` — formatfüllend belegt die Steingruppe ~85 % der Fläche und verdeckt
    das Motiv praktisch vollständig. Erst geschrumpft wird der Tempel sichtbar.
  - Der **Ausschnitt** (`background-size: 190% auto; background-position: 34% 22%`) zeigt
    die Pagode als große dunkle Silhouette. Das ist der Grund, warum das Foto hier
    funktioniert: Ein *unbeschnittenes* Landschaftsfoto zerfällt bei 60 px tatsächlich zu
    einem graugrünen Fleck — drei stilisierte Entwürfe (Nebelband, Bergrücken, Pagoden-
    Silhouette) waren dort nicht vom alten Icon zu unterscheiden und wurden verworfen.
    Ein großes, kontrastreiches Einzelmotiv überlebt dagegen. Die Pagode liegt bewusst
    weit innen, damit Androids adaptive Maske sie in Kreis, Squircle und Quadrat behält.
  - `TIEFE` (Abdunklung unten + Vignette) ist Pflicht, sonst säuft der Stein-Stapel im
    Nebel ab und verliert seine Kante.
  ⚠ **Beim Prüfen den Android-Zoom nicht vergessen**: Der Launcher setzt Hintergrund- und
  Vordergrund-Ebene zusammen, skaliert so, dass die inneren 66 % das sichtbare Icon füllen,
  und maskiert erst dann. Wer die Ebenen ohne diesen Zoom übereinanderlegt, hält den
  Vordergrund fälschlich für zu klein. Deshalb steht dort `TILES * 0.66`.
  ⚠ `page.setContent(..., 'networkidle0')` hängt im Render-Skript: Alle Bilder sind
  data:-URIs, es gibt also nie Netzverkehr — beim zweiten Aufruf auf derselben Seite löst
  es nie aus, der Lauf bricht nach dem ersten Bild ab. Deshalb `domcontentloaded` + Wartezeit.
- `src/ui/AppBackground.tsx` — globaler Hintergrund (Jade-Glows + Riesen-Stein), in main.tsx gemountet;
  `src/game/themes.ts` — Themes + Stein-Skins (`applySkin`/`TILE_SKINS`); App-Icon/Splash via
  `@capacitor/assets generate` aus `assets/icon-*`/`splash*`
- `src/ads/admob.ts` — **`USE_TEST_ADS`-Flag**: `false` = echte Anzeigen (Launch), `true` = Google-Test-IDs.
  Prod-IDs siehe `admob-ids.md`. Der Bundler eliminiert den jeweils inaktiven ID-Block!
  Check im fertigen Build: `grep 3940256099942544` (Test-ID) im entpackten JS-Bundle → darf im Release NICHT vorkommen.
  **Kein Banner mehr (8.8.2026, auf Josefs Wunsch):** Der Streifen unten hat gestört. `showBanner()`,
  die Banner-Ereignisse, der Retry und die CSS-Variable `--banner-space` sind ersatzlos raus — die
  Layout-Wurzeln (`.app`, `.home`, `.m4`, `.mode-play`) rechnen nur noch `env(safe-area-inset-bottom)`.
  Die Banner-Anzeigenblöcke bleiben in AdMob bestehen (IDs in `admob-ids.md`), falls es je zurück soll;
  dann kommt auch der reservierte Platz zurück — ohne ihn lag die Werbung auf der Bedienleiste
  (Neu/Zurück/Tipp/Mischen), so war es bis vc14. Als Ausgleich zeigt das **Interstitial jetzt jedes 2.
  gewonnene Level** statt jedes 3. (`shouldShowInterstitial`); die eigentliche Bremse bleibt der
  Mindestabstand. **Seit 10.8.2026 (v1.0.6) wieder entzerrt: jedes 3. gewonnene Level und 120 s
  Sperre** (`INTERSTITIAL_EVERY_NTH_WIN` + `INTERSTITIAL_MIN_GAP_MS`) — Josef war die Taktung zu dicht.
  Der Mindestabstand ist die eigentliche Bremse und gilt über dieselbe Konstante auch für
  `maybeShowInterstitialModes`, also für die Bonus-Spiele, die keinen Level-Zähler haben.
- **`public/app-ads.txt` — Verkäufer-Autorisierung (bares Geld).** Eine Zeile:
  `google.com, pub-8860791993288062, DIRECT, f08c47fec0942fa0`. Ohne diese Datei kaufen
  Werbetreibende, die nur bei autorisierten Verkäufern einkaufen, unser Inventar **nicht** —
  ohne dass irgendwo eine Fehlermeldung auftaucht, der eCPM ist einfach niedriger. Die
  **Publisher-ID gilt kontoweit**, nicht pro App: dieselbe Zeile liegt bei Swaply, und jede
  weitere ausliefernde App braucht sie unter *ihrer* eigenen Website (bei Apps ohne Auslieferung
  bringt sie nichts). Vercel kopiert `public/` in die Deploy-Wurzel, damit liegt sie unter
  `https://mahjong-app-plum.vercel.app/app-ads.txt` als `text/plain`.
  **Entscheidend ist nicht die Datei, sondern wo Google sie sucht:** der Crawler nimmt die
  **Entwickler-Website aus dem Store-Eintrag** und hängt `/app-ads.txt` an — Play
  `contactWebsite`, App Store `marketingUrl`. Steht dort eine andere oder keine Domain, ist die
  Datei wirkungslos. Beides prüft `python3 scripts/check-website-fields.py` (rein lesend,
  Exit-Code 1 bei Abweichung) — **vor jedem Release laufen lassen**, besonders wenn sich die
  Domain ändert. AdMob meldet „autorisiert" erst nach dem nächsten Crawl (~24 h).
  **Für iOS bis zur Freigabe gegenstandslos:** solange die App nicht im Store ist, gibt es keine
  Store-Seite, aus der der Crawler eine Website lesen könnte. Die Felder sind aber korrekt
  hinterlegt und greifen ab Veröffentlichung von selbst. **Seit der iOS-Freigabe am 29.7.2026 ist
  das nicht mehr theoretisch** — es gibt jetzt eine Store-Seite mit `marketingUrl`, der Crawler
  kann also greifen. Einmal in AdMob (Einstellungen → app-ads.txt) nachsehen, ob **beide** Apps als
  „autorisiert" geführt werden; steht dort etwas anderes, kauft ein Teil der Nachfrage stumm nicht
  mit — ohne Fehlermeldung, nur mit niedrigerem eCPM.
- **AdMob-Zahlen lesen (3.8.2026 einmal komplett falsch gedeutet, daher hier notiert).**
  Der **eCPM auf der App-Übersicht ist bei kleinen Mengen wertlos** — er ist nur
  `Einnahmen / Impressionen × 1000` über *alle* Formate zusammen. Beispiel aus der Praxis:
  iOS zeigte 1,95 €, Android 10,41 € und es sah nach einem schweren iOS-Problem aus. Tatsächlich
  standen dahinter 220 bzw. 73 Impressionen und zusammen 1,19 € Umsatz.
  **Regeln, die sich daraus ergeben:**
  (1) Unter ~1000 Impressionen je Plattform **gar nicht erst interpretieren** — Android schwankte
  mit sich selbst um +45 % pro Woche, und die Rangfolge der Formate kippte komplett (Interstitial
  0,62 € → 0,13 €).
  (2) **Immer nach Format aufschlüsseln, sonst vergleicht man Äpfel mit Birnen:** Banner ~0,2–1 €,
  Interstitial ~3–8 €, Rewarded ~8–25 € eCPM. Der Übersichtswert mittelt das zu einer Zahl, die von
  der Formatverteilung dominiert wird und nicht vom Preisniveau. Aufschlüsselung: App-Übersicht →
  Karte „Leistung des Anzeigenblocks" (Einnahmen je Block) bzw. „Bericht ansehen" → Dimension
  „Anzeigenformat" für Impressionen/eCPM. **Die Seite *Anzeigenblöcke* zeigt keine Zahlen**, nur
  die Einrichtung — dort nicht suchen.
  (3) **Ausreißer nach oben sind meistens Klicks**, nicht bessere Preise: AdMob zahlt auch pro
  Klick (0,20–0,50 € pro Banner-Klick). Bei 73 Impressionen hebt ein einziger Klick den
  Plattform-eCPM um mehrere Euro — genau das war der Android-„Vorsprung", der komplett in der
  Banner-Zeile steckte (0,58 € von 0,77 €).
  (4) Der Banner ist seit 8.8.2026 raus (siehe oben) — die Banner-Zeile in den Berichten läuft also
  aus. Damit fällt auch das alte Risiko weg, dass Fehltipps auf den Streifen unter der Bedienleiste
  als ungültiger Traffic gewertet werden. Beim Vergleich alter und neuer Wochen daran denken: der
  Rückgang der Gesamteinnahmen ist erwartet, entscheidend ist die Interstitial-/Rewarded-Zeile.
- `src/store/iap.ts` — IAP via cordova-plugin-purchase v13 (kein RevenueCat). Produkte:
  `remove_ads` (Non-Consumable), `coins_small/medium/large` (Consumable)
- `src/audio/sound.ts` — WebAudio-Synth **und Haptik**: `playTap`/`playMatch`/`playWin` lösen zusätzlich
  eine Vibration aus (nativ `@capacitor/haptics`, im Web `navigator.vibrate`; die VIBRATE-Berechtigung
  bringt das Plugin über sein eigenes Manifest mit). **iOS-Safari kennt `navigator.vibrate` nicht** —
  in der Web-App auf dem iPhone vibriert also nichts, nur in der nativen App. Getrennt vom Klang
  schaltbar (`progress.vibrate` + `setHapticsEnabled`, Schalter „Vibration" in den Einstellungen).
  KI-Abwürfe im 4-Spieler/Riichi rufen `playTap(false)` — Klang ja, Vibration nein.
- **Einstellungen (`src/ui/Screens.tsx` + `.row`/`.segment` in styles.css) — Bildschirmbreite.**
  ⚠ **`overflow-y: auto` macht die andere Achse stillschweigend ebenfalls scrollbar.** Das ist
  CSS-Spezifikation: Steht eine Achse auf `visible` und die andere nicht, rechnet der Browser die
  `visible`-Achse auf `auto` hoch. Ein **einziges** zu breites Kind macht damit den GANZEN Bildschirm
  seitlich verschiebbar — und weil dann alles nach links rutscht, sieht es nach abgeschnittenen
  Beschriftungen und „kaputten Sprachen" aus, nicht nach einem Layout-Fehler. Genau so gemeldet am
  10.8.2026 aus der Store-Version (1.0.4, Spanisch): Die Sprachauswahl war seit den 7 Sprachen auf
  **8 Knöpfe** gewachsen und maß auf 402 px Bildschirmbreite **370 px ab x=96**, endete also bei 467 px —
  „IT" und „JA" lagen komplett außerhalb und waren nicht antippbar.
  **Regeln daraus:** (1) `.screen-body` hat jetzt ausdrücklich `overflow-x: hidden` als Riegel;
  (2) Auswahlen, die neben ihrer Beschriftung nicht in eine Zeile passen, bekommen `.row-stack`
  (Beschriftung darüber) — betrifft Sprache **und** KI-Stärke, deren Beschriftung in romanischen
  Sprachen lang wird; (3) die Sprachauswahl ist ein festes 4er-Raster (`.segment-lang`, zwei Reihen
  à vier) statt eines Umbruchs, sonst steht ein einzelner Knopf allein in Reihe zwei;
  (4) `.segment` bricht zusätzlich um (`flex-wrap`) — Notnetz, damit eine künftige lange Übersetzung
  Knöpfe umbricht statt sie hinter `overflow-x: hidden` unerreichbar zu machen.
  **Prüfmuster** (jede Layout-Änderung an Einstellungen so testen, Skript im Session-Scratchpad):
  über **mehrere Breiten × Sprachen** (320/402/430 px × de/es/ja/pt) je Element `getBoundingClientRect`
  gegen `innerWidth` prüfen, `scrollWidth > clientWidth` auf `.app`/`.screen-body`/`.row` messen **und**
  per `document.elementFromPoint` gegenprüfen, dass ein Tipp in die Mitte jedes Knopfes ihn wirklich
  trifft. Auf kleinen Geräten vorher `scrollIntoView` — sonst misst der Treffertest ins Leere und
  meldet einen Fehler, den es nicht gibt.
- **Versionsanzeige** (`src/appVersion.ts`): Die Nummer unten in den Einstellungen kommt aus
  `App.getInfo()` (`@capacitor/app`), also aus dem nativen Paket — im Web steht „Web". Vorher war
  dort `v1.0` fest verdrahtet und damit **vier Releases lang falsch**. Nie wieder eine Versionsnummer
  in den Web-Code schreiben: pbxproj und build.gradle sind die Quelle, alles andere veraltet.
- `src/i18n.ts` — **7 Sprachen** (seit 30.07.2026): DE/EN vollständig in `i18n.ts` (maßgebliche
  Quelle), ES/PT/FR/IT/JA als generierte Sprachpakete in `src/locales/*.ts` (`LocalePack`:
  ui-Overrides + 34 Fakten + Erinnerungstext; fehlt ein Schlüssel → Fallback Englisch, die App
  bricht also nie). Neue UI-Keys nur in `i18n.ts` anlegen; die Sprachpakete beim nächsten
  Übersetzungslauf nachziehen. Fakten-Texte über `factText()`, Erinnerung über `notifyText()` —
  nirgends mehr `lang === 'en' ? … : …` hart verdrahten. Smoke-Test-Muster: Vite-Preview +
  puppeteer mit überschriebenem `navigator.language` (alle 7 Sprachen am Play-Knopf verifiziert).
- Persistenz via `@capacitor/preferences` (`src/progress.ts`)

## WICHTIG: patch-package

`patches/@capacitor-community+admob+6.2.0.patch` ist eine echte UMP-3.x-Portierung (GDPR-Consent).
**Niemals entfernen** (postinstall). Bei Änderung am Patch: Vercel cached node_modules → nächster
Build bricht mit „Failed to apply patch" ab → einmalig ohne Cache deployen
(`"build":{"env":{"VERCEL_FORCE_NO_BUILD_CACHE":"1"}}` im API-Deploy-Body).

## Deploy (Web)

- Live: https://mahjong-app-plum.vercel.app (Vercel-Projekt „mahjong-app", Konto almaz6380)
- **NICHT `vercel deploy`** (CLI-Upload hängt in diesem Netz endlos) — stattdessen `git push`
  (GitHub-Integration, Repo almaz6380/mahjong-app, repoId 1289297254). Triggert der Webhook nicht:
  `POST api.vercel.com/v13/deployments?teamId=team_hp1h5xj3PD8KAn98cxsWddt6` mit gitSource ref main.
- **Git-Autor muss 63almaz80@gmail.com sein** (celorenz1234@… blockiert Vercel-Deploys!)
- Web zeigt keine echten Ads/IAP — beides nur nativ.
- **`vercel.json` — kurze Adressen ohne `.html`** (`/links`, `/privacy`, `/datenschutz`,
  `/impressum`). Bewusst `rewrites`, nicht `redirects`: Die schöne Adresse soll in der Zeile
  stehen bleiben, statt auf die Datei umzuspringen — der Link im Instagram-Profil ist genau
  das, was der Besucher sieht. Die alten `*.html`-Adressen funktionieren unverändert weiter;
  die Store-Einträge zeigen darauf und dürfen nicht brechen.
  ⚠ **Die vercel.app-Adresse ist frei wählbar** (Settings → Domains): `mahjong-app-plum` ist
  bloß der Zufallsname vom Anlegen. Eine schönere Subdomain **hinzufügen, nie ersetzen** —
  an der im Store hinterlegten Website hängt `app-ads.txt` und damit Werbegeld (siehe dort).

## Besucherzahlen: wo welche Zahl steht (seit 16.08.2026)

Die Frage „wie viele Leute waren da und wann?" hat **vier verschiedene Antworten**, je nachdem,
wonach gefragt ist — und nur eine davon kennt Uhrzeiten:

| Quelle | Was | Zeitauflösung |
|---|---|---|
| **Vercel → Projekt „mahjong-app" → Analytics** | Besucher/Seitenaufrufe der **Web-Fassung**, Referrer, Land, Gerät | **stundengenau** |
| Play Console → Statistiken | Installationen, aktive Nutzer, Sitzungen (Android-App) | tagesweise |
| App Store Connect → App-Analysen | Impressionen, Downloads, Sessions, aktive Geräte (iOS-App) | tagesweise |
| AdMob | Impressionen als grober Aktivitätsindikator (nur nativ) | tagesweise |

Store-Konsolen rechnen also **in Tagen**; wer eine Uhrzeit braucht, muss in Vercel schauen.

**Die Zählung ist absichtlich auf das Web beschränkt** (`src/analytics.ts` + je ein `<script>` in
`public/links.html`, `privacy.html`, `impressum.html`).

⚠ **Der Riegel gegen die native App ist die ganze Sache.** Capacitor kopiert das gebaute Bundle
unverändert nach ios/ und android/ — ohne `Capacitor.isNativePlatform()`-Sperre würden die
Store-Apps mitfunken. Das wäre eine neue Datenweitergabe und müsste in **Apples „App Privacy"**,
in **Plays „Data safety"** und in `public/privacy.html` stehen; die App ist heute in allen dreien
als trackingfrei geführt. Wer die Sperre entfernt, muss alle drei nachziehen — sonst stimmen die
Store-Angaben nicht mehr. Auf `localhost` zählt es ebenfalls nicht, damit dev/preview still bleibt.
Prüfskript: **`npm run build && node scripts/check-analytics.mjs`** — lädt das FERTIGE `dist/` in
einem echten Browser und zählt die Aufrufe an `/_vercel/insights/`. Zwei Kunstgriffe stecken darin:
`window.androidBridge` setzen (so erkennt Capacitor eine native WebView) und ein Host-Alias über
Chromes `host-resolver-rules` (weil localhost bewusst nicht zählt). Der Server im Skript ist
bewusst selbstgebaut statt `vite preview` — Vite blockt fremde Hostnamen und macht damit genau
den Web-Fall unprüfbar.

⚠ **Ohne den Schalter im Vercel-Dashboard passiert gar nichts.** Das Zählskript liegt unter
`/_vercel/insights/script.js` und existiert erst, wenn im Projekt unter *Analytics* Web Analytics
aktiviert ist — vorher 404 und keine Zahlen, ohne jede Fehlermeldung. Kostenlos bis 50.000 Events
im Monat (Hobby-Plan).

Die App ist eine Single-Page-Anwendung ohne Router, es gibt also **einen Seitenaufruf je Besuch** —
gut für „wie viele und wann", aber es sagt nichts darüber, welche Spielmodi benutzt werden. Dafür
bräuchte es eigene Ereignisse (`track()`), das ist bewusst nicht eingebaut.

## Store-Zahlen lesen (Workflow „Store-Zahlen", seit 1.9.2026)

`.github/workflows/store-zahlen.yml` + `scripts/store-zahlen.py` holen
Installationen, Downloads und den Akquise-Trichter — **rein lesend**, es wird
nichts veroeffentlicht. Der Sinn: Die Schluessel bleiben Repo-Secrets, und
trotzdem kann eine Cloud-Sitzung die Zahlen sehen (Josef loest den Lauf aus,
Claude liest das Protokoll). Ergebnis steht im Lauf-Protokoll und als Artefakt
`store-zahlen`.

⚠ **Die Publishing-APIs kennen keine Statistiken.** Weder androidpublisher noch
die Play Developer **Reporting** API liefern Installationen oder Akquise — die
Reporting-API hat nur Abstuerze, ANRs und Startzeiten. Wer dort sucht, sucht
falsch. Die Zahlen liegen woanders:

| Zahl | Quelle |
|---|---|
| Installationen Android | CSV-Export im GCS-Eimer `pubsite_prod_*`, `stats/installs/` |
| Impressionen → Besucher → Akquise (Android) | derselbe Eimer, `stats/store_performance/` |
| Downloads iOS | ASC `salesReports` (taeglich, ab Folgetag) |
| Impressionen/Bindung iOS | ASC Analytics-Reports — **einmal anfordern**, Apple braucht 1–2 Tage |
| **Bindungsrate Android** | **nur die Play Console**, kein Export |

⚠ **Zwei Werte muessen von Hand hinterlegt werden**, sonst ueberspringt das
Skript den jeweiligen Teil (mit Hinweis, es bricht nicht ab). Beide als
Repo-*Variables* (nicht Secrets, sie sind nicht geheim):
`PLAY_REPORTS_BUCKET` (Play Console → Downloadberichte → Statistiken →
„Cloud Storage-URI kopieren", davon der Teil zwischen `gs://` und dem ersten
Schraegstrich) und `ASC_VENDOR_NUMBER` (App Store Connect → Zahlungen und
Finanzberichte; das Skript versucht sie sonst aus Apples Fehlermeldung zu
lesen, was klappen kann, aber nicht muss).

⚠ **Apple braucht ZWEI Schluessel.** Der vorhandene Upload-Schluessel
(`VGHCB8Z8Q2`, Rolle App-Manager) darf keine Verkaufs- oder Analytics-Berichte
lesen — Apple antwortet mit **403 „The API key in use does not allow this
request"**. Das liest sich wie ein kaputter Schluessel und ist keiner: Die
Zugangsprobe im Skript zeigt, dass derselbe Schluessel die App-Daten sehr wohl
liest. Berichte verlangen die Rolle **Finanzen** (oder Admin). Deshalb nimmt der
Workflow bevorzugt `ASC_READ_KEY_ID` + `ASC_READ_KEY_P8_BASE64` und faellt nur
zur Diagnose auf die Upload-Secrets zurueck. Die Issuer-ID ist kontoweit
dieselbe, die braucht es kein zweites Mal.

⚠ **Verkauf und Analytics verlangen VERSCHIEDENE Rollen** (am 2.9.2026
gemessen, nicht geraten): Derselbe Schluessel mit Rolle **Finanzen** darf
`salesReports` lesen und vorhandene `analyticsReportRequests` ansehen — aber
eine Analytics-Anforderung ANZULEGEN quittiert Apple mit demselben 403
„The API key in use does not allow this request". Dafuer braucht es **ADMIN**.
Praktische Folge: Downloads pro Tag gehen mit dem Finanzen-Schluessel;
Impressionen und Bindungsrate fuer iOS bleiben ohne Admin-Schluessel
Handarbeit in App Store Connect.

⚠ **`salesReports` verlangt `Accept: application/a-gzip`.** Ohne den Header
antwortet Apple **406**, bevor es die Parameter prueft — dann nennt es auch die
gueltigen Verkaeufernummern nicht, und es sieht nach einem Rechteproblem aus.
Am 2.9.2026 genau so reingefallen.

⚠ **Das Dienstkonto braucht fuer den Eimer ein eigenes Leserecht** — die
Admin-Rechte fuers Veroeffentlichen genuegen nicht. Kommt HTTP 403, sagt das
Skript genau das; das Recht wird in der Play Console unter Nutzer und
Berechtigungen gegeben.

**Noch nie gegen die echten APIs gelaufen** (Stand 1.9.2026): In der
Cloud-Umgebung liegen keine Store-Schluessel, gepruft sind nur Syntax, der
UTF-16-CSV-Pfad und das Verhalten ohne Zugangsdaten. Der erste echte Lauf
braucht wahrscheinlich noch eine Runde Nachbesserung — vor allem die
Spaltennamen der Play-Berichte und die Produkttyp-Filterung bei Apple.

## Builds ohne eigenen Mac (GitHub Actions)

`.github/workflows/android-release.yml` + `ios-release.yml` bauen, signieren und laden auf GitHubs
Rechnern hoch — von Hand startbar (`workflow_dispatch`), nie automatisch bei einem Push. Damit kann
auch eine Cloud-Sitzung ein Release auslösen. **Einrichtung + die neun Secrets: `store/ci-setup.md`.**
Erster Lauf immer mit abgeschaltetem Upload (Schalter „nur bauen"), dann mit.

**Wichtig auf einem frischen Rechner:** Im Repo liegen bewusst KEINE Schlüssel —
`android/upload-keystore.jks`, `android/keystore.properties`, `~/.config/play-publisher/key.json`
und `~/.appstoreconnect/private_keys/*.p8` sind gitignored bzw. außerhalb des Repos. Ein neuer Mac
kann also erst bauen, wenn diese Dateien aus dem Backup dorthin kopiert wurden — oder man nimmt
gleich den Action-Weg, der die Schlüssel aus den GitHub-Secrets zieht.

## Native Builds (Launch-Rezept, verifiziert 12.7.2026)

**Skripte im Repo** (nur auf dem Mac lauffähig — Android-SDK, Keystore und Signier-Zertifikate liegen
nicht im Repo). Sie machen Vorprüfung + Build + Upload in einem Rutsch:
```
bash scripts/release-android.sh     # tsc + check-figures + build + sync + signiertes AAB
python3 scripts/play-upload.py --aab <pfad>.aab --complete --notes "…"       # an alle veröffentlichen
python3 scripts/play-upload.py --status                                      # Produktions-Track ansehen
bash scripts/release-ios.sh         # archivieren, exportieren, per altool hochladen
python3 scripts/asc-status.py       # Versionen/Builds/offene Prüfungen (nur lesend)
```
`release-android.sh` bricht ab, wenn die Google-Test-Werbe-ID im Bundle steckt (USE_TEST_ADS).
Die Schritte darunter sind dieselben von Hand — falls ein Skript klemmt.

Vorher immer: `npm run build && npx cap sync`, Build-Nummern erhöhen
(iOS: `CURRENT_PROJECT_VERSION` in project.pbxproj ×2 Stellen; Android: `versionCode` in app/build.gradle).

**iOS** (manuelle Distributions-Signierung, im App-Target des pbxproj verankert):
```
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
  -destination "generic/platform=iOS" -archivePath <pfad>.xcarchive archive
xcodebuild -exportArchive -archivePath <pfad>.xcarchive \
  -exportOptionsPlist ~/Desktop/mahjong-ios-export/ExportOptions.plist -exportPath <out>
```
Upload: `xcrun altool --upload-app -f App.ipa -t ios --apiKey VGHCB8Z8Q2 --apiIssuer 0d4e473b-2807-4c66-9857-6b0eb78e62ce`
(Key in `~/.appstoreconnect/private_keys/`).
**Einreichen per ASC-API** (Build zuweisen + Screenshots + zur Prüfung schicken, alles ohne UI):
JWT (ES256, KeyID VGHCB8Z8Q2 / Issuer 0d4e473b-…) → App-ID 6787721454, Version-ID e2efe72e-….
Laufende Prüfung abbrechen: PATCH `/v1/reviewSubmissions/{id}` `{canceled:true}` (Version → editierbar).
Build zuweisen: PATCH `/v1/appStoreVersions/{id}/relationships/build`. Screenshots: DELETE alte +
3-Schritt-Upload (POST `/v1/appScreenshots` {fileName,fileSize,set} → PUT bytes an uploadOperations →
PATCH `{uploaded:true,sourceFileChecksum:md5}`). **Einreichen NUR über neue reviewSubmissions-API**
(alte appStoreVersionSubmissions erlaubt kein CREATE): POST `/v1/reviewSubmissions` {platform IOS, app}
→ POST `/v1/reviewSubmissionItems` {reviewSubmission, appStoreVersion} → PATCH `{submitted:true}`.
(altool ist NICHT auto-mode-geblockt; asc-Skripte lebten zuletzt im Session-Scratchpad.)

**Android** (Upload-Keystore `android/upload-keystore.jks` + `keystore.properties`, gitignored — sichern!):
```
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```
minSdk 23 / compileSdk+targetSdk 35 (Billing-Lib 9 + Play-Pflicht).

**Upload + Release per Play-Developer-API** (kein manuelles Hochladen mehr nötig): Dienstkonto-Key
`~/.config/play-publisher/key.json` (`play-upload@wellbooked-501311.iam.gserviceaccount.com`, hat
Admin-Recht für die App). Rein per REST (pyjwt+cryptography, kein google-api-python-client):
SA-JWT RS256 → `oauth2.googleapis.com/token` (scope androidpublisher) → Bearer-Token. Dann eine
Edit-Transaktion: `POST /upload/androidpublisher/v3/applications/{pkg}/edits/{eid}/bundles?uploadType=media`
(AAB → versionCode) → Bilder `DELETE` + `POST /upload/.../listings/de-DE/{phoneScreenshots|sevenInchScreenshots|icon}?uploadType=media`
→ `PUT /edits/{eid}/tracks/production` {release name, versionCodes, status:"completed", releaseNotes}
→ `:validate` → `:commit`. **Play-Listing nur de-DE.** Wenn 403 „PERMISSION_DENIED": SA hat für die App
noch keine Freigabe → in Play Console (Nutzer und Berechtigungen → SA-Mail einladen) Admin-Recht geben.

## Store-Koordinaten

- Name „Mahjong Royale", appId `com.mahjongroyale.app`, ASC-App-ID 6787721454, Team JU8STVD4SJ
- AdMob-Publisher pub-8860791993288062 (Konto 63almaz80@gmail.com), IDs in `admob-ids.md`
- Store-Texte/Screenshots/Rezepte in `store/` (texts.md)
- **Store-Lokalisierung (30.07.2026) — 7 Sprachen auf beiden Plattformen:** de-DE, en-US, es-ES,
  pt-BR, fr-FR, it-IT, ja-JP. Texte in `store/ios-locales.json`.
  **Skripte (alle idempotent, rein additiv):**
  `scripts/add-ios-locales.py` (Beschreibung/Keywords/whatsNew + Name/Untertitel),
  `scripts/upload-ios-screenshots.py` (spiegelt die englischen Sätze in neue Sprachen),
  `scripts/render-feature-graphic.mjs` + `scripts/upload-feature-graphics.py` (Play, 1024×500 je Sprache),
  `scripts/render-app-icon.mjs` (App-Icon aus den drei Steinen).
  **Fallen, die uns eingeholt haben:**
  (1) Apple **sperrt Metadaten während der Prüfung** → 409 auf jeden POST. Neue Sprachen nur
  anlegen, wenn die Version `PREPARE_FOR_SUBMISSION`/`DEVELOPER_REJECTED` ist.
  (2) Legt man eine Sprache an, erzeugt Apple die `appInfoLocalization` **selbsttätig und kopiert
  den deutschen Untertitel** — danach immer prüfen und per PATCH korrigieren.
  (3) **Ohne Screenshots je Sprache lässt sich nicht einreichen** (Apple erbt sie nicht).
  (4) Play zeigt die **Feature-Grafik der Standardsprache**, wenn eine Sprachfassung fehlt —
  darum stand „4 Spieler" auch im japanischen Eintrag. Grafik gibt es **nur bei Play**, der
  App Store kennt keine; Play-Listings sind zudem vom Build entkoppelt und lösen keine Prüfung aus.
  (5) `@capacitor/assets generate` schreibt die PWA-Icons nach `icons/`, ausgeliefert wird aber
  `public/icons/` + `public/pwa-*.png` + `public/apple-touch-icon.png` — die von Hand nachziehen.
  (6) **Die Sprachcodes an der Version heißen nicht überall gleich** (bei 1.0.4 reingefallen):
  Apple führt unsere sieben als `de-DE`, `en-US`, `es-ES`, `pt-BR`, `fr-FR` — aber **`it` und `ja`
  ohne Länderteil**. Steht in der `--notes-file` von `asc-submit.py` `it-IT`/`ja-JP`, findet das
  Skript den Schlüssel nicht und setzt still den englischen Text. Vorlage mit den richtigen
  Schlüsseln: `store/whatsnew-1.0.4.json`. Die tatsächliche Liste druckt das Skript als
  „Sprachen an der Version" — **vor dem `--submit` einmal ansehen**, danach sind die Metadaten
  bis zum Prüfungsende gesperrt.
- Ersteinreichung 6.7.2026 (iOS Build 2 / Android vc3); **iOS wegen 4.3(a) „Design: Spam" abgelehnt**.
- **Neu eingereicht 12.7.2026, v1.0 — iOS Build 10 / Android versionCode 11**: mit Riichi, natürlichem
  Jade-Look, drehendem 3D-Stein, neuem Icon/Splash, neuen Screenshots (iPhone+iPad / Handy+Tablet),
  differenzierter Beschreibung + Reviewer-Antwort im Resolution Center gegen 4.3a. Store-Assets in
  `~/Desktop/mahjong-*export*` (Icon 512, Feature 1024×500, AAB, Screenshots).
- **17.7.2026 — Build 12/vc13 gebaut** (Gemini-Stein-Designs, große Bretter, gestapelte Level);
  nie hochgeladen, durch 13/vc14 ersetzt.
- **18.7.2026 — Build 13 / vc14 in beide Stores hochgeladen (v1.0, per API):** kleine Verbesserungen
  (Level schwerer, Achter-Kreis-Stein zentriert). iOS Build 13 per altool → alte Build-10-Prüfung
  abgebrochen → Build 13 + neue Screenshots (de-DE+en-US, iPhone+iPad) zugewiesen → neu eingereicht
  (**am 29.7.2026 freigegeben, siehe unten**). Android **vc14 per Play-API in Produktion** veröffentlicht (Release „14 (1.0)",
  status completed) inkl. neuer Telefon- **und** 7-Zoll-Tablet-Screenshots + neuem 512-Icon.
  Artefakte: `~/Desktop/MahjongRoyale-ios-1.0-b13.ipa`, `MahjongRoyale-android-1.0-vc14.aab`.
  Store-Screenshots in `store/ios-screenshots/*` + `store/play-screenshots/*` (Play-Tablet = iPad-Set).
  Play-Feature-Grafik `store/play-feature-graphic.png` (1024×500) am 18.7. neu im Jade-/Marmor-Look
  (Marmor-Steine mit Goldrand+3D, Motive Drache/中/Münze, Untertitel „Solitaire · Riichi · Connect ·
  4 Spieler") per API ersetzt (de-DE). Render-Rezept: HTML mit eingebetteten `src/assets`-Bildern
  (`tiles/face-marble.webp` + Motive + `symbol-zhong.webp`, Inter-woff2) → puppeteer-core/System-Chrome,
  viewport 1024×500 dsf 1, screenshot clip. App Store hat keine Feature-Grafik.
- **28.7.2026 — Versionsnummern auf iOS Build 14 / Android vc15 gesetzt, NOCH NICHT gebaut/hochgeladen.**
  Inhalt gegenüber Build 13/vc14 (alles bereits live im Web, `main`): Levelwechsel repariert (es kam
  immer wieder dasselbe Brett), Belohnungskarte blitzt nach der Infokarte nicht mehr auf, Sackgassen-
  Ausweg statt wirkungslosem „Mischen", iOS-Ruckeln beim Antippen beseitigt, angetippter Stein wird
  golden getönt. **Bauen und signieren geht nur auf dem Mac** (Android-SDK + `upload-keystore.jks`
  liegen nicht im Repo): `git pull && npm run build && npx cap sync`, dann die Rezepte unter
  „Native Builds". Für iOS ist **nichts mehr abzubrechen** — Build 13 ist seit 29.7. freigegeben,
  Build 14 kann direkt eingereicht werden. (Der Abbruch-Weg, falls doch mal eine Prüfung hängt:
  PATCH `/v1/reviewSubmissions/{id}` `{canceled:true}` — siehe `scripts/asc-status.py`.)
- **29.7.2026 — iOS v1.0 (Build 13) ist im App Store live** (`READY_FOR_SALE`, automatische
  Veröffentlichung nach Freigabe). Damit ist die App auf **beiden** Plattformen veröffentlicht.
  Bemerkenswert für die Planung künftiger Einreichungen: die Prüfung lag **11 Tage** in
  `WAITING_FOR_REVIEW` (18.7. 08:21 UTC bis 29.7. vormittags) und war dann in gut zwei Stunden
  durch. Das ist die Nachwirkung der 4.3(a)-Ablehnung — nach einer Spam-Ablehnung landet die
  erneute Einreichung in einer vertieft geprüften Warteschlange. **Nicht in Panik abbrechen und
  neu einreichen**: geprüft waren damals Verträge (alle aktiv), Resolution Center (keine
  Nachricht), Exportcompliance, Build-Zuordnung und Metadaten — alles einwandfrei, es war reine
  Wartezeit. Ein Abbruch hätte die 11 Tage verschenkt. Statusabfrage: `python3 scripts/asc-status.py`.
- **31.7.2026 — v1.0.2 (Android vc18 / iOS Build 17): Bugfix für belohnte Videos.** Gemeldet aus der
  Store-Version: Video fürs Mischen komplett angesehen, danach weder Booster noch Münzen.
  **Merken für jede künftige Rewarded-Arbeit:** `showRewardVideoAd()` löst im Plugin
  ausschließlich im Belohnungs-Callback auf (iOS `userDidEarnRewardHandler`, Android
  `onUserEarnedReward`). Bricht der Nutzer ab, antwortet das Plugin **nie** — ein blankes `await`
  hängt für immer und die Oberfläche tut stumm gar nichts. Darum hört `requestReward()`
  (`src/ads/admob.ts`) zusätzlich auf `Showed`/`Dismissed`/`FailedToShow`, wertet die Auflösung der
  Plugin-Promise selbst als Beleg (nicht nur das `Rewarded`-Ereignis — sonst entscheidet ein
  Reihenfolge-Rennen über die Belohnung), begrenzt hart auf Zeit und verwirft eine zweite
  gleichzeitige Anfrage. Ergebnis `'earned' | 'aborted' | 'unavailable'`; **jeder** Fehlschlag muss
  eine Meldung zeigen (`watchRewardedAd()` in `src/ui/reward.ts` + globaler `ToastHost`) — vorher
  stiegen alle Modi bei `false` wortlos aus. Zweiter Teil des Fehlers: Die Belohnung wurde
  unsichtbar sofort verbraucht statt gutgeschrieben, das Abzeichen blieb zwangsläufig auf 0;
  jetzt `refillBooster(+1)` mit Toast. Android ging per Play-API sofort an alle Nutzer, iOS am
  selben Tag eingereicht (neues `scripts/asc-submit.py`: Version anlegen + whatsNew in allen
  Sprachen + Build zuweisen + einreichen; ohne `--submit` reiner Probelauf).
- **31.7.2026 — v1.0.3 (Android vc19): Kaufabfrage in Connect und Dimensions 3D.** Beide Modi haben
  Münzen für Tipp/Mischen **wortlos abgebucht**, sobald genug da waren — ein Video gab es nur, wenn
  man blank war. Jetzt fragt derselbe Dialog wie im Solitaire („Münzen" oder „Video ansehen"),
  global gemountet als `src/ui/BuyPrompt.tsx` (Muster `FactHost`), Ausführung über
  `payOrWatch()` in `src/ui/pay.ts`. Dafür hat `ModeApi` ein Feld `coins` bekommen (der Münz-Knopf
  muss ausgegraut werden können). **Android vc19 sofort live; iOS auf Josefs Wunsch nachgezogen**,
  damit beide Plattformen denselben Stand tragen: die laufende Prüfung von 1.0.2 (Build 17) wurde
  abgebrochen und stattdessen **1.0.3 / Build 18** eingereicht.
  **Stand 3.8.2026: iOS 1.0.3 (Build 18) ist freigegeben und live** — beide Plattformen tragen
  damit denselben Stand (Android vc19 / iOS Build 18). Zur Planung: von der Einreichung am 31.7.
  bis zur Freigabe vergingen **rund drei Tage** — die 11 Tage vor Build 13 waren also wirklich die
  einmalige Nachwirkung der 4.3(a)-Ablehnung und nicht die Regel. Auch der Abbruch der laufenden
  1.0.2-Prüfung (Schritt 1 des Rezepts unten) hat die Freigabe nicht spürbar verzögert.
  **Rezept „Build gegen laufende Prüfung austauschen"** (drei Schritte, Skripte im Repo):
  1. `python3 scripts/asc-cancel.py --yes` — Version fällt auf `DEVELOPER_REJECTED` und ist wieder
     editierbar. **Kostet die Warteposition** (nach der 4.3a-Ablehnung waren das einmal 11 Tage) —
     deshalb erst den neuen Build hochladen und verarbeiten lassen, dann abbrechen.
  2. Die vorhandene Version **umbenennen statt eine zweite anzulegen**: Apple erlaubt nur EINE
     Version in Arbeit, und ihre Nummer muss zur `CFBundleShortVersionString` des Builds passen —
     `scripts/asc-submit.py --version 1.0.3 --rename-from 1.0.2 …`.
  3. Derselbe Aufruf setzt whatsNew je Sprache, weist den Build zu und reicht ein (`--submit`).
  Ohne `--yes` bzw. `--submit` sind beide Skripte reine Probeläufe.
- **9.8.2026 — v1.0.4 (Android vc20 / iOS Build 19): der Werbebanner ist raus.** Josef störte der
  Streifen unten am Brett; Banner ersatzlos entfernt, Interstitial dafür jedes 2. statt jedes 3.
  gewonnene Level (Commit `a207d5f`, Einzelheiten im `src/ads/admob.ts`-Abschnitt oben). **Erstmals
  komplett über die GitHub-Actions gebaut und ausgeliefert** — kein lokaler Build, kein Xcode:
  „Android Release" (vc20, Rollout an alle, in Produktion) und „iOS Release" (Build 19 → ASC),
  danach `scripts/asc-submit.py … --submit`. Android war in ~6 min live.
  **Der Auto-Modus von Claude Code blockt das Auslösen der Release-Workflows** (`gh workflow run`):
  Josef muss sie per `!`-Prefix selbst starten, die ASC-Skripte liefen dann durch. Das kostet zwei
  Chat-Runden — beim Planen einrechnen.
  **Nachspiel ITMS-90068 („MinimumOSVersion too low"):** Apple hat Build 19 zwar angenommen
  (reine Warnung, „delivery was successful"), verlangt aber **ab Frühjahr 2027 mindestens iOS 15**
  für jeden Upload. Deshalb steht das Deployment-Target jetzt auf **15.0** — an **vier** Stellen im
  `project.pbxproj` *und* in `ios/App/Podfile` (`platform :ios, '15.0'`); danach `pod install`
  (aktualisiert `Podfile.lock`). Verifiziert mit einem Simulator-Build
  (`xcodebuild -sdk iphonesimulator … CODE_SIGNING_ALLOWED=NO build` → BUILD SUCCEEDED). Greift mit
  dem nächsten Build, 1.0.4 selbst wurde dafür bewusst nicht neu gebaut.
- **10.8.2026 — v1.0.5 (Android vc21 / iOS Build 20): Sprachauswahl passt wieder auf den Bildschirm.**
  Josef meldete aus der Store-Version zwei Dinge: „Sprachen sehen komisch aus" und „Bildschirm ist
  beweglich". Es war **ein** Fehler — die auf 8 Knöpfe gewachsene Sprachauswahl war breiter als das
  Display und machte den Einstellungsbildschirm seitlich verschiebbar (Ursache und Regeln im Abschnitt
  „Einstellungen — Bildschirmbreite" oben). Behoben: 4er-Raster für die Sprachen, gestapelte Zeilen für
  Sprache und KI-Stärke, `overflow-x: hidden` als Riegel. Dazu die **Versionsanzeige** repariert (stand
  seit vier Releases auf „v1.0", liest jetzt das native Paket).
  Dieses Release trägt außerdem als Erstes das **iOS-Deployment-Target 15.0** (ITMS-90068, siehe 9.8.).
  **Lehre aus der Meldung selbst:** Josef sah zuerst noch den Werbebanner und hielt 1.0.4 für nicht
  ausgeliefert. Tatsächlich war die Store-Version live, nur sein Gerät noch nicht aktualisiert — der
  Versionsverlauf im App Store zeigt die **veröffentlichte**, nicht die **installierte** Fassung.
  Bei „Fix wirkt nicht"-Meldungen also immer zuerst die installierte Version klären; genau dafür gibt
  es die Versionszeile jetzt in der App.
- **10.8.2026 — v1.0.6 (Android vc22 / iOS Build 21): Werbung entzerrt.** Josef wollte gleich nach
  1.0.5 größere Abstände: Interstitial nur noch **jedes 3.** gewonnene Level (statt jedes 2.) und
  **120 s** Mindestabstand (statt 75 s). Damit ist die Taktung wieder wie vor dem Wegfall des Banners,
  nur mit längerer Sperre.
  **Release-Entscheidung, die sich lohnt zu merken:** 1.0.5 war zu diesem Zeitpunkt schon gebaut —
  Android vc21 war ausgerollt, **iOS Build 20 lag hochgeladen, aber noch nicht eingereicht**. Deshalb
  wurde Build 20 **gar nicht erst eingereicht**, sondern gleich Build 21 mit beiden Änderungen als
  1.0.6 geschickt. Das spart eine komplette Prüfrunde, ohne den Sprachfix zu verzögern: Beide Wege
  brauchen genau eine Prüfung. **Ein hochgeladener, nicht eingereichter Build kostet nichts** — er
  bleibt in ASC liegen und kann übersprungen werden.
  **Bei Play gibt es kein Zurücknehmen:** Ein Release mit `status: completed` (100 %) lässt sich nicht
  anhalten — `halt` geht nur bei laufendem Stufen-Rollout (`inProgress`). Der einzige Weg, ein
  ausgeliefertes Release zu ersetzen, ist ein **neues Release mit höherem versionCode** auf demselben
  Track; es überschreibt das alte für alle Nutzer. Wer also „abbrechen" möchte, bekommt in der Praxis
  „überschreiben" — und sollte den Rollout beim nächsten heiklen Release lieber gestuft starten
  (`--fraction 0.2`), dann ist ein echtes `halt` möglich.
- **11.8.2026 — v1.1.0 (Android vc23 / iOS Build 22): das erste Feature-Release seit
  1.0.** Vier Dinge in einem Build, auf Josefs Wunsch bewusst gebündelt: Tempel-Motiv
  auf allen Bildschirmen, verdeckte Steine ab Level 30, Spezialsteine ab Level 50,
  Paare-Modus auf echten Figuren.

  | | Stand am 11.8. abends |
  |---|---|
  | Android | **vc23 in Produktion, Rollout 100 %** (erst 20 %, dann hochgezogen) |
  | iOS | **Build 22 eingereicht**, `WAITING_FOR_REVIEW`, reviewSubmission `2cdfbce2-…` |
  | Web | `main` deployt |

  Einzelheiten stehen oben bei den jeweiligen Abschnitten — hier nur, was fürs
  Release zählt:
  - **Store-Screenshots sind neu und kommen jetzt aus einem Skript**
    (`node scripts/store-screenshots.mjs`, braucht `npx vite preview --port 5199`
    und `CHROME=…`). Vorher entstanden sie von Hand; mit dem Tempel im Rücken
    zeigten alle alten Bilder den Vorzustand. Das Skript erzeugt fünf Motive in
    vier Formaten (iPhone 6,5" DE/EN, iPad 12,9" DE/EN) plus den Play-Satz.
    ⚠ Play-Handy-Bilder müssen **≤ 2:1** sein — die iPhone-1284×2778 sind zu hoch,
    darum ein eigenes Format 1080×2148 statt einer Skalierung.
  - Versionshinweise in `store/whatsnew-1.1.0.json`, alle sieben Sprachen. Die
    Schlüssel heißen an der Version `de-DE`, `en-US`, `es-ES`, `pt-BR`, `fr-FR`
    sowie **`it` und `ja` OHNE Länderteil** (die Falle von 1.0.4).
  - **1.0.6 (Build 21) wurde abgebrochen und nie an iOS-Nutzer ausgeliefert.**
    Es hing seit dem 10.8. abends in `WAITING_FOR_REVIEW` und blockierte damit
    1.1.0 — Apple erlaubt nur EINE Version in Arbeit. Inhaltlich geht nichts
    verloren: Die Werbe-Entzerrung aus 1.0.6 steckt vollständig in 1.1.0. Wer
    im Versionsverlauf sucht: Auf Android gab es 1.0.6 (vc22), auf iOS nicht.
    Der Versions-Datensatz ist übrigens **derselbe geblieben**
    (`id=dc0a8a73-…`) — `--rename-from` benennt um, es entsteht kein zweiter.
    Preis des Ganzen: rund 21 Stunden Warteposition. Am 31.7. lief derselbe
    Austausch (1.0.2 → 1.0.3) ohne spürbare Verzögerung der Freigabe.

  ⚠ **„Nur eine Version in Arbeit" ist die Falle, die hier zugeschnappt ist.**
  Ein hochgeladener, verarbeiteter Build nützt gar nichts, solange die
  Vorgängerversion noch in der Prüfung steht. Apple antwortet beim
  `POST /v1/appStoreVersions` mit **409 `ENTITY_ERROR.RELATIONSHIP.INVALID`**
  und dem Text *„You cannot create a new version of the App in the current
  state"* — das liest sich wie ein Problem mit dem Build und ist keins.
  Erkennen: `asc-status.py` zeigt die hängende Version und die offene
  Einreichung. Beheben: `asc-cancel.py --yes`, dann `asc-submit.py
  --rename-from <alt>` — **umbenennen, nicht eine zweite Version anlegen**,
  denn die Nummer muss zur `CFBundleShortVersionString` des Builds passen.

  ⚠ **Screenshots müssen VOR dem Einreichen hoch.** Sobald die Version in der
  Prüfung ist, sperrt Apple die Metadaten (409 auf jeden POST). Deshalb hat
  `asc-submit.py` jetzt `--vorbereiten`: schreibt Umbenennung, whatsNew und
  Build-Zuweisung, hält aber vor der Einreichung an.
  `upload-ios-screenshots.py` lässt vorhandene Bilder ohne `--ersetzen`
  **in Ruhe** (es war dafür gebaut, neue Sprachen aufzufüllen) — wer das
  Aussehen der App ändert, braucht das Flag, sonst bleibt die Store-Seite
  stumm auf dem alten Stand. Und: Die Bilder sind **nicht** sprachneutral,
  de-DE kommt aus `iphone65`/`ipad13`, alle anderen aus den `-en`-Ordnern.

  ⚠ **`play-upload.py --dry-run` hat beim Rollout nie gegriffen** — der Schalter
  galt nur für die Bild- und Textpfade, ein „Trockenlauf" mit `--promote` hat
  tatsächlich ausgerollt. Seit 11.8. behoben. Gerade dort ist er wichtig: Ein
  Release mit `status: completed` lässt sich nicht mehr anhalten.

  **Zwei neue Workflows** dafür: **„iOS einreichen"** (`asc-submit.yml`) fährt
  die ganze Kette in einem Lauf — abbrechen → warten, bis die Version wieder
  editierbar ist → vorbereiten → Screenshots ersetzen → einreichen; Schalter
  `nur_status` liest bloß. Und **„Play-Rollout"** (`play-rollout.yml`) zieht
  einen vorhandenen versionCode weiter aus, getrennt von der Eintragspflege,
  Trockenlauf als Standard. Der alte Workflow „App Store Connect" (`asc.yml`)
  stammt aus MyPeak, redet von FullRep und Abos und weist fest `--build 4` zu —
  **für dieses Repo unbrauchbar**, nicht damit arbeiten.
- **11.8.2026 abends — v1.1.1 (Android vc24 / iOS Build 23): das Aussehen zieht nach.**
  Drei Sachen, alle rein sichtbar: **App-Icon mit Tempel**, **Bildsymbole für die
  sieben Bonus-Spiele** statt Emoji, **aufrechter Hero-Stein** mit Drehung nach links.

  | | Stand |
  |---|---|
  | Android | **vc24 in Produktion, an alle Nutzer** (19:32 UTC committet) |
  | iOS | **Build 23 als 1.1.1 eingereicht**, reviewSubmission `aa92022a-…` |

  **Die Versionshinweise sind je Plattform verschieden — mit Absicht, nicht aus
  Versehen.** Auf Android war 1.1.0 als vc23 ausgeliefert, auf iOS **nie**: Build 22
  hing in der Prüfung und wurde durch Build 23 ersetzt. Der Play-Text nennt deshalb
  nur die drei neuen Punkte, `store/whatsnew-1.1.1.json` (iOS) nennt zusätzlich den
  kompletten Inhalt von 1.1.0. Sonst bekämen iPhone-Nutzer ein Feature-Release ohne
  Ankündigung. **Wer künftig zwei Releases kurz hintereinander schickt, muss diese
  Frage erneut stellen** — die Plattformen laufen auseinander, sobald eine iOS-Prüfung
  übersprungen wird. Der Play-Text geht als Workflow-Eingabe rein, nicht aus der Datei.
  ⚠ `asc-submit.yml` hat `store/whatsnew-1.1.0.json` fest als Standard; die
  `notes_file`-Eingabe muss bei jedem Release mitgesetzt werden, sonst stehen im
  Store die Hinweise des Vorgängers.

  Screenshots blieben unverändert — 1.1.1 ändert nichts an den fotografierten
  Bildschirmen. Deshalb lief die Einreichung mit `screenshots: false` und ohne die
  Metadaten-Falle.

  **Nachtrag am selben Abend — Store-Texte erneuert, iOS ein zweites Mal eingereicht.**
  Die Beschreibung stammte unverändert aus 1.0: „vier Bonus-Spiele" (es sind sieben),
  ohne Connect, Riichi, Zen, Pagode, Album, Feste, verdeckte Steine und Spezialsteine,
  dazu „Deutsch und Englisch" statt sieben Sprachen. Neu geschrieben in allen sieben
  Sprachen, dazu die Vorstellungsgrafik auf das Tempel-Motiv.

  - **`store/store-texte.json` ist ab jetzt die einzige Quelle für BEIDE Stores.**
    `scripts/asc-texte.py` (Apple, PATCH) und `play-upload.py --texte` (Play) lesen
    dieselbe Datei; die Feldnamen rechnen die Skripte um. Grund: Bei 1.0 wichen die
    Konsolen vom Repo ab und es fiel Monate nicht auf. `store/texts.md` ist nur noch
    historischer Beleg. Workflow **„Store-Texte"**, Trockenlauf als Standard.
  - `add-ios-locales.py` kann Texte **nicht ändern** — es legt nur neue Sprachen an und
    überspringt vorhandene. Dafür gibt es jetzt `asc-texte.py`.
  - **Keywords ohne „mahjong":** Apple indexiert Name, Untertitel und Keywords als EINEN
    Topf; das Wort steckt im App-Namen und war dort verschenkter Platz. Jetzt stehen
    `riichi` und `connect` drin.

  ⚠ **Zwei Fallen, die an diesem Abend zugeschnappt sind — beide sahen nach einem
  Problem bei Apple aus und waren keins:**

  1. **`asc-submit.yml` prüfte `submit` VOR dem Abbruch.** Ein Lauf mit
     `zuerst_abbrechen=true` und `submit=false` meldete „TROCKENLAUF" und stieg aus,
     **ohne abzubrechen** — die Prüfung lief weiter, die Metadaten blieben gesperrt,
     und der nächste Schritt scheiterte. Behoben: Der Abbruch hängt am eigenen
     Schalter. „Nur abbrechen" ist der Lauf, den man zwischen Abbruch und Einreichung
     braucht, denn genau dazwischen gehört die Metadaten-Arbeit.
  2. **Den App-Namen nie per API mitschicken.** Apple prüft ihn bei jedem PATCH neu
     gegen alle Konten — auch bei unverändertem Wert — und antwortet mit
     **409 „The app name you entered is already being used"**. Das liest sich wie ein
     Markenproblem und ist keins. Der Lauf kippte mitten im Sprachsatz: de-DE durch,
     en-US abgelehnt, die sieben Beschreibungen waren da schon geschrieben.
     `asc-texte.py` sendet deshalb nur den Untertitel.

  **Zeitmessung für die Planung:** Android-Lauf 5:46 min bis in Produktion, iOS-Lauf
  **3:00 min** bis `UPLOAD SUCCEEDED` (Archivieren 56 s, Export 3 s, Upload 76 s auf
  `macos-26`) — deutlich schneller als die früher notierten ~25 min. Apple hatte den
  Build nach 20 Minuten schon auf `VALID`. Vor dem Abbrechen der laufenden Prüfung
  IMMER `nur_status` laufen lassen: Er zeigt Build-Zustand, Versionen und die offene
  Einreichung in einem Aufruf und kostet 15 Sekunden.

- **6.9.2026 — iOS Build 25 (noch nicht gebaut): ATT nativ + volle SKAdNetwork-Liste.**
  Anlass war der Vergleich Mahjong iOS 3,68 € gegen Android 21,23 € eCPM (7 Tage,
  17 bzw. 30 Impressionen). Android zeigt Rewarded-Videos, iOS fast nur
  Interstitials ohne Personalisierung — beides normale Preise, kein Fehler.
  Zwei Dinge waren trotzdem strukturell falsch:
  1. **ATT lief über die Plugin-Brücke** (`AdMob.requestTrackingAuthorization()`),
     und das Plugin ruft `ATTrackingManager` auf Capacitors Hintergrund-
     Warteschlange auf — dort erscheint der Dialog nicht (Apple-Ablehnung bei
     Anigosha, 12.08.). Ohne ATT keine IDFA, jede iOS-Anzeige nicht-personalisiert.
     **Der Zeitpunkt aus 1.1.2 bleibt** (erst vor der ersten Anzeige, nicht beim
     Start). Deshalb kein fester Aufruf im AppDelegate, sondern ein Auslöser:
     `ensureTrackingAuthorization()` in `admob.ts` setzt per `@capacitor/preferences`
     den Schlüssel `att.anfrage`; der landet als `CapacitorStorage.att.anfrage` in
     `UserDefaults.standard`, der `AppDelegate` hört auf `UserDefaults.didChangeNotification`,
     fragt auf dem Hauptthread und löscht den Schlüssel. `admob.ts` wartet bis 20 s
     auf die Antwort, dann lädt die Anzeige. Rückfall: `applicationDidBecomeActive`
     prüft den Schlüssel ebenfalls. ⚠ Schlüsselname steht an ZWEI Stellen
     (`ATT_ANFRAGE_KEY` in admob.ts, `attAnfrageSchluessel` im AppDelegate).
  2. **Nur 6 SKAdNetwork-IDs in der Info.plist.** Bieter ohne Eintrag können
     nicht attribuieren und bieten nicht. Jetzt 59: Googles aktuelle Liste
     (developers.google.com/admob/ios/ios14, 50 IDs) plus neun ältere aus Swaply.
     Bei jedem Plugin-Update gegen Googles Liste abgleichen.
  ⚠ **Swift nicht kompiliert** (kein Xcode in der Cloud) — vor dem Release einen
  Lauf mit `upload=false`. Erwartung: iOS-Interstitial von ~3,7 € auf 6 bis 8 €;
  bei 17 Impressionen pro Woche sind das Cents. Der Hebel bleibt die Nutzerzahl.
- **2.9.2026 — v1.1.2 (Android vc25 / iOS Build 24): ruhigerer erster Start.**
  Anlass waren die ersten echten Store-Zahlen (Workflow „Store-Zahlen"): ~75 neue
  Nutzer im Monat, davon auf Android nur 16 mit installierter App — drei von vier
  gehen wieder. Im Code fand sich dazu: **Der allererste Start zeigte zwei
  Systemdialoge, bevor der Spieler einen Stein gesehen hatte** — auf iOS die
  Tracking-Abfrage (ATT, aus `initAds()`) und auf beiden Plattformen die
  Mitteilungs-Erlaubnis (`notify` steht standardmäßig auf `true`, der
  `useEffect` in App.tsx fragte sofort). iOS stellt die Mitteilungs-Frage genau
  einmal; wer da „Nein" tippt, ist für die Tageserinnerung — das einzige
  Rückhol-Werkzeug — dauerhaft verloren.
  Geändert: (1) neues Feld `progress.notifyAsked`; beim Start fragt
  `setupDailyReminder(…, askPermission)` nur noch, wenn schon einmal entschieden
  wurde. Neue Spieler sehen nach dem ersten gewonnenen Level eine Karte auf der
  Startseite („Morgen weiterspielen?", i18n `remind.*`); Ja/Nein läuft über
  `setNotify`, das jetzt auch `notifyAsked` setzt. Migration: alte Stände
  bekommen `notifyAsked = true`, die wurden schon gefragt. (2) ATT nicht mehr in
  `runConsentFlow()`, sondern `ensureTrackingAuthorization()` unmittelbar vor der
  ersten Anzeige (Interstitial nach Level 3 bzw. Rewarded) — Apple erlaubt das,
  bis dahin laufen Anzeigen ohne Personalisierung. Der UMP-Consent (DSGVO, nur
  EU) bleibt beim Start, das ist rechtlich Pflicht.
  Bewusst NICHT gemacht: ein Erst-Hinweis auf Level 1 — optional, nicht bestellt.
  Erwartung ehrlich: Das erklärt die Abgänge nicht allein (Mahjong-Apps halten
  auch gut gemacht nur ~30 % nach Tag 1), aber es ist der billigste bekannte
  Hebel. Versionshinweise `store/whatsnew-1.1.2.json`.

  **Auslieferung am 2.9.2026 abends — zwei Fallen, beide nicht im Code:**

  | | Stand |
  |---|---|
  | iOS | **Build 24 als 1.1.2 eingereicht**, reviewSubmission `35114726-…` |
  | Android | **vc25 in Produktion, an alle Nutzer** (19:36 UTC, mit targetSdk 36) |

  ⚠ **Google Play verlangt seit 31.8.2026 targetSdk 36 (Android 16).** Der erste
  Upload von vc25 endete mit 403 *„Target SDK of artifact is too low: 25"* — die
  Zahl im Text ist der versionCode, nicht das SDK, das liest sich irreführend.
  vc24 war am 11.8. noch durchgegangen; die Frist ist dazwischen abgelaufen.
  API 36 braucht **AGP ≥ 8.9.1 und Gradle ≥ 8.11.1**, deshalb `android/build.gradle`
  8.2.1 → 8.9.1 und `gradle-wrapper.properties` → 8.11.1 (`variables.gradle`:
  compileSdk/targetSdk 36, JDK 17 bleibt). Capacitor 6 und alle Plugins bauen
  damit unverändert — geprüft mit einem Lauf `upload=false` (6 min), erst dann
  der echte. Ein fehlgeschlagener Upload veröffentlicht nichts: Der Fehler kommt
  bei `:validate`, vor dem `:commit`.

  ⚠ **Apple 500 beim allerletzten Einreich-Schritt.** `asc-submit.py` legt den
  Einreichungs-Entwurf an (POST reviewSubmissions), hängt die Version an
  (reviewSubmissionItems) und bestätigt (PATCH `{submitted: true}`). Der PATCH kam
  mit **500 UNEXPECTED_ERROR** zurück — Entwurf und Eintrag waren da, die Version
  stand auf `READY_FOR_REVIEW`, abgeschickt war nichts. Ein zweiter Lauf hätte
  einen zweiten Entwurf angelegt (geht nicht) bzw. mit „nicht editierbar"
  abgebrochen. Das Skript erkennt diesen Zustand jetzt und holt **nur die
  Bestätigung** nach; `--vorbereiten` meldet dann „nichts zu tun". Erkennen:
  `nur_status` zeigt unter „Offene Prüfungen" `READY_FOR_REVIEW eingereicht None`
  — „None" ist das Merkmal, eine abgeschickte Prüfung trägt ein Datum.

---

## Handy-Betrieb: Builds, Deploys und fal.ai auf Zuruf

Josef arbeitet meist vom Handy. Für **alle** Sitzungen dieses Repos gilt darum eine
Dauer-Freigabe. Sie sagt nur, *dass* Claude das darf — sie ersetzt nie das „ja" zum
einzelnen Lauf.

**Grundsätzlich erlaubt:**
- die App bauen, signieren und in die Stores hochladen — auf GitHubs Rechnern, ohne Mac
- Deploys auslösen
- fal.ai für Bildmaterial nutzen (Store-Screenshots, Icons, Grafiken)

**Bedingung, ausnahmslos:** Jeder einzelne Lauf braucht vorher ein ausdrückliches
„ja" von Josef im Chat. Davor in drei Zeilen zusammenfassen: *was* passiert, *welche
Versionsnummer*, *wohin* es geht (Store / Produktion / nur Artefakt zum Ansehen) —
bei fal.ai zusätzlich Modell, Anzahl Bilder und ungefähre Kosten. Geht etwas schief:
melden und stehen bleiben, nicht auf eigene Faust nachbessern und noch einmal
hochladen. Ergebnisse (Bilder, Build-Artefakte, Logs) mit `SendUserFile` direkt im
Chat zeigen — auf dem Handy gibt es keinen Dateimanager.

**Schlüssel gehören weder ins Repo noch in den Chat:**

| Zweck | Ort |
|---|---|
| Signierung + Store-Upload | GitHub → Repo → Settings → Secrets and variables → Actions |
| `FAL_KEY` | Umgebungsvariable der Claude-Umgebung (claude.ai/code → Environment) |
| Vercel / Supabase | Vercel-Env bzw. lokale `.env` (gitignored) |

Ein Schlüssel, der im Chat steht, steht dauerhaft im Sitzungsprotokoll → gilt als
verbrannt und muss ersetzt werden. Fehlt einer: sagen **welcher** und **wo er
hingehört**, statt zu raten oder einen Umweg zu bauen.

**fal.ai läuft in der Sitzung** (Josef braucht dafür kein Terminal):
`curl -s https://fal.run/<modell> -H "Authorization: Key $FAL_KEY" -H 'Content-Type: application/json' -d '{"prompt":"…"}'`
→ Bild herunterladen, ins Repo legen, committen, im Chat zeigen. Ohne gesetzten
`FAL_KEY` ist der Weg zu: dann sagen, dass die Variable in der Umgebung fehlt.

**Auslösen in diesem Repo:** „Android Release" und „iOS Release" sind fertig
eingerichtet (Secrets und Einrichtung in `store/ci-setup.md`), Start per
`workflow_dispatch`. **iOS am 4.8.2026 grün getestet** (Bau + Signierung, Upload aus,
2,6 min). **Android und iOS sind beide gruen** (4.8.2026, Upload jeweils aus).

⚠ **Die alte Test-Werbe-Pruefung war ein Fehlalarm — Ursache geklaert, nicht raten.**
Sie durchsuchte `base/dex/classes.dex` nach Googles Beispiel-ID `3940256099942544`
und schlug an, obwohl `USE_TEST_ADS` seit dem 14.7. auf `false` steht. Ein
Diagnoselauf am 4.8. (vc19, also derselbe Stand wie im Store) hat gezeigt, wo die
Zeichenkette wirklich sitzt:

| Zeichenkette | gefunden in |
|---|---|
| Test-ID `3940256099942544` | **nur** `base/dex/classes.dex` |
| echte Publisher-ID `8860791993288062` | `AndroidManifest.xml`, `app-ads.txt`, `assets/index-*.js` |

Das dex enthaelt uebersetzten Java-Code, also SDK und Plugins — Googles Anzeigen-SDK
bringt seine Beispiel-IDs dort selbst mit. Unsere Konfiguration steckt im Web-Bundle,
und dort steht die **echte** ID und keine Test-ID: Der Bundler wirft den inaktiven
TEST-Block also tatsaechlich weg, wie immer angenommen. Die Pruefung stellte die Frage
schlicht an der falschen Stelle.
**Geprueft wird deshalb jetzt der Schalter selbst** (`const USE_TEST_ADS = false` in
`src/ads/admob.ts`); ein Diagnoseschritt listet zusaetzlich auf, wo beide IDs im Paket
vorkommen, ohne je abzubrechen. Wer die Pruefung kuenftig wieder auf Zeichenketten im
fertigen Paket umstellt, baut denselben Fehlalarm erneut ein.

Ebenfalls vor jedem Release: Versionsnummern erhöhen
(`versionCode`, `CURRENT_PROJECT_VERSION` ×2 im pbxproj).

⚠ **Falle beim iOS-Export** (4.8.26 zweimal reingelaufen): Bei manueller
Signierung braucht `ExportOptions.plist` die Zuordnung **Bundle-ID → Profilname**.
Fehlt sie, läuft der Bau vollständig durch und erst der Export bricht ab —
`exportArchive "App.app" requires a provisioning profile`. Das liest sich wie ein
fehlendes Profil, obwohl das Profil längst installiert ist. Der Workflow zieht beides
jetzt zur Laufzeit aus dem Profil selbst (`security cms -D` + `plutil -extract`),
damit es auch nach einer Profilerneuerung bei Apple stimmt.

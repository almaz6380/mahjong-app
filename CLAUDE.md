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
  `game-*.webp` (in App.tsx `gameItems`, CSS `.game-ico .game-img`). Die **Board-Steine** sind seit
  17.7.2026 ebenfalls auf Gemini-Motive umgestellt — siehe Abschnitt „Stein-Design" oben.
  **Startseiten-Hintergrund** = asiatisches
  Tempel-Motiv (`src/assets/home-temple.webp`), animierte Sakura-Blüten darüber.
  **WICHTIG — Safe-Area-Falle (viel Debugging gekostet):** iOS füllt den unteren Streifen
  (Home-Indikator/Safari-Leiste, ~100+ CSS-px) NUR mit einer Hintergrund-*Farbe*, NIE mit einem
  fixen oder Root-Hintergrund*bild*. Finale Lösung: (1) Bild liegt auf `html.on-home` (Root-Element),
  (2) die Klasse `on-home` wird per `useEffect(screen)` an `<html>` gesetzt (NICHT `:has()` — griff
  auf dem Gerät nicht!), (3) `html.on-home` background-color = `#121e1d`, und (4) der **Bildunterrand
  ist bewusst in genau dieses #121e1d ausgelaufen** (in der webp eingebacken), damit Bildkante =
  Streifenfarbe = nahtlos. `body { background: transparent }` (Grundfarbe `#123f2e` nur auf html),
  sonst überdeckt body den Root-Hintergrund; `html.on-home .app-bg { display:none }`. Andere Screens:
  html-Jade `#123f2e` + `src/ui/AppBackground.tsx`. Bild-Verarbeitung (Sternchen entfernen, Rand
  auslaufen) via Python-venv/Pillow im Session-Scratchpad.
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
  „Wusstest du?"-Tipp (`facts.nextFact`), blendet nach Vorladen + ~1,4 s aus. **App-Icon** = zwei Steine
  (中-Stein vorne + Drachen-Wappen-Rücken) auf dunklem Jade (Quellen `assets/icon-*`, via @capacitor/assets).
- `src/ui/AppBackground.tsx` — globaler Hintergrund (Jade-Glows + Riesen-Stein), in main.tsx gemountet;
  `src/game/themes.ts` — Themes + Stein-Skins (`applySkin`/`TILE_SKINS`); App-Icon/Splash via
  `@capacitor/assets generate` aus `assets/icon-*`/`splash*`
- `src/ads/admob.ts` — **`USE_TEST_ADS`-Flag**: `false` = echte Anzeigen (Launch), `true` = Google-Test-IDs.
  Prod-IDs siehe `admob-ids.md`. Der Bundler eliminiert den jeweils inaktiven ID-Block!
  Check im fertigen Build: `grep 3940256099942544` (Test-ID) im entpackten JS-Bundle → darf im Release NICHT vorkommen.
  **Banner-Platz (`--banner-space`):** Der Banner ist eine native View ÜBER der WebView — er schiebt
  nichts weg. Jede Layout-Wurzel (`.app`, `.home`, `.m4`, `.mode-play`) rechnet die Höhe unten mit ein;
  gesetzt wird sie aus dem `SizeChanged`-Ereignis des Plugins (dp = CSS-px), bei Fehler/Entfernen auf 0.
  Fehlt das, liegt die Werbung auf der Bedienleiste (Neu/Zurück/Tipp/Mischen) — war bis vc14 so.
  Prüfen ohne Gerät: `--banner-space` im Browser von Hand setzen, der Inhalt muss nach oben rücken.
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
  hinterlegt und greifen ab Veröffentlichung von selbst.
- `src/store/iap.ts` — IAP via cordova-plugin-purchase v13 (kein RevenueCat). Produkte:
  `remove_ads` (Non-Consumable), `coins_small/medium/large` (Consumable)
- `src/audio/sound.ts` — WebAudio-Synth **und Haptik**: `playTap`/`playMatch`/`playWin` lösen zusätzlich
  eine Vibration aus (nativ `@capacitor/haptics`, im Web `navigator.vibrate`; die VIBRATE-Berechtigung
  bringt das Plugin über sein eigenes Manifest mit). **iOS-Safari kennt `navigator.vibrate` nicht** —
  in der Web-App auf dem iPhone vibriert also nichts, nur in der nativen App. Getrennt vom Klang
  schaltbar (`progress.vibrate` + `setHapticsEnabled`, Schalter „Vibration" in den Einstellungen).
  KI-Abwürfe im 4-Spieler/Riichi rufen `playTap(false)` — Klang ja, Vibration nein.
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

**Auslösen in diesem Repo:** Beide Workflows sind fertig eingerichtet — „Android
Release" und „iOS Release", Start per `workflow_dispatch` (Werkzeug
`mcp__github__actions_run_trigger`), Secrets und Einrichtung in `store/ci-setup.md`.
Davor Versionsnummern erhöhen und committen (`versionCode` in
`android/app/build.gradle`, `CURRENT_PROJECT_VERSION` ×2 im pbxproj). Einen
geänderten Workflow immer zuerst mit dem Schalter „nur bauen" testen. Und:
`USE_TEST_ADS` muss für ein Release `false` sein.

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

- `src/engine.ts`, `src/layouts.ts` — Solitaire-Kern; jedes Board rückwärts konstruiert = garantiert lösbar
- `src/game/figures.ts` — **Figuren-Generator**: 29 Grundformen × Größe × Höhenprofil × Aushöhlung
  = 1026 einzigartige, deterministische Level-Boards (`layoutForLevel`; Namen `fig-<n>`, i18n `fig.*`).
  Klassische Layouts (mini/classic/…) nur noch für Tages-Challenge & Zeit-Blitz. Steine im Solitaire
  mit 3D-Korpus (`<Tile solid>`, CSS `.tile.solid`); ab 80 Steinen mischen die Serien **Mythen**
  (龍鳳麒龜) & **Schätze** (Laterne/Fächer/Münze/Knoten) ins Deck (`deckForCount`).
- `src/mahjong4/` — 4-Spieler-Modus (Hongkong, KI per Shanten-Heuristik) **und Riichi**: `riichi.ts`
  (Yaku/Han/Fu/Dora-Wertung), `riichiGame.ts`+`useRiichi.ts` (Ablauf, geschlossene Variante),
  `ui/RiichiTable.tsx`; HK-Tisch `ui/Table4.tsx`
- `src/modes/connect/` — **Mahjong Connect** (BFS-Pfad ≤2 Kurven, garantiert lösbar via Auto-Mischen),
  Fortschritt in `progress.connectLevel`
- `src/modes/` — Bonus-Spiele (2048, Match-3, Memory, Sudoku, Tile Match, Zeit-Blitz, 3D-Dimensions),
  gemeinsame `ModeApi` in types.ts
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
  `game-*.webp` (in App.tsx `gameItems`, CSS `.game-ico .game-img`).
  **Board-Steine (Winde+Drachen) ersetzt:** die 4 Winde 東南西北 (`tile-wind-{e,s,w,n}.webp`, Onyx-Schwarz+Gold)
  und die Drachen 發/白 (`tile-dragon-{green,white}.webp`, Jade/Slate + Gold); roter Drache 中 = Wiederverwendung
  von `symbol-zhong.webp` (dasselbe 中 wie auf dem Drehstein). Eingebunden in `Tile.tsx` (`SymbolImg` als
  `<image>` im Steinkorpus, `WIND_IMG`/`DRAGON_IMG`; ersetzt die alten abstrakten Raute/Flamme/Blatt/Stern-Motive).
  **Extraktions-Skript** `scripts/extract_tiles.py` (venv `.venv-img`, Pillow/numpy/scipy): Magenta-Key
  `min(R,B)-G` → weiche Alpha-Rampe → **alle** Zeichenteile behalten die ≥5% der größten Fläche sind (Sternchen
  raus, aber getrennte Radikale wie 北/發 bleiben!) → Kante ~4px erodieren (roter Gold/Magenta-Saum weg) →
  Magenta-Un-Multiply (Farbentkontaminierung) → Silhouetten-Crop → WebP. Rohbilder in `gemini-in/` (gitignored),
  Batch: `.venv-img/bin/python scripts/extract_tiles.py gemini-in/ src/assets/`; Assets danach kompakt
  re-enkodieren (thumbnail 320px, WebP q88). **Nächster Schritt (offen):** die übrigen klassischen Steine
  (Zahlen/Bambus/Kreise/Blumen/Jahreszeiten) per Gemini ersetzen (aktuell noch als SVG-Motive in `Tile.tsx`).
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
  Schalter `progress.showFacts`)
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
- `src/store/iap.ts` — IAP via cordova-plugin-purchase v13 (kein RevenueCat). Produkte:
  `remove_ads` (Non-Consumable), `coins_small/medium/large` (Consumable)
- `src/i18n.ts` — DE/EN, alle UI-Labels sind Keys
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

## Native Builds (Launch-Rezept, verifiziert 12.7.2026)

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
(Key in `~/.appstoreconnect/private_keys/`). ASC-API-Skripte (asc.py) in früheren Session-Scratchpads.

**Android** (Upload-Keystore `android/upload-keystore.jks` + `keystore.properties`, gitignored — sichern!):
```
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```
minSdk 23 / compileSdk+targetSdk 35 (Billing-Lib 9 + Play-Pflicht). AAB lädt der Nutzer in der Play Console hoch.

## Store-Koordinaten

- Name „Mahjong Royale", appId `com.mahjongroyale.app`, ASC-App-ID 6787721454, Team JU8STVD4SJ
- AdMob-Publisher pub-8860791993288062 (Konto 63almaz80@gmail.com), IDs in `admob-ids.md`
- Store-Texte/Screenshots/Rezepte in `store/` (texts.md)
- Ersteinreichung 6.7.2026 (iOS Build 2 / Android vc3); **iOS wegen 4.3(a) „Design: Spam" abgelehnt**.
- **Neu eingereicht 12.7.2026, v1.0 — iOS Build 10 / Android versionCode 11**: mit Riichi, natürlichem
  Jade-Look, drehendem 3D-Stein, neuem Icon/Splash, neuen Screenshots (iPhone+iPad / Handy+Tablet),
  differenzierter Beschreibung + Reviewer-Antwort im Resolution Center gegen 4.3a. Store-Assets in
  `~/Desktop/mahjong-*export*` (Icon 512, Feature 1024×500, AAB, Screenshots).

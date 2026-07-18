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
- `src/game/figures.ts` — **Figuren-Generator**: 29 Grundformen × 5 Größen × Höhenprofil × Aushöhlung
  = **834** einzigartige, deterministische Level-Boards (`layoutForLevel`; Namen `fig-<n>`, i18n `fig.*`).
  **Kein flaches Profil** – jede Figur hat ≥2 Ebenen (einschichtige Bretter sind trivial), erzwungen über
  entfernte 'flach'-Stufe + `layers.length < 2`-Filter.
  **Bretter bleiben klein, damit die Steine groß sind** (max 8×9 Zellen): `SIZES` = 4×5 … 8×9, ASCII-Formen
  werden per `resample()` auf dieselben Raster gebracht. Die Level-Rampe sortiert nach
  `cells.length + 30 × tier + 12 × layerCount` (tier: ≤5×6 = 0, ≤6×7 = 1, ≤7×8 = 2, sonst 3) — dadurch
  wächst mit dem Level BEIDES: Grundfläche (Steingröße-Rampe, **Level 1–100 ≤5×6** ≈ 75–81 px, bis ~278
  ≤6×7 ≈ 63, dann bis 8×9 ≈ 48) UND Stapel-Tiefe (früh Ø 2 Ebenen, spät 3–4). Scale-Deckel in
  `Board.tsx` = 1.85. Prüfskript:
  `node scripts/check-figures.mjs` (Maße, Rampe, Parität, Schweben, Lösbarkeit aller 1050, Modus-Filter).
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
- **Stein-Design** (`src/ui/Tile.tsx`): Motive stammen aus **Gemini-Bildern des Nutzers**. Rohbilder liegen
  im Repo unter `design-sources/gemini-tiles/`, freigestellt per `scripts/extract-tiles.py magenta <in> <out>`
  (Magenta-Key, 320 px, WebP) nach `src/assets/tiles/*.webp`; `motif()` lädt sie per `import.meta.glob`
  (fehlt ein Bild → gezeichneter SVG-Fallback, Not-Schalter `USE_IMG_MOTIFS`). Bild-Motive: myth1–4,
  season1–4, treasure1–4, elem-pin (Münze = Kreis-Pips), elem-sou (Bambusstab = Sou-Pips),
  face-marble (Deckfläche). Als SVG nachgezeichnet
  (schärfer in Kleinstgrößen, `Glyph`-Helper mit Goldkante): Zahlen = Lapis-Ziffer + Rubin-萬,
  Winde = Onyx, 中 rot / 發 jade / 白 schiefer, Blume = rote Scheibe. Skins mit eigener Flächenfarbe
  blenden Marmor+Goldrand aus (`.face-tex`), Neon hellt Lapis/Onyx/Slate auf (sonst unlesbar).
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
  (**WAITING_FOR_REVIEW**). Android **vc14 per Play-API in Produktion** veröffentlicht (Release „14 (1.0)",
  status completed) inkl. neuer Telefon- **und** 7-Zoll-Tablet-Screenshots + neuem 512-Icon.
  Artefakte: `~/Desktop/MahjongRoyale-ios-1.0-b13.ipa`, `MahjongRoyale-android-1.0-vc14.aab`.
  Store-Screenshots in `store/ios-screenshots/*` + `store/play-screenshots/*` (Play-Tablet = iPad-Set).
  Play-Feature-Grafik `store/play-feature-graphic.png` (1024×500) am 18.7. neu im Jade-/Marmor-Look
  (Marmor-Steine mit Goldrand+3D, Motive Drache/中/Münze, Untertitel „Solitaire · Riichi · Connect ·
  4 Spieler") per API ersetzt (de-DE). Render-Rezept: HTML mit eingebetteten `src/assets`-Bildern
  (`tiles/face-marble.webp` + Motive + `symbol-zhong.webp`, Inter-woff2) → puppeteer-core/System-Chrome,
  viewport 1024×500 dsf 1, screenshot clip. App Store hat keine Feature-Grafik.

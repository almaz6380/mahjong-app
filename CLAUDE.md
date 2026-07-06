# Mahjong Royale (mahjong-app)

Mahjong-Solitaire-Spiel + 4-Spieler-Modus + 4 Bonus-Spiele. Vite + React + TypeScript,
verpackt mit Capacitor für iOS und Android. Sprache im Projekt/mit dem Nutzer: **Deutsch**.

## Befehle

- `npm run dev` — Dev-Server
- `npm run build` — Web-Bundle nach `dist/`
- `npx cap sync` — dist/ + Plugins nach ios/ und android/ kopieren (nach jedem Build vor nativen Builds!)
- Web-Smoke-Test: puppeteer-core + System-Chrome (devDep). Achtung: Tagesbelohnungs-Overlay
  zuerst wegklicken; Headless-Chrome startet englisch (i18n-Auto-Erkennung).

## Architektur (Kurzüberblick)

- `src/engine.ts`, `src/layouts.ts` — Solitaire-Kern; jedes Board rückwärts konstruiert = garantiert lösbar
- `src/mahjong4/` — 4-Spieler-Modus (Hongkong vereinfacht, KI per Shanten-Heuristik)
- `src/modes/` — Bonus-Spiele (2048, Match-3, Memory, Steine-Sudoku), gemeinsame `ModeApi` in types.ts
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

## Native Builds (Launch-Rezept, verifiziert 6.7.2026)

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
- Beide Stores am 6.7.2026 mit v1.0 eingereicht (iOS Build 2, Android versionCode 3)

# Mahjong (Solitaire) – iOS + Android mit AdMob

Ein spielbares **Mahjong Solitaire** (Steine paarweise abräumen) auf Basis von
**Vite + React + TypeScript**, verpackt mit **Capacitor** für iOS & Android,
inkl. **AdMob**-Werbung (Banner unten + Interstitial nach dem Spiel).

Jedes Board ist **garantiert lösbar** (durch Rückwärts-Konstruktion beim
Generieren, unabhängig geprüft mit ~500 Boards).

---

## Sofort im Browser testen

```bash
cd mahjong-app
npm install
npm run dev        # öffnet http://localhost:5173
```

Im Browser gibt es keine Ads (nur auf iOS/Android). Alles andere funktioniert:
Steine anklicken, Tipp, Mischen, Zurück, Neu.

## Web-Build

```bash
npm run build      # erzeugt dist/
npm run preview    # dist/ lokal ansehen
```

---

## Auf iOS & Android bringen (Capacitor)

> Das machst du am Mac mit **Xcode** (iOS) bzw. **Android Studio** (Android).

### Einmalig einrichten

```bash
cd mahjong-app
npm install   # richtet via postinstall automatisch den AdMob-Patch ein (siehe unten)
```

> Die nativen Projekte **`ios/` und `android/` sind bereits angelegt** (inkl.
> App-Icon, Splashscreen und AdMob-Test-Konfiguration). Neu anlegen ist nur nötig,
> wenn du sie löschst: `npx cap add ios` / `npx cap add android`.

- **iOS**: braucht **Xcode** + **CocoaPods** (`sudo gem install cocoapods`).
- **Android**: in **Android Studio** öffnen – es bringt sein eigenes JDK mit, ein
  separates Java ist nicht nötig. (Für CLI-Builds: `brew install --cask temurin`.)

### AdMob-Patch (wichtig)
Das Plugin `@capacitor-community/admob@6.2.0` baut mit dem aktuellen Google-SDK/Xcode
nicht (alte `UMPConsentStatus`-API). `patches/@capacitor-community+admob+6.2.0.patch`
stellt einen kompatiblen Consent-Stub bereit und wird bei `npm install` automatisch
angewandt (`postinstall`). Banner/Interstitial/Rewarded sind voll funktionsfähig; nur
der (ungenutzte) UMP-Consent-Dialog ist deaktiviert.

### Bei jeder Änderung: bauen + syncen

```bash
npm run cap:sync          # = npm run build && cap sync
```

### App öffnen / starten

```bash
npm run ios               # baut, synct und öffnet Xcode
npm run android           # baut, synct und öffnet Android Studio
```

In Xcode / Android Studio dann auf Simulator oder echtem Gerät auf **Play**.

---

## AdMob scharf schalten

Aktuell laufen überall **Google-Test-Ads** (funktionieren sofort, verdienen aber nichts):
Banner unten, Interstitial (sanft: ab Level 3, jedes 3. Level, 75s-Sperre) und
belohnte Videos (Rewarded). Datei: `src/ads/admob.ts`.

1. Konto anlegen: <https://admob.google.com>
2. Dort eine **App für iOS** und eine **App für Android** erstellen.
3. Je App **drei Ad-Units**: **Banner**, **Interstitial**, **Rewarded** (= 6 IDs gesamt).
4. Die 6 IDs in `src/ads/admob.ts` unter `PROD` eintragen und oben
   `USE_TEST_ADS = false` setzen.
5. Die AdMob-**App-IDs** (2 Stück) ersetzen – aktuell sind Test-IDs eingetragen:
   - **iOS**: `ios/App/App/Info.plist` → `GADApplicationIdentifier`
   - **Android**: `android/app/src/main/AndroidManifest.xml` → `com.google.android.gms.ads.APPLICATION_ID`
6. `npm run cap:sync` und neu bauen.

> ⚠️ Nie auf echte eigene Ads klicken – Google sperrt sonst das Konto.
> Zum Testen immer Test-IDs verwenden.

## In-App-Käufe (Shop) scharf schalten

Der Shop (Münz-Pakete + „Werbung entfernen") läuft im Web/Simulator als **Stub**
(Kauf wird simuliert). Für echte Käufe: `src/store/iap.ts`.

1. Produkte in **App Store Connect** und **Google Play Console** anlegen
   (IDs: `remove_ads`, `coins_small`, `coins_medium`, `coins_large`).
2. Ein Capacitor-Purchase-Plugin einbinden (z. B. `@revenuecat/purchases-capacitor`
   oder `cordova-plugin-purchase`) und in `iap.ts` unter dem markierten `TODO(nativ)`
   verdrahten; `NATIVE_STORE_READY = true` setzen.
3. Auf echten Geräten mit Sandbox-Test-Konten testen.

---

## Projektstruktur

```
src/
  game/
    tiles.ts        Steine (farbig, Unicode-Grafik) + deckForCount
    layouts.ts      Layouts (mini/classic/pyramid/turtle) + layoutForLevel
    engine.ts       Lösbarkeits-Generator (seedbar), Frei-Regel, Mischen
    scoring.ts      Sterne + Münzen
    progress.ts     Persistenter Fortschritt (Hook useProgress)
    session.ts      Laufendes Spiel speichern/laden (Fortsetzen)
    daily.ts        Deterministische Tages-Challenge
    themes.ts       Freischaltbare Farbwelten
    achievements.ts Lokale Erfolge
    useGame.ts      Spielzustand (React-Hook)
  ui/               Board, GameScreen, Screens (Shop/Themes/Erfolge/Optionen/Hilfe)
  audio/sound.ts    WebAudio-Sound + Haptik
  ads/admob.ts      AdMob: Banner/Interstitial/Rewarded (Test-IDs)
  store/iap.ts      In-App-Käufe (Web-Stub + native Seam)
  App.tsx           Router: Menü / Spiel / Daily / Unter-Screens
assets/             Icon-/Splash-Vorlagen (Quelle für @capacitor/assets)
patches/            AdMob-Plugin-Patch (UMP-Kompatibilität)
```

---

## Features (v0.3)

- **Farbige Steine** (Bambus grün, Kreise/Zahlen blau, Drachen 中/發/白 rot/grün/blau …).
- **Endless-Level** mit Schwierigkeitsrampe: Mini → Klassisch → Pyramide/Schildkröte.
- **Münzen + Sterne**, **Sieg-Screen** mit Sterne-Animation, Münz-Count-up & 1-Tap „Weiter".
- **Booster** (Tipp/Mischen/Undo) begrenzt, nachfüllbar per Münzen **oder** belohntem Video.
- **Belohnte Videos**: Booster, Weiterspielen bei Sackgasse, Münzen verdoppeln.
- **Tägliche Belohnung + Streak** und **Tägliche Challenge** (deterministisches Tages-Board).
- **Themes** (Münz-Sink), **Erfolge**, **Einstellungen** (Sound/Haptik, Reset), **Kurzanleitung**.
- **Spiel fortsetzen** nach App-Neustart; alles persistent (`@capacitor/preferences`).
- **Shop / IAP**: Münz-Pakete + „Werbung entfernen" (Web-Stub testbar, native Seam vorbereitet).
- **Match-Animation**, Sound + Haptik.
- Native **iOS + Android** inkl. App-Icon, Splashscreen, AdMob-Konfiguration, Portrait-Lock.

## 4-Spieler-Modus (Hongkong, vereinfacht)

Eigenständiges Spiel unter `src/mahjong4/` (Menü: „4 Spieler · Ostrunde"):
1 Mensch + 3 KI, volle **Ostrunde** mit Dealer-Rotation und zero-sum-Punktestand,
alle 144 Steine inkl. Blumen/Jahreszeiten (Ersatzzug), Pung/Kong/Chow/Gewinn mit
Priorität, vereinfachte **Faan-Wertung**, KI per Shanten-Heuristik.

```
src/mahjong4/
  tiles4.ts      Steine (Suit+Rang), Mauer, Farben
  engine4.ts     Zustand, Deal, Ziehen/Abwerfen, Ansprüche + Priorität, Kong
  win.ts         Gewinn-Erkennung (exakt) + Shanten/Tenpai
  ai.ts          KI: Abwurf + Anspruchs-Entscheidungen
  scoring4.ts    Faan-Wertung + Münzen
  match4.ts      Ostrunde: Punktestand, Dealer-Rotation
  useMahjong4.ts Spiel-Loop (Mensch vs. 3 KI)
  ui/Table4.tsx  Tisch-UI
```

## Neu in v0.5

- **Zweisprachig (DE/EN)**: leichtes i18n (`src/i18n.ts`), Auto-Erkennung der
  Systemsprache + Umschalter in den Einstellungen.
- **Statistik-Screen**: Solitär (Level, Siege, 3★, Bestzeit, Challenges, Serie)
  und 4-Spieler (Hände, Siege, Quote, beste Hand).
- **4-Spieler-Tutorial** beim ersten Start (Regeln in 4 Karten), danach nie wieder.
- **PWA**: `public/manifest.webmanifest` + `public/sw.js` → im Browser
  installierbar („Zum Home-Bildschirm") und offline spielbar. Der Service Worker
  wird nur im Web registriert, nicht in der nativen App.
- **GitHub-Backup**: https://github.com/almaz6380/mahjong-app (privat).
  Live-Demo: https://mahjong-app-plum.vercel.app

## Roadmap

- [ ] 4-Spieler: **Riichi/japanische Regeln**, mehr Sonderhände, Bestenliste.
- [ ] **Echte Ads/IAP** scharf schalten (deine IDs/Produkte – siehe oben) +
      GDPR-Consent-Lösung (UMP ist aktuell gestubbt, siehe `patches/`).
- [ ] Weitere Solitaire-Layouts, Game Center / Play Games.
```

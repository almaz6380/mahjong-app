# Übergabe: Store-Release Android vc15 / iOS Build 14

Stand 28.7.2026. Alles Nötige ist im Repo auf `main`; es fehlen nur Bauen und
Hochladen — das geht ausschließlich auf dem Mac (Android-SDK, Xcode,
`upload-keystore.jks` und die Signier-Zertifikate liegen nicht im Repo).

## Was seit dem letzten Store-Build (vc14 / iOS 13, 18.7.) dazugekommen ist

| Commit | Inhalt |
|---|---|
| `dd15a80` | **Levelwechsel repariert.** Ein fortgesetzter Spielstand wurde in jedem Folgelevel erneut geladen — es kam immer dasselbe, halb geräumte Brett. Dazu: Level steigt jetzt auch, wenn die App auf dem Sieg-Bildschirm geschlossen wird (Selbstheilung), und Sackgassen haben einen „Neu"-Ausweg statt eines wirkungslosen „Mischen" (das keinen Booster mehr kostet). |
| `89a7580` | Sieg-/Belohnungskarte blitzt nach der „Wusstest du?"-Karte nicht mehr für ein Bild auf. |
| `2727824` | iOS: Brett verrutschte beim Antippen (`.board-wrap` war trotz `overflow:hidden` scrollbar, Safari scrollte den fokussierten Stein in den sichtbaren Bereich). Jetzt `overflow: clip` + `touch-action: manipulation` gegen den Doppeltipp-Zoom. |
| `5b3576e` | iOS: Auswahl-Animation (`selectpop`, scale 1.12) ruckelte das ganze Brett um ~1 Gerätepixel — WebKit hebt den Stein für die transform-Animation auf eine eigene Compositing-Ebene und rastert den Rest neu. Ersetzt durch ein Aufblitzen der Konturfarbe. |
| `f347ada` | Dasselbe für die Verschwinde-Animation beim Paar-Treffer; auf Touch-Geräten verschwindet das Paar jetzt sofort. |
| `a1f943d` | Angetippter Stein wird golden getönt (Rechteck im Stein-SVG unter dem Motiv, kein CSS-Filter — der würde das Ruckeln zurückholen). |
| `6636e90` | Versionsnummern: Android `versionCode 15`, iOS `CURRENT_PROJECT_VERSION 14`. |
| `99d0005` | **Vibration** beim Antippen, Treffer und Sieg, mit eigenem Schalter in den Einstellungen. Nativ über `@capacitor/haptics`, im Web über `navigator.vibrate` (auf iOS-Safari gibt es das nicht — dort wirkt es erst in der nativen App). KI-Abwürfe im 4-Spieler/Riichi vibrieren bewusst nicht. |
| `77b627e` | **Werbebanner verdeckte die Bedienleiste.** Die CSS-Variable `--banner-space` wurde nirgends gesetzt und blieb auf 0. Jetzt aus dem `SizeChanged`-Ereignis des AdMob-Plugins; die Startseite rechnet sie ebenfalls ein. Betrifft nur die nativen Apps. |
| `004e2bb` | **Schwerere Level.** Neue Höhenprofile (Sockel/Turm/Stufenturm/Kranzturm) geben auch kleinen Brettern 3–4 Ebenen → 1392 statt 834 Figuren. Neue Rampe (`levelFigures`): kein Level unter 36 Steinen, Dreierschritte durch den Vorrat → 370 Level. Level 1: 20→36 Steine, Level 25: 26→42, Level 300: 26/3→72/4. |
| `6c64391` | Diese Release-Skripte. |

Alles davon ist im Web bereits live (Vercel, `main`).

## Aufgabe

Android **vc15** und iOS **Build 14** bauen und hochladen. Android soll **sofort an
alle Nutzer** gehen (kein gestufter Rollout).

### Android

```bash
git pull
bash scripts/release-android.sh
```

Das Skript prüft Keystore/`JAVA_HOME`, lässt `tsc` und `check-figures` laufen,
baut Web-Bundle + `cap sync`, erzeugt das signierte AAB und bricht ab, falls die
Google-Test-Werbe-ID im Bundle steckt. Ergebnis:
`~/Desktop/MahjongRoyale-android-1.0-vc15.aab`

```bash
python3 scripts/play-upload.py --aab ~/Desktop/MahjongRoyale-android-1.0-vc15.aab \
  --complete \
  --notes "Levelwechsel repariert, deutlich schwerere Level, Vibration, Werbung verdeckt die Bedienknöpfe nicht mehr."
```

Danach zur Kontrolle: `python3 scripts/play-upload.py --status`

### iOS

```bash
python3 scripts/asc-status.py
```

**Zuerst prüfen, ob Build 13 noch in der Prüfung hängt** (Stand 18.7.:
`WAITING_FOR_REVIEW`). Falls ja, muss die Prüfung abgebrochen werden, sonst lässt
sich Build 14 nicht einreichen — das Skript druckt den nötigen PATCH-Aufruf aus
(`PATCH /v1/reviewSubmissions/{id}` mit `{"canceled": true}`).

```bash
bash scripts/release-ios.sh
```

Archiviert, exportiert und lädt per `altool` hoch. Danach in App Store Connect
Build 14 der Version 1.0 zuweisen und einreichen (Einreichen per API siehe
CLAUDE.md, Abschnitt „Native Builds").

## Stolpersteine

- **Git-Autor muss `63almaz80@gmail.com` sein** — `celorenz1234@…` blockiert die
  Vercel-Deploys.
- Auf dem Mac einmalig `pip3 install pyjwt cryptography` (für beide Python-Skripte).
- `JAVA_HOME` erwartet Android Studio unter `/Applications/Android Studio.app/…`;
  abweichender Pfad → `JAVA_HOME=… bash scripts/release-android.sh`.
- Die Play-API braucht `~/.config/play-publisher/key.json`, App Store Connect den
  Key in `~/.appstoreconnect/private_keys/`.
- Die Netzaufrufe beider Python-Skripte sind **noch nie gelaufen** (sie wurden in
  einem Container ohne die Schlüssel geschrieben, nur Syntax und Argumentprüfung
  sind getestet). Die API-Abläufe entsprechen denen, mit denen vc14 veröffentlicht
  wurde. Bei einem Fehler: Meldung lesen, Ablauf in CLAUDE.md gegenprüfen.

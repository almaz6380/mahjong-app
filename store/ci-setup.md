# Builds ohne Mac: GitHub Actions einrichten

Einmalige Einrichtung (~15 Minuten am Mac). Danach baut und veröffentlicht GitHub
die Apps auf Knopfdruck — aus jeder Claude-Sitzung, aus dem Browser, vom Handy.

Die Workflows liegen in `.github/workflows/android-release.yml` und
`ios-release.yml`. Sie starten **nur von Hand** (`workflow_dispatch`), nie
automatisch bei einem Push.

## Wo die Secrets hinkommen

GitHub → Repo `almaz6380/mahjong-app` → **Settings → Secrets and variables →
Actions → New repository secret**. Namen exakt so schreiben:

## Android (5 Secrets)

| Name | Wert |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | der Upload-Keystore als Base64 |
| `ANDROID_KEYSTORE_PASSWORD` | `storePassword` aus `android/keystore.properties` |
| `ANDROID_KEY_ALIAS` | `keyAlias` aus derselben Datei |
| `ANDROID_KEY_PASSWORD` | `keyPassword` aus derselben Datei |
| `PLAY_SERVICE_ACCOUNT_JSON` | **Inhalt** von `~/.config/play-publisher/key.json` |

Werte am Mac erzeugen:

```bash
# Keystore als eine lange Base64-Zeile in die Zwischenablage
base64 -i android/upload-keystore.jks | pbcopy

# Passwörter nachsehen
cat android/keystore.properties

# Dienstkonto-Key (kompletter JSON-Inhalt) in die Zwischenablage
cat ~/.config/play-publisher/key.json | pbcopy
```

## iOS (4 Secrets)

| Name | Wert |
|---|---|
| `IOS_CERT_P12_BASE64` | Distributions-Zertifikat + privater Schlüssel als `.p12`, Base64 |
| `IOS_CERT_PASSWORD` | das beim Export vergebene Passwort |
| `IOS_PROVISIONING_PROFILE_BASE64` | das App-Store-Provisioning-Profil (`.mobileprovision`), Base64 |
| `ASC_KEY_P8_BASE64` | `~/.appstoreconnect/private_keys/AuthKey_VGHCB8Z8Q2.p8`, Base64 |

Dazu zwei Klartext-Secrets, die schon bekannt sind:
`ASC_KEY_ID` = `VGHCB8Z8Q2`, `ASC_ISSUER_ID` = `0d4e473b-2807-4c66-9857-6b0eb78e62ce`

Zertifikat exportieren: Schlüsselbundverwaltung → *Apple Distribution: …* mitsamt
dem darunterliegenden privaten Schlüssel auswählen → Rechtsklick → „2 Objekte
exportieren" → `.p12` mit Passwort. Dann:

```bash
base64 -i ~/Desktop/dist.p12 | pbcopy
base64 -i ~/Library/MobileDevice/Provisioning\ Profiles/<profil>.mobileprovision | pbcopy
base64 -i ~/.appstoreconnect/private_keys/AuthKey_VGHCB8Z8Q2.p8 | pbcopy
```

## Auslösen

GitHub → **Actions** → „Android Release" bzw. „iOS Release" → **Run workflow**.
Optionen beim Android-Lauf: Veröffentlichung an alle (`complete`) oder gestuft,
Was-ist-neu-Text, und ein Schalter „nur bauen" für einen Trockenlauf.

Aus einer Claude-Sitzung geht dasselbe über die GitHub-Werkzeuge — einfach sagen:
„löse den Android-Release-Workflow aus, Veröffentlichung an alle".

## Vor jedem Release

**Versionsnummer erhöhen und committen**, sonst lehnen die Stores den Upload ab:

- Android: `versionCode` in `android/app/build.gradle`
- iOS: `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` (2 Stellen)

## Erster Lauf

Beim allerersten Mal den Schalter **„nur bauen"** setzen (Upload aus). Läuft der
Build durch und liegt das AAB als Artefakt bereit, ist die Signierung korrekt —
dann denselben Workflow noch einmal mit Upload starten.

Die iOS-Signierung auf fremden Rechnern ist erfahrungsgemäß die fummeligste
Stelle (Zertifikat, Profil, Team-ID müssen zusammenpassen). Android zuerst
einrichten, iOS danach.

## Eigener Mac als Läufer (keine GitHub-Minuten, seit 25.09.2026)

„iOS Release" und „Android Release" haben die Eingabe **`laeufer`**: `github`
(Standard, kostet Minuten — macOS zählt zehnfach) oder `mac` = Josefs MacBook als
*Self-hosted Runner*. Dieselbe Einrichtung läuft schon für Anigosha; Runner sind bei
einem persönlichen GitHub-Konto **je Repo** anzumelden.

**Einmal einrichten (am Mac, ~5 Minuten):**
1. GitHub → dieses Repo → Settings → Actions → Runners → **New self-hosted runner**
   → **macOS**, **ARM64**.
2. Im Terminal einen EIGENEN Ordner anlegen (nicht den von Anigosha!):
   `mkdir ~/actions-runner-mahjong && cd ~/actions-runner-mahjong`
3. Von der GitHub-Seite nur `curl …`, `tar xzf …` und `./config.sh …` kopieren,
   bei jeder Rückfrage Enter.
4. Statt `./run.sh`: `./svc.sh install && ./svc.sh start`

**Voraussetzungen am Mac:** Xcode ≥ 26, **CocoaPods** (`brew install cocoapods` —
dieses Projekt hat ein Podfile), Android-SDK unter `~/Library/Android/sdk`. Die
Workflows prüfen alle drei und brechen sonst mit klarer Meldung ab. Der Mac muss
während des Builds wach sein (MacBook: aufgeklappt, am Strom).

**Nichts Eigenes wird angefasst:** Wegwerf-Schlüsselbund unter `$RUNNER_TEMP`
(die Suchliste wird wiederhergestellt; früher setzte der iOS-Workflow hier sogar den
STANDARD-Schlüsselbund um), Profil unter eindeutigem Namen, API- und Play-Schlüssel
nur unter `$RUNNER_TEMP`, nie `~/.appstoreconnect` oder `/tmp`.
⚠ Das Repo darf nie öffentlich werden, solange der Runner angemeldet ist.

# Store-Eintrag pflegen — Texte, Screenshots, Grafiken

Beides läuft über GitHub, nicht über einen Rechner: Die Zugänge liegen als
Repository-Secrets, die Skripte holen sie sich dort. Damit lässt sich der
Store-Eintrag auch vom Handy aus ändern.

**App:** `com.mahjongroyale.app`

## Google Play

Workflow **„Play-Eintrag aktualisieren"** (Actions → Run workflow). Drei Modi,
Trockenlauf ist Vorgabe:

| Modus | ändert | erwartet die Dateien unter |
|---|---|---|
| `texte` | Titel, Kurz- und Volltext | `store/play-listing.de-DE.json` |
| `screenshots` | Telefon-Bilder (ersetzt alle) | `store/play-screenshots/` |
| `grafiken` | App-Symbol + Vorstellungsgrafik | s. Workflow-Datei |

Dahinter steckt `scripts/play-upload.py`; dasselbe Skript lädt auch das AAB
hoch. Direkt aufrufbar mit `--status`, `--listing`, `--screenshots`, `--icon`,
`--feature`, jeweils mit `--dry-run` und `--lang`.

⚠️ **`screenshots` löscht zuerst alle vorhandenen Bilder der Sprache** und lädt
dann den Ordnerinhalt in Dateinamen-Reihenfolge hoch. Ein unvollständiger Ordner
führt also zu einem unvollständigen Store-Eintrag.

## App Store Connect

Workflow **„App Store Connect"**, ebenfalls mit Trockenlauf als Vorgabe. Die
ASC-API braucht keinen Mac — der Lauf ist in Sekunden durch.

| Modus | tut |
|---|---|
| `status` | liest nur: Version, Build, Zustand |
| `warum` | liest nur: was blockiert die Einreichung? |
| `einreichungen` | liest nur: alle Einreichungen samt Zustand |
| `screenshots` | Bilder ersetzen (aus `store/ios-screenshots/`) |
| `build` | einen Build der offenen Version zuweisen |
| `aufraeumen` | festhängende Einreichungen zurückziehen |
| `exportfrage` | Exportbestimmungen am Build beantworten |
| `einreichen` | Version zur Prüfung schicken |

⚠️ **Apple sperrt die Metadaten, solange eine Prüfung läuft.** Änderungen gehen
nur, wenn die Version `PREPARE_FOR_SUBMISSION` oder `DEVELOPER_REJECTED` ist —
sonst antwortet die API mit 409. `status` sagt dir, woran du bist.

## Was bewusst gesperrt ist

`scripts/asc.py` stammt aus MyPeak und trägt dort fest verdrahtete Texte
(Store-Namen, Prüferhinweise, Abo-Bezeichnungen). Diese Befehle sind in dieser
Kopie abgefangen — sie würden sonst **fremde Texte in diese App schreiben**:

    --name  --pruefnotiz  --abo-screenshot  --abo-namen  --abo-notiz

Wer sie braucht: eigene Werte oben im Skript eintragen (`NAMEN`, die jeweilige
Funktion) und den Namen aus `NICHT_KONFIGURIERT` streichen.

## Screenshots erzeugen

Die Bilder selbst entstehen nicht hier, sondern aus der laufenden App. Vorlage
ist `scripts/store-screenshots.mjs` in MyPeak (Playwright gegen `vite preview`,
seedet einen realistischen Zustand und fotografiert die Bildschirme in
Store-Auflösung). Für diese App muss die Liste der Bildschirme einmal angepasst
werden — Routen und Beispieldaten sind je App verschieden.

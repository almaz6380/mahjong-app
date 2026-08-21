# Kampagnen-Links: woher eine Installation kam

Beide Stores können das **ohne SDK** — man muss die Adresse nur richtig bauen.
`public/links.html` erledigt das selbst, sobald sie mit einer Kennung
aufgerufen wird.

## Die Kennung

```
https://mahjong-app-plum.vercel.app/links.html?r=<reel>&p=<quelle>
```

| Feld | Bedeutung | Beispiele |
|---|---|---|
| `r` | welches Reel / welche Kampagne | `figuren`, `modi`, `paar`, `spot` |
| `p` | woher der Klick kam | `ig`, `tt`, `fb`, `bio`, `ad` |

Erlaubt sind nur Kleinbuchstaben, Ziffern, `-` und `_`; alles andere wird
weggeworfen. Fehlt ein Feld, steht `direct` bzw. `organic` drin.

Die Seite hängt daraus an:

- **Play** → `&referrer=utm_source=<p>&utm_medium=reel&utm_campaign=<r>`
- **Apple** → `?pt=<Token>&ct=<p>-<r>&mt=8`

## ⚠ Wo es misst — und wo nicht

| Weg | Gemessen |
|---|---|
| Facebook-Beitrag | **Reel + Quelle** — steht automatisch in jeder Caption |
| Link in der Bio | **Quelle** — von Hand setzen, z. B. `?p=bio-ig` |
| Bezahlte Anzeige | **Reel + Quelle** — als Ziel-URL der Anzeige eintragen |
| Instagram-/TikTok-Caption | **nichts** — und das ist Absicht |

Auf Instagram und TikTok ist die Adresse im Beschreibungstext **nicht
anklickbar**. Sie steht dort zum Ablesen, und `?r=…&p=…` tippt niemand ab —
eine Kennung, die niemand aufruft, misst nichts und macht die Zeile nur
unleserlich. Der klickbare Weg ist dort der **Link in der Bio**, und der
trägt die Kennung.

## ⚠ Apple braucht noch einen Wert

In `public/links.html` steht ganz oben im Skript:

```js
var APPLE_PT = '';
```

Das ist Apples **Provider-Token**. Solange es leer ist, bleibt der Apple-Link
unverändert — lieber keine Messung als ein kaputter Store-Link. Der Wert steht
in **App Store Connect → Analytics → Campaigns** (dort lässt sich ein
Kampagnen-Link erzeugen; der `pt=`-Wert darin ist der Token). Einmal eintragen,
dann misst auch iOS.

Play braucht nichts weiter — der `referrer` wirkt sofort.

## Wo die Zahlen danach stehen

- **Play Console** → Nutzergewinnung → Akquisitionsberichte, aufgeschlüsselt
  nach `utm_source` / `utm_campaign`.
- **App Store Connect** → Analytics → Campaigns (erst nach gesetztem `pt`).

⚠ Beide Berichte brauchen **Zeit und Menge**. Unter ein paar hundert
Installationen je Quelle sagt der Vergleich nichts — dasselbe Problem wie bei
den AdMob-eCPMs, wo ein einzelner Klick den Plattformwert um Euro verschoben
hat. Nicht nach zwei Tagen Schlüsse ziehen.

## Was das NICHT ersetzt

Es misst **Installationen nach Quelle**, nicht mehr. Für eine bezahlte
Kampagne, die auf Installationen *optimieren* soll, bräuchte Meta bzw. TikTok
ein eigenes SDK im Build — beides steckt heute nicht drin, und die sechs
SKAdNetwork-Einträge in der `Info.plist` gehören alle zu
AdMob-Vermittlungspartnern, nicht zu Meta oder TikTok.

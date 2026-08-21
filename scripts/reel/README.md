# Reel-Generator für Mahjong Royale

Baut aus echtem Gameplay fertige Hochkant-Videos (1080×1920, H.264 + AAC,
30 fps) samt Caption- und Hashtag-Datei. Kostet **nichts** — keine
Bildmodelle, keine Stimmen, kein fal.ai.

```bash
npm run build
npx vite preview --port 5199 --host 127.0.0.1     # nur wenn Aufnahmen FEHLEN
export CHROMIUM_PFAD=/opt/pw-browsers/chromium    # nur in der Cloud-Sitzung

node scripts/reel/charge.mjs                      # die ganze Charge (20 Reels, ~25 min)
node scripts/reel/charge.mjs --nur 3              # nur die ersten drei
node scripts/reel/charge.mjs --ab 12              # nach Abbruch weitermachen
```

Einzeln:

```bash
node scripts/reel/record-solitaire.mjs --level 40 --lang en --server http://127.0.0.1:5199
node scripts/reel/make-reel.mjs --clip out/reels/mahjong-solitaire-lvl40-en.mp4 \
                                --format fakt --fakt 7 --name mein-reel
```

## Die drei Formate

| Format | Eingangskarte | Wofür |
|---|---|---|
| `paar` | „Can you spot the pair?" | fordert zum Mitraten auf → Kommentare → Auslieferung |
| `clear` | „Every single tile. Gone." | reines Befriedigungs-Format, der Klang trägt |
| `fakt` | „Did you know?" + Fakt | Lesezeit ist Watchtime, und Watchtime ist der Ranking-Faktor |

Die Fakten kommen **live aus `src/game/facts.ts`** (34 Stück, DE+EN,
redaktionell geprüft und bewusst harmlos). Nicht hierher kopieren — eine
zweite Kopie läuft auseinander.

## Der Vorspann (seit 17.08.2026)

Vor jedem Reel steht eine rund 4 s lange Nahaufnahme aus einem kie.ai-Clip —
Hände und echte Mahjong-Steine im Kerzenlicht —, die per Kreuzblende auf das
Spielbrett übergeht. `plan.mjs` rotiert über die Charge durch **sieben Motive**
(`vorspannFuer`), damit niemand denselben Einstieg zweimal hintereinander sieht:

| Motiv | Was passiert | Übergang |
|---|---|---|
| `steine-legen` | ein Stein wird abgelegt, die Hand zieht sich zurück | `fade` |
| `steine-kippen` | eine Reihe kippt wie Dominosteine | `smoothdown` |
| `stein-drehen-a` | verdeckter Stein wird gedreht, roter Drache erscheint | `circleopen` |
| `stein-drehen-b` | dasselbe mit drei Steinen (nur 4,0 s) | `circleopen` |
| `steine-mischen-a` | Hände mischen eine Fläche aus Steinen | `smoothleft` |
| `steine-mischen-b` | dasselbe, tiefe Kamera | `smoothright` |
| `mauer-bauen-a` | ein Turm wächst nach oben | `smoothup` |

**Der Übergang setzt die Bewegung des Clips fort** — wächst der Turm nach oben,
steigt das Brett von unten herein; wischen die Hände quer, wischt der Übergang
mit. Ein richtungsloser Übergang nach einer gerichteten Bewegung lässt den
Schnitt stehen, statt ihn zu tragen.

⚠ **Die Hook-Karte braucht ihre Standzeit** (`HOOK_LANG`). `hookSek` sagt, wie
lange die Frage *steht* — beim Einbau des Vorspanns blieb die Karte auf ihren
1,3 s, von denen dann 0,6 s Einblende und 0,35 s Ausblende abgingen: Sie stand
noch 0,35 s statt 0,95 s, und der Text blendete mitten in der Kreuzblende ein.
Film, Brett und Schrift lagen gleichzeitig übereinander. Die Blendzeit gehört
oben drauf, und der Text kommt erst danach — erst wechselt das Material, dann
die Botschaft.

```bash
node scripts/reel/kie-clip.mjs                 # Trockenlauf: Prompts + Kosten
node scripts/reel/kie-clip.mjs --los           # Clips erzeugen (kostet Geld!)
node scripts/reel/messe-vorspann.mjs           # Schnittpunkte messen
node scripts/reel/make-reel.mjs --clip … --vorspann stein-drehen-a
node scripts/reel/make-reel.mjs --clip … --vorspann aus     # der alte Einstieg
```

⚠ **Nicht jeder erzeugte Clip taugt.** Zwei von neun liegen ungenutzt im
Ordner, und beide Gründe sind lehrreich: `steine-zwei-haende` hat ein
Ruhefenster, in dem die Hände bloß *reglos im Bild stehen* — die Kurve sieht
still aus, das Bild ist es nicht. `mauer-bauen-b` besteht die Messung, zeigt
aber eine Reihe, die fast von vorn ins Bild läuft; die Steine füllen nur ein
Drittel der Fläche, und der Match-Cut lebt davon, dass sie sie füllen. Ihre
Messwerte stehen als Kommentar in `vorspaenne.mjs`.

**Warum das trägt, während der erste Anlauf mit den Tempel-Szenen scheiterte:**
Damals lag die Hook-Karte *über* einer Filmszene, zu der sie nichts sagte, und
Film und flache App-Oberfläche haben kein gemeinsames Motiv — eine Blende
dazwischen verlangsamt denselben Bruch nur. Jetzt läuft der Vorspann *vor* der
Hook-Karte, und beide Seiten zeigen dasselbe: Mahjong-Steine, formatfüllend.
Das ist ein Match-Cut.

⚠ **Der Schnittpunkt jedes Clips ist ausgemessen, nicht geschätzt** — deshalb
steht in `vorspaenne.mjs` eine Tabelle und nicht ein Dateiname. Ein Clip ohne
Eintrag wird abgelehnt. Ein geratener Schnitt bei 2,4 s riss mitten in
die Bewegung; erst der gemessene bei 2,2–6,4 s zeigt den ganzen Bogen (absenken
→ ablegen → Hand zurück → Stein steht allein). Messrezept: Bewegung je 1/5 s als
mittlere Pixeldifferenz zweier Graustufenbilder auftragen — der Schnitt beginnt
kurz vor dem Bewegungsberg und endet in der Ruhe dahinter.

⚠ **`VOR_VERSATZ` ist die Stelle, an der das kaputtgeht.** Der Ton sitzt auf
mitgeschriebenen Klickzeiten; der Vorspann schiebt die ganze Zeitachse nach
hinten. Es gibt deshalb genau eine Konstante dafür, und sie wird überall addiert
— Blenden, Fortschrittsbalken, Steinklänge, Melodie, Whoosh. Gegenprobe: Bilder
zu den Match-Zeiten aus beiden Fassungen vergleichen (Abweichung < 0,5/255),
bei 0,4 s Versatz muss sie deutlich springen.

## Aufbau

```
record-solitaire.mjs   spielt ein Level echt durch, nimmt per CDP-Screencast auf
   └─ *.json           Beipackzettel: Klickzeiten, Siegzeitpunkt, Paarzahl
synth.mjs              erzeugt die Tonspur — Nachbau des WebAudio-Synths der App
formate.mjs            Texte, Hashtags, Caption-Vorlagen
make-reel.mjs          Vorspann + Hook + Spiel + Abspann + Ton → Reel + .txt
vorspaenne.mjs         die Clips mit ihren GEMESSENEN Schnittpunkten
kie-clip.mjs           erzeugt neue Clips über kie.ai (Google Veo)
messe-vorspann.mjs     misst den Bewegungsverlauf, schlägt den Schnitt vor
plan.mjs               welches Reel welches Format, Level und welchen Vorspann hat
charge.mjs             fährt den Plan ab
assets/vorspann/       die kie.ai-Clips samt Prompt daneben

record-modi.mjs        fährt jeden Spielmodus an und nimmt ihn bewegt auf
reel-modi.mjs          schneidet die Modi zum „sechs Spiele"-Reel zusammen
effekte.mjs            die Effekte auf den Schnitten samt Blitz-Obergrenzen
spot-domino.mjs        der Domino-Spot (kie.ai-Kettenreaktion + Endrampe)
```

### Das Modi-Reel

Zwanzig Beiträge lang zeigte der Kanal **ein** Spiel. `reel-modi.mjs` ist das
erste Format, das etwas über das Produkt erzählt: Solitaire → Paare → Connect →
3D → Riichi → Zeit-Blitz, absteigend kürzer geschnitten (3,4 → 2,2 s), damit es
von allein anzieht.

Zwei Regeln, die dabei teuer gelernt wurden:

- **Ausgewählt wird nach optischer Verschiedenheit, nicht nach Beliebtheit.**
  Die erste Fassung hatte Connect *und* Match-3 — beides ein dichtes flaches
  Raster aus denselben Steinen, nebeneinander liest sich das als dasselbe Spiel
  zweimal. Genau den Eindruck soll das Reel ja widerlegen.
- **Ein Modus, der nur seinen Zustand wechselt, ist kein Filmmaterial.**
  Der CDP-Screencast liefert Bilder nur bei Bildänderung. Match-3 setzt mit
  `setGrid()` das fertig aufgelöste Brett in EINEM Schritt (die CSS-Regel
  `.m3-cell.clear` ist verwaist) — Ergebnis: rund ein Bild je Zug, eine
  Diashow. Dasselbe gilt für 2048. Umgekehrt ist **Dimensions 3D** mit Abstand
  das beste Material, weil sich seine Szene wirklich dreht: gemessen Ø5,99
  Bildänderung gegen 0,3–0,8 bei allen anderen.

Die Antriebe rechnen den gültigen Zug **vorher im Browser** (dieselbe Regel wie
`canConnect`, `findMatches`, bzw. `faceId` bei Paare) und klicken dann genau
ihn. Blind zu tippen ergab bei Connect zwei gültige Züge in neun Sekunden.

## Fallen, die hier schon zugeschnappt sind

1. **Der Preview-Server muss laufen — aber nur, wenn Aufnahmen fehlen.** Am
   11.08. war er als abgekoppelter Prozess gestartet und starb nach zwei Reels;
   die Charge rannte 18 Mal in denselben Fehler. Sie prüft ihn jetzt vorab und
   bricht nach drei Fehlschlägen ab.
   ⚠ Die Prüfung lief bis zum 17.08. **bedingungslos** und stand damit jedem
   Neubau im Weg: Liegen alle Rohaufnahmen vor, ist eine Charge reine
   Nachvertonung aus den Beipackzetteln — kein Browser, keine App, kein Server.
   Trotzdem verlangte sie `npm run build` plus laufenden Server und zwang einen
   Lauf, der nichts aufnimmt, ausgerechnet durch die Fehlerquelle, gegen die sie
   erfunden wurde. Sie fragt jetzt nur noch, wenn eine Aufnahme wirklich fehlt.
2. **Zeitstempel niemals vom letzten Bild nehmen.** Der Screencast liefert nur
   bei Bildänderung — in einer Wartepause steht er still, und ein Klick bekäme
   die Zeit des letzten Bildwechsels. Die Uhr hängt deshalb an der Ankunft des
   **ersten** Bildes. Gegenprobe: Die Abstände müssen der Tempo-Rampe in
   `record-solitaire.mjs` entsprechen (0,31 s → 0,12 s).
3. **Kein Ton in der Aufnahme.** Der CDP-Screencast liefert nur Bild, und in der
   App ist der Klang beim Aufnehmen abgeschaltet. Der gesamte Ton entsteht
   nachträglich aus dem Beipackzettel.
4. **Playwrights mitgelieferter ffmpeg kann kein MP4** (nur VP8/WebM) — deshalb
   `ffmpeg-static`. `ffprobe` gibt es in der Cloud-Sitzung nicht; Längen misst
   `dauerVon()` über `ffmpeg -i`.
5. **`playwright-core`, niemals `playwright`.** Das volle Paket lädt bei jeder
   Installation drei Browser herunter (~150 MB, eigener postinstall). Vercel
   installiert die devDependencies mit, bevor es baut — mit `playwright` in der
   `package.json` hinge an jedem Deploy des Web-Bundles ein Browser-Download,
   der mit dem Bundle nichts zu tun hat. Den Pfad liefert `browser.mjs`; ohne
   Fund bricht es mit einer Anleitung ab statt mit einem Stapelabzug.
   ⚠ Beide Pakete gehören in die `package.json`. Sie fehlten dort bis zum
   16.08.2026 und steckten nur in der `node_modules` der Sitzung, in der sie
   installiert wurden — eine frische Sitzung starb sofort mit
   „Cannot find module 'playwright'", und weil die Charge nach drei
   Fehlschlägen abbricht, meldete sie irreführend den Preview-Server.
5. **`.app` nicht zu einer Flexbox machen**, um das Brett zu zentrieren — dabei
   kollabiert die Breite und das Brett schrumpft auf einen Streifen. Und
   Kopfzeile/Bedienleiste heißen `.hud` und `.controls`; ein Selektor auf
   `header` träfe die SVG-Definitionen aus `main.tsx`, auf die jeder Stein
   per `url(#gold)` verweist.
6. **Der Erfolgs-Hinweis der App** (`.ach-toast`) hängt an
   `env(safe-area-inset-top)`, das im Browser 0 ist — ohne Korrektur klebt er
   auf der eingeblendeten Statusleiste.

### Der Tempel-Vorspann des Modi-Reels

Seit 21.08.2026 beginnt das Modi-Reel mit dem Jungen vor dem Tempeltor
(`tempel-tor.mp4`), dann einer Nahaufnahme der Steine, dann erst der App.

⚠ **Die mittlere Szene ist kein Schmuck, sie ist der Grund, warum es trägt.**
Der erste Anlauf mit den Tempel-Szenen ist genau daran gescheitert, dass Film
und flache App-Oberfläche **kein gemeinsames Motiv** haben: Ein Junge vor einem
Tor und ein Spielbrett teilen sich kein einziges Element, und eine längere
Blende verlangsamt denselben Bruch nur. Die Stein-Nahaufnahme dazwischen ist
die Brücke — der Film endet formatfüllend auf Steinen, das Brett fängt mit
Steinen an. Wer sie herausnimmt, holt sich den alten Bruch zurück.

⚠ **Nicht in die Tempelszene hineinzoomen**, obwohl dort Steine auf dem Tisch
liegen: Die Quelle ist 720×1280, der Steinstapel darin keine 400 px hoch.
Formatfüllend hieße fast dreifach hochskalieren — matt und weich genau in dem
Bild, das die Schärfe der App verkaufen soll. `steine-legen` liegt in voller
Auflösung bereit und hat einen gemessenen Schnittpunkt.

Die Kette rechnet seitdem über eine **Teileliste** (`TEILE`/`UEBERGAENGE`)
statt über „Hook + Segmente + Abspann". Sonst müsste jede Zeitrechnung den Film
als Sonderfall kennen, und genau so entstehen zwei Rechenwege, die
auseinanderlaufen. Ein Riegel prüft, dass es zu *n* Teilen *n−1* Übergänge gibt.
Auf den Filmschnitten liegt **kein** Steinklang (dort klickt nichts), wohl aber
ein Whoosh in die Hook-Karte.

### Der Abspann

Die Abspannkarte ist die **Marke** und steht genau einmal, als `abspannHtml()`
in `karten.mjs`. Seit 21.08.2026 zeigt sie Icon → „Mahjong Royale" →
Modus-Zeile → Spruch → **beide Store-Badges** (Josefs Variante „B").

⚠ **Sie stand bis dahin doppelt im Code** — einmal hier und noch einmal
Zeichen für Zeichen inline in `make-reel.mjs`, das die Charge-Reels baut.
Aufgefallen ist es erst, als der Abspann geändert werden sollte: Nur eine
Stelle zu ändern hätte bedeutet, dass die Charge-Reels stumm den alten
Goldbalken behalten. Geteilt wird das **Markup**, nicht der Renderer —
`make-reel.mjs` bringt seinen eigenen Browser mit, und den umzubauen wäre ein
Risiko ohne Gewinn. Wer die Karte anfasst, fasst sie in `karten.mjs` an.

Aus demselben Grund gibt es **kein Vorschau-Skript** für Abspann-Varianten
mehr: Es trug die Anordnung ein zweites Mal und wäre nach der ersten Änderung
an der echten Karte veraltet gewesen — also wieder genau der Fehler, den dieser
Abschnitt beschreibt. Varianten sind stattdessen **Parameter** von
`abspannHtml()` (siehe `SPRACH_ZEILE`); eine Vorschau ruft dieselbe Funktion
mehrfach mit verschiedenen Werten auf und rendert damit immer die echte Karte.

Unter den Badges steht seit 21.08.2026 „Playable in 7 languages" samt Kürzeln.
⚠ **Die Sprachliste wird aus `src/i18n.ts` GELESEN, nicht abgeschrieben**
(`sprachen()` in `karten.mjs`, gleiches Muster wie `fakten()` in
`formate.mjs`) — und sie **wirft**, wenn `LANGS` dort nicht mehr zu finden ist.
Eine Kopie wäre nach der achten Sprache stillschweigend falsch, und im Abspann
fällt das niemandem auf. Die Zahl im Text kommt aus `LANGS.length` und steht
nirgends als Ziffer im Code. Die Kürzel sind großgeschrieben wie in der App
selbst (`l.toUpperCase()` in `src/ui/Screens.tsx`).

Die Zeile muss **untergeordnet** bleiben (klein, gedämpft): Die Karte trägt mit
Name, Modus-Zeile, Spruch und Badges schon vier Blöcke — ein fünfter auf
gleicher Lautstärke nimmt dem Spruch die Wirkung.

Nebenbei behoben: `logo.png` ist zu 100 % deckend und bringt seinen eigenen
Grünton mit (#164D3C), während der Kartenverlauf dunkler ist — hinter dem Logo
stand deshalb in **jedem** bisherigen Abspann ein sichtbar hellerer Kasten.
Nicht freigestellt, denn das Bild *ist* das App-Icon: runde Ecken und ein
Schatten machen daraus ein Icon statt einer Panne.

### Effekte zwischen den Modi

Seit 21.08.2026 liegt auf jedem Schnitt ein Effekt — auf Josefs ausdrücklichen
Wunsch im TikTok-Stil (`effekte.mjs`, fünf Stück, jeder anders: Steinwand,
Glitch, Zoom-Punch, Whip, Blitzschlag).

Die Regel, an der alles hängt:

> **Ein Effekt liest sich als gewollt, wenn er kurz ist, eine erkennbare Form
> hat und auf einem Klang sitzt. Er liest sich als Fehler, wenn er weich,
> ganzflächig und lautlos ist.**

Genau daran waren `zoomin` und `hblur` als nackte Übergänge gescheitert —
ganzflächige Schlieren, die wie ein Defekt aussahen. `zoomin` ist jetzt wieder
drin und funktioniert, weil ein Blitz auf seiner hässlichsten Stelle sitzt.
Wer den Blitz herausnimmt, holt sich den Defekt zurück.

Drei Dinge, die man dabei nicht einzeln zurückdrehen darf:

- **Harter Schnitt + Effekt gehören zusammen.** Unter einer deckenden Grafik
  ist eine Überblendung nur Matsch, deshalb 0,08 s. Ohne den Effekt wäre das
  zu hart — der Blitz gibt dem Auge das Ereignis, das einer nackten
  Schnittkante fehlt.
- **Das Bild wird für den Ruckler um 4 % größer skaliert.** Ohne diesen Rand
  blitzt bei jedem Stoß die schwarze Unterlage an der Kante auf.
  `pruefeAmplituden()` setzt die Grenze durch.
- **Jeder Schnitt hat Whoosh (zieht hin) und Aufprall (schlägt zu).** Vorher
  lag genau *ein* Whoosh im ganzen Reel, bei t=0,1 s — trotz gegenteiligem
  Kommentar. Ein Effekt ohne Ton liest sich als Störung.

⚠ **Blitze sind gedeckelt, und das ist keine Geschmacksfrage.** Vollflächige
Blitze in schneller Folge können bei photosensitiver Epilepsie Anfälle
auslösen; der Richtwert ist höchstens **drei pro Sekunde**. Das Reel liegt bei
0,14/s und einer Spitze von 85 % (nie reines Weiß). `reel-modi.mjs` bricht ab,
wenn zwei Blitze näher als 0,4 s liegen oder einer heller als 0,9 wird —
gemessen wird mit `signalstats`, nicht geschätzt.

### Playwright: „ist da" heißt nicht „ist sichtbar"

`waitForSelector` wartet von Haus aus auf **sichtbar**. `.dim-scene` ist immer
da, hat aber keine eigene Fläche (ihre Steine sitzen absolut in einem
3D-Raum) — Playwright meldet sie als `hidden` und der Zeitgeber läuft ab,
während `locator('.dim-scene').count()` im selben Moment 1 liefert. Das hat
Dimensions 3D einen halben Abend lang als „nicht aufnehmbar" erscheinen lassen.
Auf ein Element warten, das Fläche hat (`.dim-tile`).

Dazu kam ein zweiter Trugschluss: Der fehlgeschlagene Lauf wirkte wie ein
**Hänger**. Tatsächlich war die Zusammenfassung längst gedruckt — nur stand
`browser.close()` im Gutfall statt im `finally`, also blieb Chromium offen und
node kam nicht zum Ende. Aufräumen gehört ins `finally`, sonst diagnostiziert
man den Aufräumfehler als Navigationsproblem.

## Beim Hochladen

Steht in jeder `.txt` noch einmal, hier zum Nachschlagen:

- **TikTok als Business-Konto, Instagram als Creator-Konto.** Unter 1000 Followern
  gibt TikTok das Website-Feld nur Unternehmenskonten; Instagram macht den Link
  unabhängig von Kontoart und Followerzahl klickbar.
  ⚠ **Bis 16.08.2026 stand hier das Gegenteil** („Creator, nicht Business — sonst
  fehlt die volle Musikbibliothek"). Der Rat war falsch, und zwar aus einem Grund,
  der die Bibliotheksfrage gleich mit erledigt: siehe nächster Punkt.
- **Keine Chart-/Trending-Sounds unter die Reels.** Sie sind für *private* Beiträge
  lizenziert, nicht für Firmen, die ein Produkt bewerben — Mahjong Royale verdient
  über Werbung und Käufe, ein Chart-Hit darunter ist gewerbliche Nutzung. Genau
  deshalb ist die Bibliothek für Unternehmenskonten beschnitten; das ist kein
  Nachteil des Kontotyps, sondern die Lizenzlage. Wird es erkannt, ist das Video
  stumm — und ein stummes Reel ist tot.
  **Die Reels brauchen ohnehin keine Musik:** sie bringen Steinklänge und
  Sieg-Zeremonie mit, und beim Format `clear` ist genau das der Reiz („Sound on").
  Wer Musik will, nimmt die **Commercial Music Library** des Business-Kontos.
- **Die Download-Adresse steht in allen drei Fassungen** (Josefs Vorgabe,
  16.08.2026). ⚠ Hier stand bis dahin das Gegenteil („kein Store-Link in der
  Caption"). Die Abwägung dahinter gilt weiter: Auf Instagram und TikTok ist die
  Adresse *nicht anklickbar* und kann die Auslieferung drücken — sie steht dort
  zum Ablesen, der klickbare Weg bleibt der Link im Profil. Auf Facebook ist sie
  klickbar und gehört in voller Form mit `https://` hinein. Erzwungen von
  `check-captions.mjs`.
- **Auf Instagram den Facebook-Haken mitnehmen.** Die Mahjong-Zielgruppe ist dort
  älter und der Wettbewerb geringer als auf TikTok.

⚠ Der Abspann zeigt seit 21.08.2026 die **Badges beider Stores** statt des
Satzes „Free on the App Store & Google Play". Die Aussage ist dieselbe, nur als
Bild — ein Badge ist keine Verzierung, sondern eine Behauptung über
Verfügbarkeit. Das stimmt für Mahjong Royale (beide Stores seit 29.7.2026);
**für Anigosha gilt sie nicht** — diese Vorlage nicht ungeprüft dorthin kopieren.

Die Badge-Dateien unter `assets/badges/` sind **unverändert** von
developer.apple.com und play.google.com. ⚠ **Niemals nachzeichnen**: Apple
untersagt das in den Marketing-Richtlinien ausdrücklich, Google ebenso. Ein
selbstgemalter schwarzer Knopf mit Apfel ist eine Markenverletzung, auch wenn
er identisch aussieht. Und beide müssen **gleich hoch** nebeneinander stehen —
dafür wird Googles einbelichteter 41-px-Rand herausgerechnet, sonst wirkt sein
Badge kleiner als Apples.

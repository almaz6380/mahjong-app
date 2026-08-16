#!/usr/bin/env node
// Eigenstaendiger Werbespot: Filmszene → Brett → Abspann.
//
//   node scripts/reel/spot.mjs [--clip out/reels/roh/mahjong-solitaire-lvl18-en.mp4]
//
// Anders als ein Reel zeigt der Spot zuerst eine Geschichte (Junge kommt zum
// Tempel, tritt ein, spielt gegen den Meister) und erst danach kurz die App.
//
// ⚠ Warum das NICHT als Vorspann in die Reels gehoert: Genau so wurde es am
// 16.08.2026 zuerst gebaut und verworfen. In einem Reel liegt die Hook-Karte
// („Can you spot the pair?") ueber der Filmszene, zu der sie nichts sagt, und
// der Schnitt aufs Brett wirkt wie ein Bruch statt wie eine Aufloesung. Als
// eigener Spot traegt dieselbe Szene, weil sie erzaehlen darf.

import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lauf, dauerVon } from './ffmpeg.mjs';
import { mitBrowser, abspannKarte, B, H } from './karten.mjs';
import { spurRendern, melodie } from './synth.mjs';
import { captionText } from './formate.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');
const ASSETS = join(HIER, 'assets');
const FPS = 30;

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const CLIP = join(WURZEL, arg('clip', 'out/reels/roh/mahjong-solitaire-lvl18-en.mp4'));
const OUT = join(WURZEL, arg('out', 'out/reels'));
const NAME = arg('name', 'mahjong-spot-EN');
const TMP = join(OUT, '.spot');

// Die Filmszenen in Erzaehlreihenfolge: `ab` = Startpunkt in der Quelle.
//
// ⚠ Der Startpunkt ist der Grund, warum der Uebergang „er setzt sich und
// beginnt zu spielen" zuerst komisch aussah. `tempel-innen` und
// `sensei-spiel` sind zwei getrennt erzeugte Clips, die MIT DER ZEIT
// aufeinander zulaufen: In beiden endet man bei „Junge links, Meister rechts,
// Steine auf dem Tisch". Nimmt man von beiden die Mitte, blendet man zwischen
// zwei fast gleichen Bildern — zu aehnlich, um als neue Einstellung zu lesen,
// zu verschieden, um durchzugehen. Das Ergebnis wirkt wie ein Morph, nicht
// wie ein Schnitt.
//
// Deshalb wird von jedem Clip der Teil genommen, in dem er sich vom anderen
// UNTERSCHEIDET:
//   tempel-innen ab 0,0 — der Junge kommt von hinten herein, klein und fern
//   sensei-spiel ab 3,5 — er spielt bereits, nah und in Bewegung
// Damit stehen eine weite und eine nahe Einstellung nebeneinander, und die
// Blende hat etwas zu tun.
const SZENEN = [
  { datei: 'tempel-tor.mp4', ab: 0.0, sek: 3.0 },
  { datei: 'tempel-innen.mp4', ab: 0.0, sek: 2.2 },
  { datei: 'sensei-spiel.mp4', ab: 3.5, sek: 3.5 },
];
// Blende je Uebergang, nicht global.
// ⚠ Der zweite ist bewusst fast ein HARTER Schnitt (0,12 s = 3–4 Bilder).
// Eine lange Blende war der Notbehelf, solange die beiden Einstellungen fast
// gleich aussahen — sie hat die Doppelbelichtung erzeugt, die wie ein Morph
// wirkte. Jetzt stehen eine weite und eine nahe Einstellung nebeneinander,
// und dort gehoert ein Schnitt hin, keine Ueberblendung.
const BLENDEN = [0.4, 0.12];
const BRETT_SEK = 5.0;       // wie lange das echte Spiel zu sehen ist
const ABSPANN_SEK = 3.0;

// --- Der Match-Cut ----------------------------------------------------------
// ⚠ Zwei Fassungen sind vorher gescheitert, weil der Uebergang als BLENDE
// gedacht war. Das Problem ist aber nicht die Blende, sondern was aufeinander
// trifft: fotorealistischer Film gegen flache App-Oberflaeche mit
// Statusleiste, Kopfzeile und vier Knoepfen. Diese Bilder haben KEIN
// gemeinsames Element — eine Ueberblendung macht daraus nur eine langsame
// Version desselben Bruchs.
//
// Die Loesung ist ein Match-Cut: Beide Seiten auf dasselbe Motiv bringen —
// Mahjong-Steine, formatfuellend — und dort schneiden.
//   Filmseite: die Kamera faehrt waehrend der letzten Szene auf die Steine
//              des Meisters zu (Zoom 1,0 → 2,0).
//   App-Seite: beginnt auf dem BRETT ALLEIN, ohne Bedienoberflaeche
//              (Zoom 1,57), und zoomt dann heraus, bis das ganze Handy zu
//              sehen ist.
//
// Die Werte sind an Einzelbildern AUSGEMESSEN, nicht geschaetzt:
//   Film 720×1280: Steine liegen bei x 160–600, y 940–1140 → Mitte (0.53, 0.81)
//   App 1080×1920: Brett liegt bei x 108–972, y 360–1584 → Mitte (0.50, 0.51)
// Das Brett ist damit praktisch schon bildmittig, der Auszoom bleibt zentriert.
const FILM_ZOOM = 2.0;       // wie nah die Kamera an die Steine faehrt
const FILM_MITTE = [0.53, 0.81];
const BRETT_ZOOM = 1.57;     // 1920/1224 — Brett fuellt das Bild
const AUSZOOM_SEK = 1.3;

for (const s of SZENEN) {
  if (!existsSync(join(ASSETS, 'vorspann', s.datei))) {
    console.error(`✗ Filmszene fehlt: ${s.datei}`);
    process.exit(1);
  }
}
if (!existsSync(CLIP)) {
  console.error(`✗ Gameplay-Aufnahme fehlt: ${CLIP}`);
  process.exit(1);
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

// --- Karten -----------------------------------------------------------------
console.log('Karten rendern …');
await mitBrowser(async (schuss) => {
  await abspannKarte(schuss, join(TMP, 'abspann.png'));
});

// --- Filmteil ---------------------------------------------------------------
// Jede Szene einzeln auf 1080×1920 bringen, dann ueberblenden. Einzeln, weil
// xfade gleiche Formate und Bildraten braucht — die Veo-Clips liefern 24 fps.
console.log('Filmszenen schneiden …');
for (const [i, s] of SZENEN.entries()) {
  const letzte = i === SZENEN.length - 1;
  const bilder = Math.round(s.sek * FPS);
  // Nur die letzte Szene faehrt heran — sie ist die Haelfte des Match-Cuts.
  // ⚠ zoompan rechnet in EINGANGSBILDERN (`on`), nicht in Sekunden; mit d=1
  // gibt es genau ein Ausgangsbild je Eingangsbild. Die Quelle liefert 24 fps,
  // deshalb wird VORHER auf 30 gebracht, sonst laeuft die Fahrt zu schnell ab.
  const fahrt = letzte
    ? `,zoompan=z='1+${(FILM_ZOOM - 1).toFixed(2)}*on/${bilder}'`
      + `:x='(iw-iw/zoom)*${FILM_MITTE[0]}':y='(ih-ih/zoom)*${FILM_MITTE[1]}'`
      + `:d=1:s=${B}x${H}:fps=${FPS}`
      // Farbbruecke: Der Film ist warm (rote Laternen), die App kuehl (Jade).
      // Ein leichter Zug ins Kuehle nimmt der Blende den Farbsprung.
      + `,colorchannelmixer=rr=0.95:bb=1.07`
    : '';
  await lauf([
    '-y', '-ss', String(s.ab), '-t', String(s.sek), '-i', join(ASSETS, 'vorspann', s.datei),
    '-vf', `scale=${B}:${H}:force_original_aspect_ratio=increase,crop=${B}:${H},fps=${FPS}${fahrt},format=yuv420p`,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', join(TMP, `f${i}.mp4`),
  ]);
}

// Ton der Szenen getrennt ziehen: Schritte und Raumklang sind der Unterschied
// zwischen Film und Diashow. ⚠ Nicht jede Veo-Szene hat eine Tonspur — fehlt
// sie, wird Stille erzeugt, sonst bricht das spaetere Mischen ab.
for (const [i, s] of SZENEN.entries()) {
  const quelle = join(ASSETS, 'vorspann', s.datei);
  try {
    await lauf(['-y', '-ss', String(s.ab), '-t', String(s.sek), '-i', quelle, '-vn',
      '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', join(TMP, `a${i}.wav`)]);
  } catch {
    await lauf(['-y', '-f', 'lavfi', '-t', String(s.sek),
      '-i', 'anullsrc=r=48000:cl=stereo', join(TMP, `a${i}.wav`)]);
  }
}

const filmSek = SZENEN.reduce((a, s) => a + s.sek, 0) - BLENDEN.reduce((a, b) => a + b, 0);
const v1 = SZENEN[0].sek - BLENDEN[0];
const v2 = v1 + SZENEN[1].sek - BLENDEN[1];

// ⚠ KEIN KI-Symbol im Bild — auf Josefs Wunsch. Die Kennzeichnung steht
// stattdessen im Beschreibungstext (formate.mjs, Format `spot`) und beim
// Hochladen ueber den plattformeigenen Schalter. Wer das Symbol doch will:
// Es lag hier als overlay auf film.mp4, damit es NUR die Filmszenen trifft
// und nicht das echte Gameplay.
await lauf([
  '-y', '-i', join(TMP, 'f0.mp4'), '-i', join(TMP, 'f1.mp4'), '-i', join(TMP, 'f2.mp4'),
  '-filter_complex',
  `[0:v][1:v]xfade=transition=fade:duration=${BLENDEN[0]}:offset=${v1.toFixed(3)}[a];`
  + `[a][2:v]xfade=transition=fade:duration=${BLENDEN[1]}:offset=${v2.toFixed(3)},fps=${FPS}[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  '-pix_fmt', 'yuv420p', join(TMP, 'film.mp4'),
]);

// --- Brett -----------------------------------------------------------------
console.log('Brett schneiden …');
// ⚠ KEINE Download-Leiste ueber dem Brett. Sie lag zuerst ueber den
// Bedienknoepfen, dann am unteren Rand — beides wirkte aufgeklebt und hat das
// Bild zugestellt. Der Aufruf zum Laden steht im Abspann, und dort genuegt er.
const auszoomBilder = Math.round(AUSZOOM_SEK * FPS);
await lauf([
  '-y', '-t', String(BRETT_SEK), '-i', CLIP,
  '-vf',
  // Beginnt formatfuellend auf dem Brett und zieht dann auf das ganze Geraet
  // zurueck. Das ist die zweite Haelfte des Match-Cuts.
  `scale=${B}:${H},fps=${FPS},`
  + `zoompan=z='max(1,${BRETT_ZOOM}-${(BRETT_ZOOM - 1).toFixed(3)}*min(1,on/${auszoomBilder}))'`
  + `:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=${B}x${H}:fps=${FPS},format=yuv420p`,
  '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'brett.mp4'),
]);

// --- Abspann ----------------------------------------------------------------
await lauf([
  '-y', '-loop', '1', '-t', String(ABSPANN_SEK), '-i', join(TMP, 'abspann.png'),
  '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'abspann.mp4'),
]);

// --- Alles zusammen ---------------------------------------------------------
console.log('Zusammensetzen …');
const BLENDE_ENDE = 0.5;
// ⚠ Jetzt eine BLENDE statt des harten Schnitts — aber nur, weil auf beiden
// Seiten dasselbe Motiv steht: Der Film endet formatfuellend auf den Steinen
// des Meisters, die App beginnt formatfuellend auf ihrem Brett. Ohne diese
// Angleichung war die Blende wirkungslos (zwei Fassungen lang).
const BLENDE_MATCH = 0.6;
const brettAb = filmSek - BLENDE_MATCH;
const abspannAb = brettAb + BRETT_SEK - BLENDE_ENDE;
const dauer = abspannAb + ABSPANN_SEK;

await lauf([
  '-y', '-i', join(TMP, 'film.mp4'), '-i', join(TMP, 'brett.mp4'), '-i', join(TMP, 'abspann.mp4'),
  '-filter_complex',
  // ⚠ `settb=AVTB` auf ALLEN Seiten ist Pflicht: die Quellen bringen
  // verschiedene Zeitbasen mit (1/1000000 gegen 1/15360), und xfade lehnt das
  // mit „do not match … Failed to configure output pad“ ab. Die Meldung nennt
  // den Filter, nicht die Ursache.
  `[0:v]settb=AVTB[f];[1:v]settb=AVTB[b];[2:v]settb=AVTB[ab];`
  + `[f][b]xfade=transition=fade:duration=${BLENDE_MATCH}:offset=${brettAb.toFixed(3)}[fb];`
  + `[fb][ab]xfade=transition=fadeblack:duration=${BLENDE_ENDE}:offset=${abspannAb.toFixed(3)},`
  + `fps=${FPS},format=yuv420p[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'stumm.mp4'),
]);

// --- Ton --------------------------------------------------------------------
console.log('Ton mischen …');
const sfx = (n) => join(ASSETS, 'sfx', `${n}.aac`);
const ms = (s) => Math.round(Math.max(0, s) * 1000);

// Steinklaenge und Melodie fuer den Brett-Abschnitt, aus dem Beipackzettel.
// Nur die Zuege, die in die 5 Sekunden fallen.
let beiblatt = {};
try { beiblatt = JSON.parse(readFileSync(CLIP.replace(/\.mp4$/, '.json'), 'utf8')); } catch { /* optional */ }
const klicks = (beiblatt.klicks ?? []).filter((k) => k.t < BRETT_SEK)
  .map((k) => ({ t: brettAb + k.t, klang: k.art }));
const treffer = klicks.filter((k) => k.klang === 'match');

const eingaben = ['-i', sfx('bett'), '-i', sfx('outro')];
const spuren = [
  `[0:a]atrim=0:${dauer.toFixed(2)},volume=0.30,afade=t=in:st=0:d=1.2[bed]`,
  `[1:a]adelay=${ms(abspannAb)}|${ms(abspannAb)},volume=0.7[o]`,
];
const namen = ['[bed]', '[o]'];

// Ambiente der Filmszenen — aneinandergehaengt, damit der Film nicht stumm ist.
await lauf(['-y', '-i', join(TMP, 'a0.wav'), '-i', join(TMP, 'a1.wav'), '-i', join(TMP, 'a2.wav'),
  '-filter_complex', '[0:a][1:a][2:a]concat=n=3:v=0:a=1[a]', '-map', '[a]', join(TMP, 'ambiente.wav')]);
eingaben.push('-i', join(TMP, 'ambiente.wav'));
spuren.push(`[${namen.length}:a]atrim=0:${filmSek.toFixed(2)},volume=0.55,`
  + `afade=t=out:st=${(filmSek - 0.4).toFixed(2)}:d=0.4[amb]`);
namen.push('[amb]');

if (klicks.length) {
  const spur = join(TMP, 'spiel.wav');
  spurRendern(klicks.concat(melodie(treffer, null)), dauer + 1, spur);
  eingaben.push('-i', spur);
  spuren.push(`[${namen.length}:a]volume=1.0[spiel]`);
  namen.push('[spiel]');
  console.log(`  ${klicks.length} Steinklaenge + ${treffer.length} Toene`);
}

await lauf([
  '-y', ...eingaben,
  '-filter_complex',
  spuren.join(';') + ';'
  + `${namen.join('')}amix=inputs=${namen.length}:normalize=0:dropout_transition=0,`
  + `alimiter=limit=0.89:level=disabled,`
  + `afade=t=out:st=${Math.max(0, dauer - 1.4).toFixed(2)}:d=1.4[a]`,
  '-map', '[a]', '-t', dauer.toFixed(2), '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
  join(TMP, 'ton.m4a'),
]);

const ziel = join(OUT, `${NAME}.mp4`);
await lauf(['-y', '-i', join(TMP, 'stumm.mp4'), '-i', join(TMP, 'ton.m4a'),
  '-c:v', 'copy', '-c:a', 'copy', '-shortest', ziel]);

rmSync(TMP, { recursive: true, force: true });
const echt = await dauerVon(ziel);

// Beschreibung daneben — wie beim Reel, mit den drei Plattform-Fassungen.
writeFileSync(join(OUT, `${NAME}.txt`), captionText('spot', {
  datei: `${NAME}.mp4`, level: '-', paare: '-',
  spielSek: BRETT_SEK.toFixed(0), gesamtSek: echt.toFixed(0), fakt: null,
}));

console.log(`\n✓ ${ziel}  (${echt.toFixed(1)} s)`);
console.log(`✓ ${join(OUT, `${NAME}.txt`)}`);
console.log(`  Film ${filmSek.toFixed(1)} s → Brett ${BRETT_SEK} s → Abspann ${ABSPANN_SEK} s`);

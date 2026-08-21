#!/usr/bin/env node
// Das Figuren-Reel: „370 levels. No two boards alike."
//
//   node scripts/reel/record-figuren.mjs     # Bretter aufnehmen (Preview-Server)
//   node scripts/reel/reel-figuren.mjs       # Zusammenbau
//
// Warum es dieses Format gibt: Der Kanal zeigt Runden. Was er nie zeigt, ist
// der UMFANG — und der ist die staerkste unerzaehlte Zahl der App. Der
// Generator kennt 1392 Figuren, 370 davon werden zu Leveln, und jedes Level
// traegt eine ANDERE. Das laesst sich nicht behaupten, das muss man sehen.
//
// ⚠ Das hier ist mit Absicht eine Diashow, und das ist NICHT derselbe Fehler
// wie bei Match-3 im Modi-Reel. Dort war die Standbildfolge ein Versehen: Der
// Modus animiert nicht, also sprang das Bild je Zug und wirkte kaputt. Hier
// ist der Takt die Form — man VERGLEICHT Silhouetten, und dafuer braucht es
// ruhige Bilder und harte Schnitte. Eine Ueberblendung wuerde die Formen
// ineinanderwaschen und genau die Aussage zerstoeren.

import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lauf, dauerVon } from './ffmpeg.mjs';
import { mitBrowser, abspannKarte, B, H } from './karten.mjs';
import { spurRendern } from './synth.mjs';
import { captionText } from './formate.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');
const ASSETS = join(HIER, 'assets');
const FPS = 30;

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const QUELLE = join(WURZEL, arg('quelle', 'out/reels/figuren'));
const OUT = join(WURZEL, arg('out', 'out/reels'));
const NAME = arg('name', 'mahjong-figuren-EN');
const TMP = join(OUT, '.figuren');

// Das Tempo zieht an: Das erste Brett steht lange genug, um die Form zu
// lesen, danach reicht ein Blick, weil das Auge das Muster kennt.
const ERST_SEK = 0.58;
const LETZT_SEK = 0.26;
const HOOK_SEK = 1.8;
const KARTE_SEK = 2.4;
const BLENDE = 0.4;          // nur Hook→Montage und Montage→Karte
const ABSPANN_SEK = 3.0;
const BLENDE_ENDE = 0.5;

/**
 * Die Zahl fuer den Text — GERECHNET, nicht getippt.
 *
 * ⚠ „370 levels" ist eine Behauptung ueber das Produkt, und sie steht in der
 * Hook-Karte, der Schlusskarte und der Caption. Eine getippte Zahl waere nach
 * der naechsten Aenderung an LEVEL_MIN_TILES oder LEVEL_STEP in figures.ts
 * still falsch — an drei Stellen gleichzeitig. Deshalb wird sie aus dem
 * Generator geholt und der Lauf bricht ab, wenn das nicht geht.
 */
function levelZahl() {
  try {
    const roh = execFileSync('npx', ['tsx', '-e',
      "import{levelFigures}from'./src/game/figures.ts';console.log(levelFigures().length)"],
    { cwd: WURZEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const n = Number(String(roh).trim().split('\n').pop());
    if (!Number.isInteger(n) || n < 10) throw new Error(`unplausibel: ${roh}`);
    return n;
  } catch (e) {
    throw new Error(`Levelzahl nicht aus figures.ts lesbar — ${e.message.split('\n')[0]}`);
  }
}

const zettel = join(QUELLE, 'figuren.json');
if (!existsSync(zettel)) {
  console.error(`✗ Aufnahmen fehlen: ${zettel}`);
  console.error('  Erst: node scripts/reel/record-figuren.mjs  (Preview-Server muss laufen)');
  process.exit(1);
}
const BRETTER = JSON.parse(readFileSync(zettel, 'utf8'));
if (BRETTER.length < 8) {
  console.error(`✗ nur ${BRETTER.length} Bretter — zu wenig fuer eine Montage`);
  process.exit(1);
}

const LEVEL_GESAMT = levelZahl();
console.log(`${BRETTER.length} Bretter, ${LEVEL_GESAMT} Level laut figures.ts`);

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

// --- Karten -----------------------------------------------------------------
console.log('Karten rendern …');
const grund = `<div style="position:absolute;inset:0;
  background:linear-gradient(160deg,#123f2e,#0b2a1e 60%,#06201a)"></div>`;

await mitBrowser(async (schuss) => {
  await abspannKarte(schuss, join(TMP, 'abspann.png'));

  await schuss(`${grund}
    <div class="mitte" style="top:800px;font-size:120px;font-weight:800;line-height:1.04">
      ${LEVEL_GESAMT}<br>levels.</div>
    <div class="mitte" style="top:1090px;font-size:44px;font-weight:600;color:#ffd76a">
      No two boards alike. 🀄</div>`,
  join(TMP, 'hook.png'), { width: B, height: H });

  await schuss(`${grund}
    <div class="mitte" style="top:790px;font-size:104px;font-weight:800;line-height:1.06">
      ${LEVEL_GESAMT} levels.<br>${LEVEL_GESAMT} boards.</div>
    <div class="mitte" style="top:1120px;font-size:42px;font-weight:600;color:#ffd76a;line-height:1.3">
      Not one of them repeats.</div>`,
  join(TMP, 'karte.png'), { width: B, height: H });

  // Die Levelzahl je Brett. ⚠ Als eigenes PNG und nicht per `drawtext` — den
  // Filter kennt der ffmpeg-static-Build nicht.
  //
  // Unten, wo bei jedem Brett Platz ist: Die Figuren sind unterschiedlich
  // hoch, aber die Bedienleiste sitzt immer gleich, und darueber ist Luft.
  for (const b of BRETTER) {
    await schuss(
      `<div style="position:absolute;left:0;top:1560px;width:${B}px;height:130px;
                   display:flex;align-items:center;justify-content:center">
         <div style="padding:16px 44px;border-radius:999px;
                     background:rgba(6,32,26,.86);border:2px solid rgba(245,179,1,.55);
                     font-size:44px;font-weight:800;letter-spacing:.06em">
           LEVEL ${b.level}</div>
       </div>`,
      join(TMP, `n${b.level}.png`), { width: B, height: H });
  }
});

// --- Montage ----------------------------------------------------------------
// ⚠ Harte Schnitte per concat, KEIN xfade. Die Aussage ist „jedes Brett ist
// anders" — eine Ueberblendung waescht zwei Formen ineinander und macht aus
// dem Vergleich einen Uebergang.
console.log('Montage schneiden …');
const dauern = BRETTER.map((_, i) =>
  ERST_SEK + (LETZT_SEK - ERST_SEK) * (i / Math.max(1, BRETTER.length - 1)));

for (const [i, b] of BRETTER.entries()) {
  await lauf([
    '-y', '-loop', '1', '-t', dauern[i].toFixed(3), '-i', b.datei,
    '-loop', '1', '-t', dauern[i].toFixed(3), '-i', join(TMP, `n${b.level}.png`),
    '-filter_complex',
    `[0:v]scale=${B}:${H}:force_original_aspect_ratio=increase,crop=${B}:${H},fps=${FPS}[g];`
    + `[g][1:v]overlay=0:0,format=yuv420p[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    join(TMP, `m${String(i).padStart(2, '0')}.mp4`),
  ]);
}
const liste = join(TMP, 'liste.txt');
writeFileSync(liste, BRETTER.map((_, i) =>
  `file '${join(TMP, `m${String(i).padStart(2, '0')}.mp4`)}'`).join('\n') + '\n');
await lauf(['-y', '-f', 'concat', '-safe', '0', '-i', liste,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', join(TMP, 'montage.mp4')]);
const montageSek = await dauerVon(join(TMP, 'montage.mp4'));

for (const [name, sek] of [['hook', HOOK_SEK], ['karte', KARTE_SEK], ['abspann', ABSPANN_SEK]]) {
  await lauf(['-y', '-loop', '1', '-t', String(sek), '-i', join(TMP, `${name}.png`),
    '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    join(TMP, `${name}.mp4`)]);
}

// --- Kette ------------------------------------------------------------------
// ⚠ `settb=AVTB` auf allen xfade-Eingaengen (sonst „do not match … Failed to
// configure output pad").
console.log('Zusammensetzen …');
const TEILE = [
  { datei: join(TMP, 'hook.mp4'), sek: HOOK_SEK },
  { datei: join(TMP, 'montage.mp4'), sek: montageSek },
  { datei: join(TMP, 'karte.mp4'), sek: KARTE_SEK },
  { datei: join(TMP, 'abspann.mp4'), sek: ABSPANN_SEK },
];
const UEBERGAENGE = [
  { blende: 'fade', sek: BLENDE },
  { blende: 'fade', sek: BLENDE },
  { blende: 'fadeblack', sek: BLENDE_ENDE },
];

const ketten = TEILE.map((_, i) => `[${i}:v]settb=AVTB[k${i}]`);
let vorn = '[k0]';
let versatz = TEILE[0].sek - UEBERGAENGE[0].sek;
let karteAb = 0, abspannAb = 0;
for (let i = 0; i < UEBERGAENGE.length; i++) {
  const u = UEBERGAENGE[i];
  const letzter = i === UEBERGAENGE.length - 1;
  if (i === 1) karteAb = versatz;
  if (letzter) abspannAb = versatz;
  ketten.push(`${vorn}[k${i + 1}]xfade=transition=${u.blende}:duration=${u.sek}`
    + `:offset=${versatz.toFixed(3)}[${letzter ? 'vv' : `c${i}`}]`);
  vorn = `[${letzter ? 'vv' : `c${i}`}]`;
  if (!letzter) versatz += TEILE[i + 1].sek - UEBERGAENGE[i + 1].sek;
}
ketten.push(`[vv]fps=${FPS},format=yuv420p[v]`);
const dauer = abspannAb + ABSPANN_SEK;

await lauf(['-y', ...TEILE.flatMap((t) => ['-i', t.datei]),
  '-filter_complex', ketten.join(';'),
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'stumm.mp4')]);

// --- Ton --------------------------------------------------------------------
// Ein Steinklang auf JEDEM Brettwechsel. Der Rhythmus zieht mit den Bildern
// an, ohne dass am Ton etwas gerechnet werden muss — die Schnittzeiten sind
// dieselben wie im Bild.
console.log('Ton mischen …');
const sfx = (n) => join(ASSETS, 'sfx', `${n}.aac`);
const ms = (s) => Math.round(Math.max(0, s) * 1000);

const montageAb = HOOK_SEK - BLENDE;
let t = montageAb;
const klaenge = [];
for (const d of dauern) { klaenge.push({ t, klang: 'tap' }); t += d; }
klaenge.push({ t: karteAb + BLENDE / 2, klang: 'match', vol: 1.1 });
klaenge.push({ t: abspannAb + BLENDE_ENDE / 2, klang: 'win', vol: 1.15 });
const spur = join(TMP, 'takt.wav');
spurRendern(klaenge, dauer + 1, spur);

await lauf([
  '-y', '-i', sfx('bett'), '-i', sfx('outro'), '-i', spur,
  '-filter_complex',
  `[0:a]atrim=0:${dauer.toFixed(2)},volume=0.34,afade=t=in:st=0:d=0.8[bed];`
  + `[1:a]adelay=${ms(abspannAb)}|${ms(abspannAb)},volume=0.7[o];`
  + `[2:a]volume=1.1[takt];`
  + `[bed][o][takt]amix=inputs=3:normalize=0:dropout_transition=0,`
  + `alimiter=limit=0.89:level=disabled,`
  + `afade=t=out:st=${Math.max(0, dauer - 1.4).toFixed(2)}:d=1.4[a]`,
  '-map', '[a]', '-t', dauer.toFixed(2), '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
  join(TMP, 'ton.m4a'),
]);

const ziel = join(OUT, `${NAME}.mp4`);
await lauf(['-y', '-i', join(TMP, 'stumm.mp4'), '-i', join(TMP, 'ton.m4a'),
  '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', ziel]);
rmSync(TMP, { recursive: true, force: true });
const echt = await dauerVon(ziel);

writeFileSync(join(OUT, `${NAME}.txt`), captionText('figuren', {
  datei: `${NAME}.mp4`, level: LEVEL_GESAMT, paare: '-',
  spielSek: montageSek.toFixed(0), gesamtSek: echt.toFixed(0), fakt: null,
  ki: false,                    // reine Bildschirmaufnahme, kein Vorspann
}));

console.log(`\n✓ ${ziel}  (${echt.toFixed(1)} s)`);
console.log(`✓ ${join(OUT, `${NAME}.txt`)}`);
console.log(`  ${BRETTER.length} Bretter, ${dauern[0].toFixed(2)} s → ${dauern[dauern.length - 1].toFixed(2)} s`);

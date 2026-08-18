#!/usr/bin/env node
// Der Domino-Spot: eine Kettenreaktion aus echten Steinen muendet in die
// Schlussrampe des Spiels.
//
//   node scripts/reel/spot-domino.mjs
//
// Aufbau: Anstoss → Sturz → Stufe → Finale (kie.ai-Clips, assets/domino/)
// → Match-Cut → Endrampe von Level 125 + Sieg-Zeremonie → Abspann.
//
// ⚠ Das Ende sollte urspruenglich die BOMBE sein. In keiner der vier
// Bomben-Aufnahmen hat sie aber gezuendet (nachgeprueft: ueberall exakt so
// viele Match-Klicks wie Paare — eine Zuendung haette Paare mitgeraeumt und
// die Klickzahl gesenkt). Stattdessen traegt die Endrampe von Level 125 das
// Finale: Die letzten Paare loesen sich im 0,40-s-Takt, wie Dominosteine.
// Das ist die Metapher des Spots — die Kettenreaktion IST das Spiel.
//
// ⚠ Die Schnitte zwischen den Filmclips sind FAST HART (0,15 s), mitten in
// der Bewegung. Das traegt, weil die Welle in allen Clips in dieselbe
// Richtung laeuft (match on action) — das Rezept aus spot.mjs, wo eine lange
// Blende zwischen aehnlichen Bildern wie ein Morph wirkte.

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
const CLIP = join(WURZEL, arg('clip', 'out/reels/roh/mahjong-solitaire-lvl125-en.mp4'));
const OUT = join(WURZEL, arg('out', 'out/reels'));
const NAME = arg('name', 'mahjong-domino-EN');
const TMP = join(OUT, '.domino');

// Die Filmclips in Erzaehlreihenfolge, Schnittpunkte an Einzelbildern und
// Bewegungskurven ausgemessen (messe-vorspann.mjs + Kontaktbogen je Clip).
//
// ⚠ `anstoss` MUSS bei ~3,6 s enden: Veo laesst die Kette danach stocken —
// die Welle stirbt, die Reihe bleibt stehen. Der Schnitt sitzt mitten im
// Fallen der ersten Steine, bevor das zu sehen ist. Wer den Ausschnitt
// verlaengert, holt den Stillstand ins Video.
const SZENEN = [
  { datei: 'domino-anstoss.mp4', ab: 0.6, sek: 3.0 },  // Finger kippt den ersten Stein
  { datei: 'domino-lauf.mp4', ab: 0.4, sek: 2.6 },     // Steine stuerzen vor der Laterne
  { datei: 'domino-stufe.mp4', ab: 1.3, sek: 2.6 },    // die Reihe kippt nach vorn
  { datei: 'domino-finale.mp4', ab: 3.3, sek: 3.7 },   // Kaskade ueber die Kante, endet still
];
const BLENDEN = [0.15, 0.15, 0.3];   // fast harte Schnitte, letzter etwas weicher

// Der App-Teil: NICHT der Anfang der Aufnahme, sondern die Endrampe.
// Level 125 raeumt die letzten Paare im 0,40-s-Takt — schneller als jede
// andere Aufnahme mit Sieg-Zeremonie. `SPIEL_AB` ist der Einstiegspunkt.
const SPIEL_AB = 10.4;
const SPIEL_MAX = 7.6;               // Rampe (~5 s) + Zeremonie (~2,6 s)

// Match-Cut-Werte aus spot.mjs — dort an Einzelbildern ausgemessen.
const BRETT_ZOOM = 1.57;             // 1920/1224 — Brett fuellt das Bild
const AUSZOOM_SEK = 1.3;
const BLENDE_MATCH = 0.6;
const BLENDE_ENDE = 0.5;
const ABSPANN_SEK = 3.0;

for (const s of SZENEN) {
  if (!existsSync(join(ASSETS, 'domino', s.datei))) {
    console.error(`✗ Filmclip fehlt: ${s.datei}\n  Erst: node scripts/reel/kie-clip.mjs --satz domino --los`);
    process.exit(1);
  }
}
if (!existsSync(CLIP)) { console.error(`✗ Gameplay-Aufnahme fehlt: ${CLIP}`); process.exit(1); }

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

console.log('Karten rendern …');
await mitBrowser(async (schuss) => {
  await abspannKarte(schuss, join(TMP, 'abspann.png'));
});

// --- Filmteil ---------------------------------------------------------------
// Jede Szene einzeln auf 1080×1920/30fps bringen (Veo liefert 720×1280/24),
// dann verketten. Ton getrennt — das Klackern der Steine ist der Reiz des
// Spots und kommt aus den Clips selbst, nicht aus dem Synth.
console.log('Filmclips schneiden …');
for (const [i, s] of SZENEN.entries()) {
  await lauf([
    '-y', '-ss', String(s.ab), '-t', String(s.sek), '-i', join(ASSETS, 'domino', s.datei),
    '-vf', `scale=${B}:${H}:force_original_aspect_ratio=increase,crop=${B}:${H},fps=${FPS},format=yuv420p`,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', join(TMP, `f${i}.mp4`),
  ]);
  try {
    await lauf(['-y', '-ss', String(s.ab), '-t', String(s.sek), '-i', join(ASSETS, 'domino', s.datei),
      '-vn', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', join(TMP, `a${i}.wav`)]);
  } catch {
    await lauf(['-y', '-f', 'lavfi', '-t', String(s.sek),
      '-i', 'anullsrc=r=48000:cl=stereo', join(TMP, `a${i}.wav`)]);
  }
}

const filmSek = SZENEN.reduce((a, s) => a + s.sek, 0) - BLENDEN.reduce((a, b) => a + b, 0);
const v1 = SZENEN[0].sek - BLENDEN[0];
const v2 = v1 + SZENEN[1].sek - BLENDEN[1];
const v3 = v2 + SZENEN[2].sek - BLENDEN[2];

await lauf([
  '-y', '-i', join(TMP, 'f0.mp4'), '-i', join(TMP, 'f1.mp4'),
  '-i', join(TMP, 'f2.mp4'), '-i', join(TMP, 'f3.mp4'),
  '-filter_complex',
  // ⚠ settb=AVTB auf allen Seiten, sonst lehnt xfade die Zeitbasen ab.
  `[0:v]settb=AVTB[s0];[1:v]settb=AVTB[s1];[2:v]settb=AVTB[s2];[3:v]settb=AVTB[s3];`
  + `[s0][s1]xfade=transition=fade:duration=${BLENDEN[0]}:offset=${v1.toFixed(3)}[a];`
  + `[a][s2]xfade=transition=fade:duration=${BLENDEN[1]}:offset=${v2.toFixed(3)}[b];`
  + `[b][s3]xfade=transition=fade:duration=${BLENDEN[2]}:offset=${v3.toFixed(3)},fps=${FPS}[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  '-pix_fmt', 'yuv420p', join(TMP, 'film.mp4'),
]);

// --- App-Teil: die Endrampe -------------------------------------------------
console.log('Endrampe schneiden …');
const rohDauer = await dauerVon(CLIP);
const spielSek = Math.min(SPIEL_MAX, rohDauer - SPIEL_AB);
const auszoomBilder = Math.round(AUSZOOM_SEK * FPS);
await lauf([
  '-y', '-ss', String(SPIEL_AB), '-t', String(spielSek), '-i', CLIP,
  '-vf',
  // Beginnt formatfuellend auf dem Brett (zweite Haelfte des Match-Cuts)
  // und zieht auf das ganze Geraet zurueck.
  `scale=${B}:${H},fps=${FPS},`
  + `zoompan=z='max(1,${BRETT_ZOOM}-${(BRETT_ZOOM - 1).toFixed(3)}*min(1,on/${auszoomBilder}))'`
  + `:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=${B}x${H}:fps=${FPS},format=yuv420p`,
  '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'spiel.mp4'),
]);

await lauf([
  '-y', '-loop', '1', '-t', String(ABSPANN_SEK), '-i', join(TMP, 'abspann.png'),
  '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'abspann.mp4'),
]);

// --- Zusammensetzen ---------------------------------------------------------
console.log('Zusammensetzen …');
const spielAb = filmSek - BLENDE_MATCH;
const abspannAb = spielAb + spielSek - BLENDE_ENDE;
const dauer = abspannAb + ABSPANN_SEK;

await lauf([
  '-y', '-i', join(TMP, 'film.mp4'), '-i', join(TMP, 'spiel.mp4'), '-i', join(TMP, 'abspann.mp4'),
  '-filter_complex',
  `[0:v]settb=AVTB[f];[1:v]settb=AVTB[b];[2:v]settb=AVTB[ab];`
  + `[f][b]xfade=transition=fade:duration=${BLENDE_MATCH}:offset=${spielAb.toFixed(3)}[fb];`
  + `[fb][ab]xfade=transition=fadeblack:duration=${BLENDE_ENDE}:offset=${abspannAb.toFixed(3)},`
  + `fps=${FPS},format=yuv420p[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'stumm.mp4'),
]);

// --- Ton --------------------------------------------------------------------
console.log('Ton mischen …');
const sfx = (n) => join(ASSETS, 'sfx', `${n}.aac`);
const ms = (s) => Math.round(Math.max(0, s) * 1000);

// ⚠ Die Klickzeiten des Beipackzettels sind relativ zum AUFNAHMEBEGINN.
// Der Spot springt mit SPIEL_AB in die Aufnahme — jeder Klick muss also um
// SPIEL_AB zurueck und um spielAb (Beginn des App-Teils im Spot) vor.
let beiblatt = {};
try { beiblatt = JSON.parse(readFileSync(CLIP.replace(/\.mp4$/, '.json'), 'utf8')); } catch { /* optional */ }
const klicks = (beiblatt.klicks ?? [])
  .filter((k) => k.t >= SPIEL_AB && k.t < SPIEL_AB + spielSek)
  .map((k) => ({ t: spielAb + (k.t - SPIEL_AB), klang: k.art }));
const treffer = klicks.filter((k) => k.klang === 'match');
if (beiblatt.siegBei != null && beiblatt.siegBei >= SPIEL_AB) {
  klicks.push({ t: spielAb + (beiblatt.siegBei - SPIEL_AB), klang: 'win', vol: 1.25 });
}

const eingaben = ['-i', sfx('bett'), '-i', sfx('outro')];
const spuren = [
  `[0:a]atrim=0:${dauer.toFixed(2)},volume=0.28,afade=t=in:st=0:d=1.0[bed]`,
  `[1:a]adelay=${ms(abspannAb)}|${ms(abspannAb)},volume=0.7[o]`,
];
const namen = ['[bed]', '[o]'];

// Das Klackern der fallenden Steine, aneinandergehaengt. Lauter als beim
// Sensei-Spot (0,9 statt 0,55) — hier IST es der Inhalt, nicht Ambiente.
await lauf(['-y', '-i', join(TMP, 'a0.wav'), '-i', join(TMP, 'a1.wav'),
  '-i', join(TMP, 'a2.wav'), '-i', join(TMP, 'a3.wav'),
  '-filter_complex', '[0:a][1:a][2:a][3:a]concat=n=4:v=0:a=1[a]', '-map', '[a]', join(TMP, 'klackern.wav')]);
eingaben.push('-i', join(TMP, 'klackern.wav'));
spuren.push(`[${namen.length}:a]atrim=0:${filmSek.toFixed(2)},volume=0.9,`
  + `afade=t=out:st=${(filmSek - 0.5).toFixed(2)}:d=0.5[klack]`);
namen.push('[klack]');

if (klicks.length) {
  const spur = join(TMP, 'spiel.wav');
  spurRendern(klicks.concat(melodie(treffer,
    beiblatt.siegBei != null ? spielAb + (beiblatt.siegBei - SPIEL_AB) : null)), dauer + 1, spur);
  eingaben.push('-i', spur);
  spuren.push(`[${namen.length}:a]volume=1.0[spiel]`);
  namen.push('[spiel]');
  console.log(`  ${klicks.length} Steinklaenge, ${treffer.length} Toene`);
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
  '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', ziel]);

rmSync(TMP, { recursive: true, force: true });
const echt = await dauerVon(ziel);

writeFileSync(join(OUT, `${NAME}.txt`), captionText('domino', {
  datei: `${NAME}.mp4`, level: beiblatt.level ?? '-', paare: beiblatt.paare ?? '-',
  spielSek: spielSek.toFixed(0), gesamtSek: echt.toFixed(0), fakt: null,
}));

console.log(`\n✓ ${ziel}  (${echt.toFixed(1)} s)`);
console.log(`✓ ${join(OUT, `${NAME}.txt`)}`);
console.log(`  Film ${filmSek.toFixed(1)} s → Endrampe ${spielSek.toFixed(1)} s → Abspann ${ABSPANN_SEK} s`);

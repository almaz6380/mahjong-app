#!/usr/bin/env node
// Das Modi-Reel: sechs Spiele in unter zwanzig Sekunden.
//
//   node scripts/reel/record-modi.mjs      # Aufnahmen (braucht Preview-Server)
//   node scripts/reel/reel-modi.mjs        # Zusammenbau
//
// Warum es dieses Format gibt: Der Kanal zeigte zwanzig Beitraege lang EIN
// Spiel. Die App hat Connect, Riichi und sieben Bonus-Spiele — das wusste
// kein Zuschauer. Dieses Reel ist das erste, das etwas ueber das PRODUKT
// erzaehlt statt eine weitere Runde zu zeigen.

import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
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
const QUELLE = join(WURZEL, arg('quelle', 'out/reels/modi'));
const OUT = join(WURZEL, arg('out', 'out/reels'));
const NAME = arg('name', 'mahjong-modi-EN');
const TMP = join(OUT, '.modi');

// Die Reihenfolge ist Dramaturgie, keine Liste:
// Solitaire zuerst (das kennt man vom Kanal), dann je etwas offensichtlich
// ANDERES — gruene Kartenruecken, eine gezeichnete Linie, eine drehende
// 3D-Szene, ein Tisch mit vier Spielern — und zum Schluss der Countdown als
// Drucksteigerung.
//
// ⚠ DAS AUSWAHLKRITERIUM IST OPTISCHE VERSCHIEDENHEIT, NICHT BELIEBTHEIT.
// Die erste Fassung hatte Connect UND Match-3 drin; beide sind ein dichtes,
// flaches Raster aus denselben Steinen und lasen sich nebeneinander als
// dasselbe Spiel zweimal — genau der Eindruck, den dieses Reel widerlegen
// soll. Match-3 ist deshalb raus und Memory dafuer rein: verdeckte gruene
// Ruecken, die sich aufdrehen, sind auf einen Blick etwas anderes.
// Blitz und Solitaire teilen sich zwar die Brett-Oberflaeche, stehen aber
// weit auseinander und Blitz traegt den Countdown-Balken oben quer.
//
// `ab`/`sek` schneiden den bewegtesten Abschnitt heraus. `ab` ist NICHT
// geraten, sondern gemessen (Bildaenderung je Zehntel, bestes Fenster der
// gewuenschten Laenge) — von Hand gesetzte Werte lagen bei der Haelfte der
// Modi neben der eigentlichen Bewegung. Die Laengen NEHMEN AB: 3,4 → 2,2 s.
// Dadurch zieht das Reel an, ohne dass ein Schnitt beschleunigt werden muss.
//
// `blende` setzt die Bewegung des Segments fort — dieselbe Regel wie bei den
// Vorspaennen (vorspaenne.mjs). Hier duerfen die Uebergaenge kraeftiger sein
// als dort: Zwischen zwei App-Bildschirmen ist ein harter Effekt die Sprache
// des Formats, waehrend er zwischen Film und App wie eine Praesentationsfolie
// wirkte.
//
// Dimensions 3D steht bewusst in der Mitte: Es ist mit Abstand der bewegteste
// Modus (gemessen Ø5,99 Bildaenderung gegen 0,3–0,8 bei allen anderen, jedes
// einzelne Bild in Bewegung), weil sich seine Szene wirklich dreht statt nur
// den Zustand zu wechseln. So etwas gehoert dorthin, wo die Aufmerksamkeit
// sonst nachliesse, nicht an den Anfang.
const SEGMENTE = [
  { datei: 'solitaire.mp4', titel: 'Solitaire', ab: 0.2, sek: 3.4, blende: 'smoothup' },
  { datei: 'memory.mp4', titel: 'Memory', ab: 1.9, sek: 3.0, blende: 'smoothright' },
  { datei: 'connect.mp4', titel: 'Connect', ab: 3.3, sek: 2.8, blende: 'circleopen' },
  { datei: 'dimensions.mp4', titel: '3D Dimensions', ab: 0.5, sek: 2.6, blende: 'smoothleft' },
  { datei: 'riichi.mp4', titel: 'Riichi', ab: 1.2, sek: 2.4, blende: 'slideleft' },
  { datei: 'blitz.mp4', titel: 'Time Blitz', ab: 2.0, sek: 2.2, blende: 'fadeblack' },
];
const BLENDE = 0.28;          // kurz — das Format lebt vom Tempo
const HOOK_SEK = 1.6;
const ABSPANN_SEK = 3.0;
const BLENDE_ENDE = 0.5;

const fehlend = SEGMENTE.filter((s) => !existsSync(join(QUELLE, s.datei)));
if (fehlend.length) {
  console.error(`✗ Aufnahmen fehlen: ${fehlend.map((s) => s.datei).join(', ')}`);
  console.error('  Erst: node scripts/reel/record-modi.mjs  (Preview-Server muss laufen)');
  process.exit(1);
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

// --- Karten -----------------------------------------------------------------
console.log('Karten rendern …');
await mitBrowser(async (schuss) => {
  await abspannKarte(schuss, join(TMP, 'abspann.png'));

  // Eingangskarte: das Versprechen des Reels in einer Zeile.
  await schuss(
    `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#123f2e,#0b2a1e 60%,#06201a)"></div>
     <div class="mitte" style="top:780px;font-size:104px;font-weight:800;line-height:1.06">
       Six games.<br>One app.</div>
     <div class="mitte" style="top:1080px;font-size:40px;font-weight:600;color:#ffd76a">
       Which one would you play? 👀</div>`,
    join(TMP, 'hook.png'), { width: B, height: H });

  // Namensschilder, als Bauchbinde ueber dem unteren Drittel des SPIELFELDS.
  //
  // ⚠ NICHT auf die Bedienleiste legen. Zuerst sassen sie bei y=1560, also
  // genau zwischen Brett und Knoepfen — das geht nur so lange gut, wie alle
  // Modi dieselbe Leiste haben. Connect und Dimensions haben ZWEI Knopfreihen,
  // dort landete das Schild mitten in „Hint · 40 … Shuffle · 60" und sah nach
  // einem Darstellungsfehler aus. Eine feste Hoehe kann es keiner Leiste recht
  // machen; ueber dem Brett dagegen liest sich dieselbe Binde als Beschriftung.
  // ⚠ Kein `drawtext`: Der ffmpeg-static-Build kennt den Filter nicht.
  for (const s of SEGMENTE) {
    await schuss(
      `<div style="position:absolute;left:0;top:1330px;width:${B}px;height:150px;
                   display:flex;align-items:center;justify-content:center">
         <div style="padding:20px 46px;border-radius:999px;
                     background:rgba(6,32,26,.86);border:2px solid rgba(245,179,1,.55);
                     font-size:46px;font-weight:700;letter-spacing:.01em">${s.titel}</div>
       </div>`,
      join(TMP, `t-${s.titel.replace(/\W/g, '')}.png`), { width: B, height: H });
  }
});

// --- Segmente ---------------------------------------------------------------
console.log('Segmente schneiden …');
for (const [i, s] of SEGMENTE.entries()) {
  const schild = join(TMP, `t-${s.titel.replace(/\W/g, '')}.png`);
  await lauf([
    '-y', '-ss', String(s.ab), '-t', String(s.sek), '-i', join(QUELLE, s.datei),
    '-loop', '1', '-t', String(s.sek), '-i', schild,
    '-filter_complex',
    `[0:v]scale=${B}:${H}:force_original_aspect_ratio=increase,crop=${B}:${H},fps=${FPS}[g];`
    // Das Schild kommt kurz nach dem Schnitt — erst sieht man das Spiel,
    // dann erfaehrt man, wie es heisst. Andersherum liest man den Namen und
    // verpasst die Bewegung.
    + `[1:v]format=rgba,fade=t=in:st=0.35:d=0.25:alpha=1[s];`
    + `[g][s]overlay=0:0,format=yuv420p[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    join(TMP, `s${i}.mp4`),
  ]);
}

await lauf(['-y', '-loop', '1', '-t', String(HOOK_SEK), '-i', join(TMP, 'hook.png'),
  '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'hook.mp4')]);
await lauf(['-y', '-loop', '1', '-t', String(ABSPANN_SEK), '-i', join(TMP, 'abspann.png'),
  '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'abspann.mp4')]);

// --- Kette ------------------------------------------------------------------
// ⚠ `settb=AVTB` auf ALLEN Eingaengen: die Quellen bringen verschiedene
// Zeitbasen mit, und xfade lehnt das mit „do not match … Failed to configure
// output pad" ab — eine Meldung, die den Filter nennt, nicht die Ursache.
console.log('Zusammensetzen …');
const eingaben = ['-i', join(TMP, 'hook.mp4')];
SEGMENTE.forEach((_, i) => eingaben.push('-i', join(TMP, `s${i}.mp4`)));
eingaben.push('-i', join(TMP, 'abspann.mp4'));

const ketten = [];
const n = SEGMENTE.length + 2;                     // Hook + Segmente + Abspann
for (let i = 0; i < n; i++) ketten.push(`[${i}:v]settb=AVTB[k${i}]`);

// Schnittzeiten mitschreiben — der Ton braucht sie fuer die Whooshes.
const schnitte = [];
let vorn = '[k0]';
let versatz = HOOK_SEK - BLENDE;
for (let i = 0; i < SEGMENTE.length; i++) {
  schnitte.push(versatz);
  const aus = i === SEGMENTE.length - 1 ? 'vv' : `c${i}`;
  const blende = i === 0 ? 'fade' : SEGMENTE[i - 1].blende;   // Uebergang GEHOERT zum Vorgaenger
  ketten.push(`${vorn}[k${i + 1}]xfade=transition=${blende}:duration=${BLENDE}`
    + `:offset=${versatz.toFixed(3)}[${aus}]`);
  vorn = `[${aus}]`;
  versatz += SEGMENTE[i].sek - BLENDE;
}
const abspannAb = versatz;
ketten.push(`${vorn}[k${n - 1}]xfade=transition=${SEGMENTE[SEGMENTE.length - 1].blende}`
  + `:duration=${BLENDE_ENDE}:offset=${abspannAb.toFixed(3)},fps=${FPS},format=yuv420p[v]`);
const dauer = abspannAb + ABSPANN_SEK;

await lauf(['-y', ...eingaben, '-filter_complex', ketten.join(';'),
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'stumm.mp4')]);

// --- Ton --------------------------------------------------------------------
// ⚠ KEINE nachgebauten Spielklaenge. Fuenf der sechs Modi haben keinen
// Beipackzettel mit Klickzeiten — erfundene Klaenge liefen gegen das Bild,
// und genau das faellt auf. Stattdessen: Teppich + ein Steinklang auf JEDEM
// SCHNITT. Der Rhythmus der Schnitte wird damit hoerbar, und weil die
// Segmente kuerzer werden, zieht auch der Ton an.
console.log('Ton mischen …');
const sfx = (n2) => join(ASSETS, 'sfx', `${n2}.aac`);
const ms = (s) => Math.round(Math.max(0, s) * 1000);

const takt = schnitte.map((t) => ({ t: t + BLENDE / 2, klang: 'match' }))
  .concat([{ t: abspannAb + BLENDE_ENDE / 2, klang: 'win', vol: 1.15 }]);
const taktSpur = join(TMP, 'takt.wav');
spurRendern(takt, dauer + 1, taktSpur);

await lauf([
  '-y', '-i', sfx('bett'), '-i', sfx('whoosh'), '-i', sfx('outro'), '-i', taktSpur,
  '-filter_complex',
  `[0:a]atrim=0:${dauer.toFixed(2)},volume=0.34,afade=t=in:st=0:d=0.8[bed];`
  + `[1:a]adelay=100|100,volume=0.5[w];`
  + `[2:a]adelay=${ms(abspannAb)}|${ms(abspannAb)},volume=0.7[o];`
  + `[3:a]volume=1.1[takt];`
  + `[bed][w][o][takt]amix=inputs=4:normalize=0:dropout_transition=0,`
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

writeFileSync(join(OUT, `${NAME}.txt`), captionText('modi', {
  datei: `${NAME}.mp4`, level: '-', paare: '-',
  spielSek: SEGMENTE.reduce((a, s) => a + s.sek, 0).toFixed(0),
  gesamtSek: echt.toFixed(0), fakt: null,
}));

console.log(`\n✓ ${ziel}  (${echt.toFixed(1)} s)`);
console.log(`✓ ${join(OUT, `${NAME}.txt`)}`);
console.log('  ' + SEGMENTE.map((s) => `${s.titel} ${s.sek}s`).join(' → '));

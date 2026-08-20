#!/usr/bin/env node
// Das Rueckwaerts-Reel: Ein leeres Brett — und die Steine fliegen ZURUECK,
// Paar fuer Paar, bis die volle Figur steht. Die Pointe ist wahr:
// Jedes Brett wird rueckwaerts konstruiert, deshalb ist es immer loesbar
// (engine.ts, generateBoardWithPairs).
//
//   node scripts/reel/reel-rueckwaerts.mjs [--clip out/reels/roh/…] [--name …]
//
// Kostet nichts — reine Nachverarbeitung einer vorhandenen Aufnahme.
//
// Dramaturgie, die die Umkehr gratis mitbringt: Die Tempo-Rampe der Aufnahme
// beschleunigt (0,8 s → 0,3 s je Zug). Rueckwaerts DEZELERIERT das Reel —
// es beginnt hektisch und kommt zur Ruhe, genau wenn die Faktenkarte steht.
//
// ⚠ BEWUSST OHNE die eingeblendete Handy-Statusleiste. Das ist zugleich der
// TikTok-Test: Der Verdacht steht, dass die nachgebaute iOS-Leiste dort als
// abgefilmter Fremdinhalt eingestuft wird (0 Aufrufe). Dieses Reel ist das
// Gegenexperiment — nicht "vergessen", nicht nachruesten.

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
const NAME = arg('name', 'mahjong-rueckwaerts-EN');
const TMP = join(OUT, '.rueck');

const HALT_SEK = 3.2;       // Standzeit des vollen Bretts unter der Faktenkarte
const ABSPANN_SEK = 3.0;
const BLENDE_ENDE = 0.5;

if (!existsSync(CLIP)) { console.error(`✗ Aufnahme fehlt: ${CLIP}`); process.exit(1); }
const beiblatt = JSON.parse(readFileSync(CLIP.replace(/\.mp4$/, '.json'), 'utf8'));
if (beiblatt.siegBei == null) {
  console.error('✗ Aufnahme ohne Siegzeitpunkt — der Schnittpunkt fehlt.');
  process.exit(1);
}
// Umgedreht wird NUR das Spiel bis kurz nach dem letzten Zug. Die
// Sieg-Zeremonie rueckwaerts (Muenzen zaehlen runter, Enso radiert sich weg)
// saehe nach einem Fehler aus, nicht nach einer Idee.
const R = beiblatt.siegBei + 0.3;

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

// --- Karten -----------------------------------------------------------------
console.log('Karten rendern …');
await mitBrowser(async (schuss) => {
  await abspannKarte(schuss, join(TMP, 'abspann.png'));
  // Die Pointe. Dasselbe Band wie die Hook-Karte der Reels (weich auslaufend),
  // damit die Handschrift stimmt.
  await schuss(
    `<div style="position:absolute;left:0;top:900px;width:${B}px;height:720px;
                 background:linear-gradient(180deg,rgba(6,32,26,0),rgba(6,32,26,.82) 18%,
                            rgba(6,32,26,.88) 50%,rgba(6,32,26,.82) 82%,rgba(6,32,26,0))"></div>
     <div style="position:absolute;left:70px;top:900px;width:940px;height:720px;display:flex;
                 flex-direction:column;align-items:center;justify-content:center;
                 text-align:center;gap:38px">
       <div class="schatten" style="font-size:88px;font-weight:800;line-height:1.1">
         Every board is<br>built backwards.</div>
       <div style="font-size:40px;font-weight:600;color:#ffd76a;line-height:1.34">
         That's why it's always solvable.</div>
     </div>`,
    join(TMP, 'fakt.png'), { width: B, height: H });
});

// --- Das Spiel rueckwaerts --------------------------------------------------
// ⚠ `reverse` haelt ALLE Bilder im Speicher — bei 1080×1920/30fps sind das
// ~3 MB je Bild, eine 12-s-Strecke also ueber ein Gigabyte. Deshalb wird in
// 4-s-Stuecken umgedreht und in umgekehrter Reihenfolge wieder verkettet;
// das Ergebnis ist Bild fuer Bild dasselbe.
console.log('Spiel umdrehen …');
const STUECK = 4.0;
const stuecke = Math.ceil(R / STUECK);
const liste = [];
for (let i = 0; i < stuecke; i++) {
  const ab = i * STUECK;
  const sek = Math.min(STUECK, R - ab);
  const f = join(TMP, `r${i}.mp4`);
  await lauf([
    '-y', '-ss', ab.toFixed(3), '-t', sek.toFixed(3), '-i', CLIP,
    '-vf', `scale=${B}:${H},fps=${FPS},reverse,setpts=PTS-STARTPTS,format=yuv420p`,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', f,
  ]);
  liste.unshift(f);   // umgekehrte Reihenfolge = durchgehend rueckwaerts
}
writeFileSync(join(TMP, 'liste.txt'), liste.map((f) => `file '${f}'`).join('\n') + '\n');
await lauf(['-y', '-f', 'concat', '-safe', '0', '-i', join(TMP, 'liste.txt'),
  '-c', 'copy', join(TMP, 'rueck.mp4')]);

// Standbild anhaengen (volles Brett) und die Faktenkarte darueberlegen.
// ⚠ tpad statt einer zweiten Quelle: gleiches Material, keine Zeitbasen-Falle.
const spielLang = await dauerVon(join(TMP, 'rueck.mp4'));
const faktAb = spielLang - 0.4;                    // Karte kommt, sobald Ruhe ist
const hauptLang = spielLang + HALT_SEK;
await lauf([
  '-y', '-i', join(TMP, 'rueck.mp4'),
  '-loop', '1', '-t', hauptLang.toFixed(2), '-i', join(TMP, 'fakt.png'),
  '-filter_complex',
  `[0:v]tpad=stop_mode=clone:stop_duration=${HALT_SEK}[g];`
  + `[1:v]format=rgba,fade=t=in:st=${faktAb.toFixed(2)}:d=0.4:alpha=1[k];`
  + `[g][k]overlay=0:0,fps=${FPS},format=yuv420p[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'haupt.mp4'),
]);

await lauf(['-y', '-loop', '1', '-t', String(ABSPANN_SEK), '-i', join(TMP, 'abspann.png'),
  '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'abspann.mp4')]);

const abspannAb = hauptLang - BLENDE_ENDE;
const dauer = abspannAb + ABSPANN_SEK;
await lauf([
  '-y', '-i', join(TMP, 'haupt.mp4'), '-i', join(TMP, 'abspann.mp4'),
  '-filter_complex',
  `[0:v]settb=AVTB[h];[1:v]settb=AVTB[a];`
  + `[h][a]xfade=transition=fadeblack:duration=${BLENDE_ENDE}:offset=${abspannAb.toFixed(3)},`
  + `fps=${FPS},format=yuv420p[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'stumm.mp4'),
]);

// --- Ton --------------------------------------------------------------------
// Die Klaenge sitzen auf den GESPIEGELTEN Zugzeiten: Ein Match bei t erklingt
// rueckwaerts bei R − t, wenn sein Paar wieder erscheint. Die Melodie laeuft
// auf denselben Punkten mit — und dezeleriert dadurch mit dem Bild.
console.log('Ton mischen …');
const sfx = (n) => join(ASSETS, 'sfx', `${n}.aac`);
const ms = (s) => Math.round(Math.max(0, s) * 1000);
const treffer = beiblatt.klicks.filter((k) => k.art === 'match')
  .map((k) => ({ t: R - k.t, klang: 'match' }))
  .sort((a, b) => a.t - b.t);
// Der Sieg-Klang sitzt am Ende der RUECKWAERTS-Erzaehlung: wenn das Brett
// vollstaendig ist. Das Vollwerden IST hier der Sieg.
const ereignisse = treffer.concat([{ t: spielLang - 0.2, klang: 'win', vol: 1.1 }]);

const eingaben = ['-i', sfx('bett'), '-i', sfx('outro')];
const spuren = [
  `[0:a]atrim=0:${dauer.toFixed(2)},volume=0.30,afade=t=in:st=0:d=0.8[bed]`,
  `[1:a]adelay=${ms(abspannAb)}|${ms(abspannAb)},volume=0.7[o]`,
];
const namen = ['[bed]', '[o]'];
const spur = join(TMP, 'spiel.wav');
spurRendern(ereignisse.concat(melodie(treffer, spielLang - 0.2)), dauer + 1, spur);
eingaben.push('-i', spur);
spuren.push(`[${namen.length}:a]volume=1.0[spiel]`);
namen.push('[spiel]');

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

writeFileSync(join(OUT, `${NAME}.txt`), captionText('rueckwaerts', {
  datei: `${NAME}.mp4`, level: beiblatt.level, paare: beiblatt.paare,
  spielSek: spielLang.toFixed(0), gesamtSek: echt.toFixed(0), fakt: null,
}));

console.log(`\n✓ ${ziel}  (${echt.toFixed(1)} s)`);
console.log(`✓ ${join(OUT, `${NAME}.txt`)}`);
console.log(`  rueckwaerts ${spielLang.toFixed(1)} s → Karte ${HALT_SEK} s → Abspann ${ABSPANN_SEK} s`);

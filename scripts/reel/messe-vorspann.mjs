#!/usr/bin/env node
// Misst den Bewegungsverlauf eines Vorspann-Clips und schlaegt den Schnitt vor.
//
//   node scripts/reel/messe-vorspann.mjs scripts/reel/assets/vorspann/steine-legen.mp4
//   node scripts/reel/messe-vorspann.mjs                # alle Clips im Ordner
//
// ⚠ WOZU: Der Schnittpunkt jedes Vorspanns muss GEMESSEN sein, nicht geraten.
// Ein geratener Schnitt bei 2,4 s riss mitten in die Bewegung („der Uebergang
// ist zu schnell"); erst der gemessene bei 2,2–6,4 s zeigt den ganzen Bogen.
// Das Rezept stand bisher nur im README — hier ist es ausfuehrbar.
//
// Verfahren: Bewegung je 1/5 Sekunde als mittlere Pixeldifferenz zweier
// Graustufenbilder. Der Schnitt beginnt kurz VOR dem Bewegungsberg und endet
// in der RUHE dahinter, damit die Kreuzblende auf einem stehenden Bild sitzt.
//
// ⚠ Die Kurve allein entscheidet NICHT. Rauch und Kerzenlicht bewegen sich
// auch dann, wenn die Steine laengst liegen — deshalb hebt das Skript die
// Ruheschwelle nicht ins Absurde, sondern misst relativ zum ruhigsten Fenster
// des Clips. Vor der Aufnahme in VORSPAENNE immer noch Einzelbilder ansehen.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const FFMPEG = require('ffmpeg-static');
const HIER = dirname(fileURLToPath(import.meta.url));
const VORSPANN_ORDNER = join(HIER, 'assets', 'vorspann');

const BREITE = 96, HOEHE = 170, PRO_SEK = 5;
const SCHRITT = 1 / PRO_SEK;

// ⚠ Die Blende ist 0,6 s lang und muss VOLLSTAENDIG in der Ruhe liegen —
// sonst blendet man aus einer Bewegung heraus. Plus etwas Luft.
const RUHE_NOETIG = 1.0;

const lauf = (args) => new Promise((res, rej) => {
  const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (c) => (c === 0 ? res() : rej(new Error(err.slice(-800)))));
});

async function bewegung(datei) {
  const roh = join(HIER, '..', '..', 'out', '.bewegung.gray');
  await lauf(['-y', '-i', datei, '-vf', `fps=${PRO_SEK},scale=${BREITE}:${HOEHE}`,
    '-f', 'rawvideo', '-pix_fmt', 'gray', roh]);
  const b = readFileSync(roh);
  const px = BREITE * HOEHE;
  const n = Math.floor(b.length / px);
  if (n < 2) throw new Error(`${datei}: zu wenige Bilder (${n}) — Clip lesbar?`);
  const werte = [];
  for (let i = 1; i < n; i++) {
    let s = 0;
    for (let j = 0; j < px; j++) s += Math.abs(b[i * px + j] - b[(i - 1) * px + j]);
    werte.push(s / px);
  }
  return werte;
}

/**
 * Schlaegt `ab`/`sek` fuer den VORSPAENNE-Eintrag vor.
 *
 * ⚠ Zwei Fehler steckten in der ersten Fassung, beide gefunden, indem das
 * Skript gegen die zwei bereits am Bild geprueften Eintraege gehalten wurde —
 * es widersprach ihnen, und der Widerspruch lag am Skript:
 *
 * (1) Es suchte Ruhe nur am CLIP-ENDE. Der Schnitt muss dort aber gar nicht
 *     hinlaufen; jedes ausreichend lange Ruhefenster taugt als Schlusspunkt.
 *     `steine-kippen` hat seine Ruhe in der Mitte und fiel deshalb faelschlich
 *     durch — obwohl er im fertigen Reel einwandfrei laeuft.
 * (2) Die Schwelle hing am Minimum („ruhigstes × 1,8"). Bei einem Clip mit
 *     sehr stillem Anfang wird sie damit winzig, und das leichte Nachziehen
 *     von Rauch und Kerzenlicht zaehlte als Bewegung.
 *
 * Jetzt: Schwelle als Viertel der SPANNWEITE dieses Clips — das trennt
 * „Steine bewegen sich" von „nur noch Rauch". Und der Schnitt wird auf die
 * Ziellaenge gelegt, so dass er IN der Ruhe endet.
 */
const ZIEL_SEK = 4.2;      // Laenge der bisherigen Vorspaenne
const NACHLAUF = 0.6;      // so weit laeuft der Schnitt in die Ruhe hinein

function vorschlag(werte, laenge) {
  const min = Math.min(...werte), max = Math.max(...werte);
  const schwelle = min + (max - min) * 0.25;
  const still = werte.map((v) => v <= schwelle);

  // Alle Ruhefenster sammeln, das LETZTE ausreichend lange gewinnt — dort
  // kommt die Bewegung endgueltig zur Ruhe.
  const fenster = [];
  for (let i = 0; i < still.length; i++) {
    if (!still[i]) continue;
    let j = i; while (j < still.length && still[j]) j++;
    fenster.push({ ab: i * SCHRITT, lang: (j - i) * SCHRITT });
    i = j;
  }
  const tauglich = fenster.filter((f) => f.lang >= RUHE_NOETIG && f.ab > 0.4);
  const ruhe = tauglich[tauglich.length - 1];
  if (!ruhe) {
    const laengstes = fenster.reduce((a, f) => Math.max(a, f.lang), 0);
    return { taugt: false, grund: `laengste Ruhe nur ${laengstes.toFixed(1)} s (noetig ${RUHE_NOETIG})` };
  }

  const bis = Math.min(laenge, ruhe.ab + NACHLAUF);
  const ab = Math.max(0, Math.round((bis - ZIEL_SEK) * 10) / 10);
  return { taugt: true, ab, sek: Math.round((bis - ab) * 10) / 10, ruheAb: ruhe.ab, ruheLang: ruhe.lang };
}

const dauerVon = (datei) => new Promise((res) => {
  const p = spawn(FFMPEG, ['-hide_banner', '-i', datei]);
  let e = ''; p.stderr.on('data', (d) => { e += d; });
  p.on('close', () => {
    const m = e.match(/Duration: (\d+):(\d+):(\d+\.?\d*)/);
    res(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0);
  });
});

const dateien = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const liste = dateien.length
  ? dateien
  : readdirSync(VORSPANN_ORDNER).filter((f) => f.endsWith('.mp4')).map((f) => join(VORSPANN_ORDNER, f));

if (!liste.length) { console.error('✗ keine Clips gefunden'); process.exit(1); }

for (const datei of liste) {
  if (!existsSync(datei)) { console.error(`✗ fehlt: ${datei}`); continue; }
  const name = basename(datei, '.mp4');
  const laenge = await dauerVon(datei);
  const werte = await bewegung(datei);

  // Kurve mit Sekundenraster.
  let kurve = '';
  for (let i = 0; i < werte.length; i++) {
    if (i % PRO_SEK === 0) kurve += '|';
    const v = werte[i];
    kurve += v < 3 ? '.' : v < 6 ? '-' : v < 10 ? '+' : '#';
  }
  const raster = Array.from({ length: Math.ceil(laenge) }, (_, i) => `|${i}s   `.slice(0, 6)).join('');

  const v = vorschlag(werte, laenge);
  console.log(`\n${name}  (${laenge.toFixed(1)} s)`);
  console.log(`  ${kurve}`);
  console.log(`  ${raster}`);
  if (v.taugt) {
    console.log(`  ✓ Ruhe ab ${v.ruheAb.toFixed(1)} s (${v.ruheLang.toFixed(1)} s lang)`);
    console.log(`    Eintrag:  '${name}': { ab: ${v.ab}, sek: ${v.sek} },`);
    console.log('    ⚠ Vor der Aufnahme Einzelbilder am Schnittpunkt ansehen — die Kurve');
    console.log('      sieht auch dann ruhig aus, wenn nur der Rauch weiterzieht.');
  } else {
    console.log(`  ✗ taugt nicht als Vorspann: ${v.grund}`);
  }
}
console.log('');

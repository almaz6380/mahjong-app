#!/usr/bin/env node
// Zaehlt die Blitze in einem fertigen Reel und prueft die Obergrenzen.
//
//   node scripts/reel/check-blitze.mjs [datei]
//
// ⚠ WARUM ES DIESES SKRIPT GIBT: Vollflaechige Blitze in schneller Folge
// koennen bei photosensitiver Epilepsie Anfaelle ausloesen. Der Richtwert ist
// hoechstens DREI pro Sekunde. Das ist keine Geschmacksfrage und darf nicht
// im Kopf eines Bearbeiters haengen — deshalb wird GEMESSEN, nicht geschaetzt.
//
// `reel-modi.mjs` prueft dieselben Grenzen schon beim Bau, aber nur an den
// GEPLANTEN Werten. Hier wird das fertige Bild nachgemessen: Ein Uebergang wie
// `zoomin` oder `fadewhite` ist an seiner Spitze selbst fast weiss und kann
// einen Blitz erzeugen, den niemand als Blitz eingetragen hat.

import { execFileSync } from 'node:child_process';
import { FFMPEG } from './ffmpeg.mjs';
import { MIN_BLITZ_ABSTAND } from './effekte.mjs';

const datei = process.argv[2] || 'out/reels/mahjong-modi-EN.mp4';
const SCHWELLE = 165;      // mittlere Helligkeit, ab der das Auge „Blitz" liest
const MAX_ANTEIL = 0.92;   // nie reines Weiss — auf OLED sticht das zusaetzlich
const MAX_PRO_SEK = 3;

const out = execFileSync(FFMPEG, ['-v', 'error', '-i', datei,
  '-vf', 'fps=30,scale=160:284,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-',
  '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
const werte = [...out.matchAll(/YAVG=([\d.]+)/g)].map((m) => +m[1]);
if (!werte.length) { console.error('✗ keine Helligkeitswerte — Datei lesbar?'); process.exit(1); }

const spitze = Math.max(...werte) / 255;
const sek = werte.length / 30;
// Zusammenhaengende helle Bilder sind EIN Blitz, nicht mehrere.
const laeufe = [];
werte.forEach((y, i) => {
  if (y <= SCHWELLE) return;
  const t = i / 30, l = laeufe[laeufe.length - 1];
  if (l && t - l.bis < 0.12) { l.bis = t; l.n++; l.max = Math.max(l.max, y); }
  else laeufe.push({ ab: t, bis: t, n: 1, max: y });
});

console.log(`${datei}  ${sek.toFixed(1)} s, Spitze ${(spitze * 100).toFixed(0)} %`);
console.log(`Blitze: ${laeufe.length}  (${(laeufe.length / sek).toFixed(2)}/s)`);
for (const l of laeufe) {
  console.log(`  ${l.ab.toFixed(2)} s  ${l.n} Bilder (${(l.n / 30 * 1000).toFixed(0)} ms)`
    + `  Spitze ${(l.max / 255 * 100).toFixed(0)} %`);
}

const fehler = [];
if (spitze > MAX_ANTEIL) fehler.push(`Spitze ${(spitze * 100).toFixed(0)} % > ${MAX_ANTEIL * 100} %`);
if (laeufe.length / sek > MAX_PRO_SEK) fehler.push(`${(laeufe.length / sek).toFixed(2)} Blitze/s > ${MAX_PRO_SEK}`);
for (let i = 1; i < laeufe.length; i++) {
  const l = laeufe[i].ab - laeufe[i - 1].ab;
  if (l < MIN_BLITZ_ABSTAND) fehler.push(`Blitze bei ${laeufe[i - 1].ab.toFixed(2)} s und ${laeufe[i].ab.toFixed(2)} s nur ${l.toFixed(2)} s auseinander`);
}

if (fehler.length) { console.error('\n✗ ' + fehler.join('\n✗ ')); process.exit(1); }
console.log('\n✓ Blitzgrenzen eingehalten');

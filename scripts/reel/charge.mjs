#!/usr/bin/env node
// Erzeugt eine ganze Charge Reels — Aufnahme und Bau in einem Rutsch.
//
//   npx vite preview --port 5199 &
//   CHROMIUM_PFAD=/opt/pw-browsers/chromium node scripts/reel/charge.mjs
//   … --nur 3          nur die ersten drei (zum Ausprobieren)
//   … --ab 12          bei Nummer 12 weitermachen (nach einem Abbruch)
//
// Kostet nichts. Dauert je Reel etwa eine Minute, die volle Charge also rund
// eine halbe Stunde — im Hintergrund laufen lassen.
//
// Der Plan unten ist bewusst gemischt: drei Formate, Level quer durch die
// Rampe. Zwanzig Mal dasselbe Brett mit anderem Text waere fuer den
// Algorithmus wie fuer die Zuschauer ermuedend, und genau daran sterben die
// meisten frisch gestarteten Kanaele.
//
// ⚠ Die Level sind so gewaehlt, dass die Bretter unterschiedlich GROSS sind
// (Level 6 ≈ 36 Steine, Level 200 ≈ 60). Bei `paar` bleiben sie klein — die
// Frage soll in zwei Sekunden beantwortbar sein. Bei `clear` duerfen sie
// gross sein, dort ist die Laenge der Reiz.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAN, reelName, clipName, vorspannFuer } from './plan.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');
const OUT = join(WURZEL, 'out/reels/charge');
const SERVER = process.env.REEL_SERVER ?? 'http://127.0.0.1:5199';

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const NUR = Number(arg('nur', 0));
const AB = Number(arg('ab', 1));


mkdirSync(OUT, { recursive: true });

const jobs = PLAN.filter((j) => j.nr >= AB).slice(0, NUR || undefined);
const rohPfad = (j) => join(WURZEL, `out/reels/roh/${clipName(j.level)}.mp4`);

// Vorpruefung — aber nur, wenn wirklich etwas aufgenommen werden muss.
//
// Ohne sie rennt die Charge bei totem Server zwanzig Mal in denselben Fehler
// und braucht dafuer eine Minute — genau das ist am 11.08. passiert, weil
// `vite preview` als abgekoppelter Prozess gestartet war und den Aufruf nicht
// ueberlebt hat.
//
// ⚠ Sie lief bis zum 17.08. BEDINGUNGSLOS, und das stand einem Neubau im Weg:
// Liegen alle Rohaufnahmen vor, ist eine Charge reine Nachvertonung aus den
// Beipackzetteln — kein Browser, keine App, kein Server. Trotzdem verlangte
// das Skript `npm run build` plus laufenden Server und brach sonst ab. Damit
// zwang es einen Lauf, der nichts aufnimmt, ausgerechnet durch die Fehler-
// quelle, gegen die die Pruefung erfunden wurde.
const fehlende = jobs.filter((j) => !existsSync(rohPfad(j)));
if (fehlende.length) {
  try {
    const a = await fetch(SERVER, { signal: AbortSignal.timeout(4000) });
    if (!a.ok) throw new Error(`HTTP ${a.status}`);
  } catch (e) {
    console.error(`✗ Kein Preview-Server unter ${SERVER} (${e.message})`);
    console.error(`  ${fehlende.length} Aufnahme(n) fehlen, dafuer wird er gebraucht.`);
    console.error('  Erst starten:  npm run build && npx vite preview --port 5199 --host 127.0.0.1');
    process.exit(1);
  }
} else {
  console.log(`Alle ${jobs.length} Rohaufnahmen liegen vor — kein Preview-Server noetig.`);
}

const node = (skript, args) => spawnSync(process.execPath, [join(HIER, skript), ...args],
  { stdio: 'inherit', env: process.env });

let gebaut = 0, uebersprungen = 0, fehler = 0;

for (const j of jobs) {
  const name = reelName(j);
  const ziel = join(OUT, `${name}.mp4`);
  if (existsSync(ziel)) { console.log(`— ${name} liegt schon vor`); uebersprungen++; continue; }

  console.log(`\n=== ${j.nr}/${PLAN.length}  ${name}`);
  // Aufnahme je Level nur einmal — mehrere Reels koennen sich eine teilen.
  // Namensschema kommt aus record-solitaire.mjs — nicht hier erfinden.
  const clip = `out/reels/roh/${clipName(j.level)}.mp4`;
  if (!existsSync(join(WURZEL, clip))) {
    const r = node('record-solitaire.mjs',
      ['--level', String(j.level), '--lang', 'en', '--server', SERVER, '--out', 'out/reels/roh']);
    if (r.status !== 0) {
      console.error(`✗ Aufnahme fehlgeschlagen bei ${name}`);
      if (++fehler >= 3) {
        console.error('✗ Drei Aufnahmen hintereinander gescheitert — Abbruch.');
        console.error('  Meist ist der Preview-Server weg. Mit --ab weitermachen.');
        break;
      }
      continue;
    }
    fehler = 0;
  }

  const args = ['--clip', clip, '--format', j.format, '--name', name, '--out', 'out/reels/charge',
    '--vorspann', vorspannFuer(j)];
  if (j.fakt != null) args.push('--fakt', String(j.fakt));
  const r = node('make-reel.mjs', args);
  if (r.status !== 0) { console.error(`✗ Bau fehlgeschlagen bei ${name}`); continue; }
  gebaut++;
}

console.log(`\n${'='.repeat(50)}`);
console.log(`✓ ${gebaut} Reels gebaut, ${uebersprungen} uebersprungen → ${OUT}`);

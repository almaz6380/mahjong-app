#!/usr/bin/env node
// Schreibt die Textdateien einer fertigen Charge NEU — ohne die Videos noch
// einmal zu rendern.
//
//   node scripts/reel/captions-neu.mjs
//   … --out out/reels/charge      (Standard)
//
// ⚠ Warum es das gibt: Am 16.08.2026 mussten die Texte zweimal nachgezogen
// werden (Hashtags von zehn auf fuenf, danach drei Plattform-Fassungen). Beide
// Male waere die Alternative gewesen, 20 Videos neu zu rendern — eine halbe
// Stunde fuer eine Textzeile. Der Versuch, die Dateien stattdessen per
// Zeilenersetzung zu flicken, hat eine davon beschaedigt: Das Muster traf
// mehrere Zeilen und machte aus 10 Hashtags 20. Ein Neuaufbau aus den
// Quelldaten kann das nicht — er kennt die Datei gar nicht, die er ersetzt.
//
// Quellen: der Plan (plan.mjs), der Beipackzettel jeder Aufnahme
// (out/reels/roh/*.json) und die Laufzeit des fertigen Videos.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAN, reelName, clipName } from './plan.mjs';
import { captionText, fakten } from './formate.mjs';

const require = createRequire(import.meta.url);
const FFMPEG = require('ffmpeg-static');
const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const OUT = join(WURZEL, arg('out', 'out/reels/charge'));
const ROH = join(WURZEL, 'out/reels/roh');

// Laenge ueber `ffmpeg -i`: `ffprobe` gibt es in der Cloud-Sitzung nicht.
function dauerVon(datei) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', datei], { encoding: 'utf8' });
  const m = (r.stderr ?? '').match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

const FAKTEN = fakten();
let geschrieben = 0, fehlend = 0;

for (const j of PLAN) {
  const name = reelName(j);
  const video = join(OUT, `${name}.mp4`);
  const zettel = join(ROH, `${clipName(j.level)}.json`);

  if (!existsSync(video)) { console.log(`— ${name}: kein Video`); fehlend++; continue; }
  if (!existsSync(zettel)) { console.log(`— ${name}: kein Beipackzettel`); fehlend++; continue; }

  const bb = JSON.parse(readFileSync(zettel, 'utf8'));
  const gesamt = dauerVon(video);
  if (gesamt == null) { console.log(`— ${name}: Laenge nicht lesbar`); fehlend++; continue; }

  writeFileSync(join(OUT, `${name}.txt`), captionText(j.format, {
    // ⚠ Jedes Charge-Reel traegt einen kie.ai-Vorspann (`vorspannFuer()` in
    // plan.mjs) — der Plan vergibt keinen Eintrag ohne. Waere das je optional,
    // muesste hier der Eintrag des Jobs gelesen werden statt eines festen true.
    ki: true,
    datei: `${name}.mp4`,
    level: bb.level ?? j.level,
    paare: bb.paare ?? '?',
    spielSek: (bb.dauer ?? 0).toFixed(0),
    gesamtSek: gesamt.toFixed(0),
    fakt: j.fakt != null ? FAKTEN[j.fakt % FAKTEN.length].en : null,
  }));
  console.log(`✓ ${name}.txt`);
  geschrieben++;
}

console.log(`\n${geschrieben} Textdateien neu geschrieben${fehlend ? `, ${fehlend} uebersprungen` : ''}`);
process.exit(fehlend && !geschrieben ? 1 : 0);

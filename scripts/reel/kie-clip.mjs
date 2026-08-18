#!/usr/bin/env node
// Erzeugt Vorspann-Clips ueber kie.ai (Google Veo) und legt sie samt Prompt ab.
//
//   node scripts/reel/kie-clip.mjs                    # Trockenlauf: Prompts + Kosten
//   node scripts/reel/kie-clip.mjs --los              # wirklich erzeugen
//   node scripts/reel/kie-clip.mjs --los --nur stein-drehen-a
//
// ⚠ KOSTET GELD. Ohne `--los` passiert nichts — der Trockenlauf druckt nur,
// was rausginge und was es kostet. Laut CLAUDE.md braucht JEDER Lauf vorher
// ein ausdrueckliches „ja" von Josef im Chat.
//
// ⚠ Der Schluessel kommt aus der Umgebung (`KIE_API_KEY`) und gehoert weder
// ins Repo noch in den Chat — ein Schluessel im Sitzungsprotokoll gilt als
// verbrannt und muss ersetzt werden.
//
// Bisher lebte dieser Weg nur in Sitzungsverlaeufen; jede neue Sitzung musste
// die Schnittstelle neu herausfinden. Deshalb steht er hier.

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(HIER, 'assets', 'vorspann');

const API = 'https://api.kie.ai';
const MODELL = 'veo3_lite';        // 30 Credits/Clip; veo3_fast 80, veo3 400
const CREDITS_JE_CLIP = 30;
const SCHLUESSEL = process.env.KIE_API_KEY;

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const LOS = process.argv.includes('--los');
const NUR = arg('nur', null);

// --- Die Prompts ------------------------------------------------------------
// ⚠ Vier Dinge muessen in JEDEM Prompt stehen. Das ist keine Stilfrage,
// sondern die Liste dessen, was hier schon schiefgegangen ist:
//
// (1) NUR HAENDE, keine Gesichter. Der Schwachpunkt von KI-Video ist die
//     Konsistenz der Figuren zwischen Clips — Kleidung und Gesichter driften.
//     Eine Nahaufnahme umgeht das Problem vollstaendig.
// (2) Der Clip muss ENDEN: „…then the hands withdraw … tiles rest completely
//     still". Ohne diesen Satz kommt eine Aufnahme heraus, die bis zur letzten
//     Sekunde in Bewegung ist — dann sitzt die Kreuzblende mitten in der
//     Bewegung, und genau daran ist die erste Fassung des Vorspanns
//     gescheitert.
// (3) GLEICHES LICHT wie die vorhandenen Clips (warmes Laternenlicht, dunkles
//     Holz, Rauchschleier), sonst sehen die Einstiege nicht nach einem Satz aus.
// (4) FORMATFUELLENDE STEINE. Der Match-Cut zur App beruht darauf, dass beide
//     Seiten dasselbe Motiv zeigen; eine weite Einstellung zerstoert ihn.
const LICHT = 'Warm amber lantern light from the left, dark polished wood table, '
  + 'faint incense smoke drifting, shallow depth of field, cinematic macro shot, '
  + 'vertical 9:16 framing, tiles fill the frame. No faces, no people visible, hands only.';
const RUHE = 'The hands then withdraw completely out of frame and the tiles rest '
  + 'completely still for the final two seconds, nothing moving but the smoke.';

export const MOTIVE = {
  'stein-drehen-a': {
    was: 'Verdeckter Stein wird umgedreht, das 中 kommt zum Vorschein',
    prompt: `Extreme close-up: a single ivory mahjong tile lies face-down on dark wood. `
      + `An elderly hand reaches in, turns the tile over with two fingers, revealing the red `
      + `中 dragon symbol carved into its face. ${RUHE} ${LICHT}`,
  },
  'stein-drehen-b': {
    was: 'dasselbe, langsamer und flacher',
    prompt: `Macro shot from a low angle: three ivory mahjong tiles lie face-down in a row. `
      + `A hand slowly flips the middle one, revealing a red 中 dragon symbol. `
      + `${RUHE} ${LICHT}`,
  },
  'steine-mischen-a': {
    was: 'Haende wischen die Steine ueber den Tisch',
    prompt: `Close-up: two hands sweep and shuffle a pile of ivory mahjong tiles across `
      + `dark polished wood in slow circular motions, tiles clacking against each other. `
      + `${RUHE} ${LICHT}`,
  },
  'steine-mischen-b': {
    was: 'dasselbe, aus groesserer Naehe auf wenige Steine',
    prompt: `Macro shot: hands shuffle a loose cluster of ivory mahjong tiles on dark wood, `
      + `tiles sliding and turning over each other. ${RUHE} ${LICHT}`,
  },
  'mauer-bauen-a': {
    was: 'Steine werden zu einer Mauer zusammengeschoben',
    prompt: `Low camera angle, close-up: hands push ivory mahjong tiles together into a `
      + `straight standing wall, stacking a second row on top. ${RUHE} ${LICHT}`,
  },
  'mauer-bauen-b': {
    was: 'dasselbe, Kamera fast auf Tischhoehe',
    prompt: `Camera at table level, extreme close-up: hands slide ivory mahjong tiles `
      + `into a neat row, the last tile clicking into place at the end of the wall. `
      + `${RUHE} ${LICHT}`,
  },
};

// --- Schnittstelle ----------------------------------------------------------
const kopf = () => ({ Authorization: `Bearer ${SCHLUESSEL}`, 'Content-Type': 'application/json' });

async function guthaben() {
  const a = await fetch(`${API}/api/v1/chat/credit`, { headers: kopf() });
  const j = await a.json();
  if (j.code !== 200) throw new Error(`Guthaben nicht lesbar: ${JSON.stringify(j)}`);
  return j.data;
}

async function erzeugen(prompt) {
  const a = await fetch(`${API}/api/v1/veo/generate`, {
    method: 'POST',
    headers: kopf(),
    body: JSON.stringify({ prompt, model: MODELL, aspectRatio: '9:16' }),
  });
  const j = await a.json();
  if (j.code !== 200 || !j.data?.taskId) throw new Error(`Auftrag abgelehnt: ${JSON.stringify(j)}`);
  return j.data.taskId;
}

/**
 * Auf das Ergebnis warten.
 *
 * ⚠ Nicht endlos: Ein haengender Auftrag wuerde die Sitzung sonst blockieren.
 * Veo braucht typisch 1–3 Minuten; nach 10 Minuten gilt er als verloren.
 */
async function warten(taskId, name) {
  const bis = Date.now() + 10 * 60 * 1000;
  while (Date.now() < bis) {
    await new Promise((r) => setTimeout(r, 15000));
    const a = await fetch(`${API}/api/v1/veo/record-info?taskId=${taskId}`, { headers: kopf() });
    const j = await a.json();
    const d = j.data ?? {};
    // successFlag: 0 laeuft, 1 fertig, 2/3 fehlgeschlagen
    if (d.successFlag === 1) {
      const url = d.response?.resultUrls?.[0] ?? JSON.parse(d.resultUrls ?? '[]')[0];
      if (!url) throw new Error(`${name}: fertig, aber keine URL — ${JSON.stringify(d).slice(0, 300)}`);
      return url;
    }
    if (d.successFlag === 2 || d.successFlag === 3) {
      throw new Error(`${name}: fehlgeschlagen — ${d.errorMessage ?? JSON.stringify(d).slice(0, 300)}`);
    }
    process.stdout.write('.');
  }
  throw new Error(`${name}: nach 10 Minuten kein Ergebnis (taskId ${taskId})`);
}

async function laden(url, datei) {
  const a = await fetch(url);
  if (!a.ok) throw new Error(`Download ${a.status}`);
  writeFileSync(datei, Buffer.from(await a.arrayBuffer()));
}

// --- Ablauf -----------------------------------------------------------------
const auswahl = NUR ? { [NUR]: MOTIVE[NUR] } : MOTIVE;
if (NUR && !MOTIVE[NUR]) {
  console.error(`✗ unbekanntes Motiv: ${NUR}\n  Bekannt: ${Object.keys(MOTIVE).join(', ')}`);
  process.exit(1);
}
const namen = Object.keys(auswahl);

console.log(`Modell ${MODELL} · ${namen.length} Clip(s) · `
  + `${namen.length * CREDITS_JE_CLIP} Credits ≈ ${(namen.length * CREDITS_JE_CLIP * 0.005).toFixed(2)} $\n`);
for (const n of namen) {
  console.log(`${n}  — ${auswahl[n].was}`);
  console.log(`  ${auswahl[n].prompt.slice(0, 150)}…\n`);
}

if (!LOS) {
  console.log('TROCKENLAUF — nichts erzeugt. Mit --los wirklich starten.');
  process.exit(0);
}
if (!SCHLUESSEL) {
  console.error('✗ KIE_API_KEY fehlt in der Umgebung.');
  console.error('  Er gehoert in die Umgebungsvariablen der Claude-Umgebung, nicht ins Repo.');
  process.exit(1);
}

mkdirSync(ZIEL, { recursive: true });
console.log(`Guthaben vorher: ${await guthaben()} Credits\n`);

let fertig = 0, kaputt = 0;
for (const name of namen) {
  const datei = join(ZIEL, `${name}.mp4`);
  if (existsSync(datei)) { console.log(`— ${name} liegt schon vor`); continue; }
  try {
    process.stdout.write(`${name} `);
    const id = await erzeugen(auswahl[name].prompt);
    const url = await warten(id, name);
    await laden(url, datei);
    // Der Prompt gehoert neben den Clip — sonst weiss niemand mehr, wie er
    // entstanden ist, und eine Variante laesst sich nicht nachziehen.
    writeFileSync(join(ZIEL, `${name}.txt`),
      `${auswahl[name].was}\n\nModell: ${MODELL}\ntaskId: ${id}\n\n${auswahl[name].prompt}\n`);
    console.log(` ✓ ${datei}`);
    fertig++;
  } catch (e) {
    console.log(`\n  ✗ ${e.message}`);
    kaputt++;
  }
}

console.log(`\n${fertig} erzeugt, ${kaputt} fehlgeschlagen`);
console.log(`Guthaben nachher: ${await guthaben()} Credits`);
console.log('\nNaechster Schritt — NICHT ueberspringen:');
console.log('  node scripts/reel/messe-vorspann.mjs');
console.log('  Nur ein Clip mit gemessenem Schnittpunkt darf in VORSPAENNE.');

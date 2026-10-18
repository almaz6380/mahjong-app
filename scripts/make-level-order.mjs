// Erzeugt src/game/levelOrder.ts — die GEMESSENE Reihenfolge der Level-Figuren.
//
// Jede Figur ab 36 Steinen wird mit einem planlosen Zufallsspieler gespielt
// (Vierer-Deck wie in den mittleren/späten Leveln, `zufallsSiege` aus engine.ts).
// Dann wird Level für Level die Figur gewählt, deren Gewinnquote am besten zur
// Zielkurve passt — unter zwei Nebenbedingungen:
//   * Brettgröße (Stufe ≤5×6 / ≤6×7 / ≤7×8 / 8×9) und Steinzahl wachsen nur
//     langsam, damit die Steine am Anfang groß bleiben;
//   * zwei Level hintereinander nie dieselbe Grundform.
// Deterministisch (fester Seed) — derselbe Generator ergibt dieselbe Datei.
//
// Aufruf aus dem Projekt-Root: node scripts/make-level-order.mjs
// Danach: node scripts/check-figures.mjs && node scripts/check-schwierigkeit.mjs
import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require0 = createRequire(import.meta.url);
async function load(entry) {
  const r = await esbuild.build({
    entryPoints: [entry], bundle: true, write: false, format: 'cjs', platform: 'node', target: 'node18',
    external: ['@capacitor/preferences', 'react', 'react-dom'],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', r.outputFiles[0].text)(mod, mod.exports, require0);
  return mod.exports;
}
const figs = await load('src/game/figures.ts');
const eng = await load('src/game/engine.ts');
const tiles = await load('src/game/tiles.ts');

/** Wie viele Level es gibt; danach folgen die Meister-Level (figures.ts). */
const LEVELS = 999;
const BRETTER = 30; // je Figur
const PARTIEN = 4; // je Brett

const tier = (f) => (f.cols <= 5 && f.rows <= 6 ? 0 : f.cols <= 6 && f.rows <= 7 ? 1 : f.cols <= 7 && f.rows <= 8 ? 2 : 3);
const tierCap = (l) => (l <= 40 ? 0 : l <= 160 ? 1 : l <= 420 ? 2 : 3);
const nMax = (l) => Math.round(40 + l * 0.09);
const nMin = (l) => Math.round(36 + l * 0.03);
/** Zielquote des Zufallsspielers mit Vierer-Deck, vor der Kandidaten-Auswahl. */
const ziel = (l) => Math.max(0.4, 0.82 - 0.52 * Math.pow((l - 1) / (LEVELS - 1), 0.7));

const all = figs.allFigures();
const pool = [];
all.forEach((f, i) => {
  if (f.cells.length < 36) return;
  const nb = eng.buildNeighbors(f.cells);
  let siege = 0;
  for (let b = 0; b < BRETTER; b++) {
    const rand = eng.mulberry32(eng.seedFromString(`ordnung:${f.hash}:${b}`));
    const brett = eng.generateBoard(f.cells, nb, tiles.deckForLevel(f.cells.length, 1, rand), rand);
    siege += eng.zufallsSiege(brett, nb, PARTIEN, rand);
  }
  pool.push({ nr: i + 1, f, n: f.cells.length, tier: tier(f), quote: siege / (BRETTER * PARTIEN) });
});
console.log(`${pool.length} Figuren gemessen`);

// Abschnitte gleicher Höchst-Brettgröße. Ein Level-für-Level-Greedy verbraucht
// die wenigen kleinen Bretter (nur ~55 Figuren passen auf ≤5×6) zu früh und
// springt dann. Deshalb je Abschnitt: die Figuren wählen, die am besten in den
// Zielbereich des Abschnitts passen, und sie darin von leicht nach schwer ordnen.
const ABSCHNITTE = [[1, 40], [41, 160], [161, 420], [421, LEVELS]];
const frei = new Set(pool);
const order = [];
for (const [a, b] of ABSCHNITTE) {
  const cap = tierCap(a);
  const hoch = ziel(a), tief = ziel(b);
  const abstand = (p) => (p.quote > hoch ? p.quote - hoch : p.quote < tief ? tief - p.quote : 0);
  const wahl = [...frei]
    .filter((p) => p.tier <= cap && (cap === 0 || b === LEVELS || p.tier >= cap - 1) && p.n <= nMax(b) && (b === LEVELS || p.n >= nMin(a)))
    .sort((x, y) => abstand(x) - abstand(y) || y.tier - x.tier || x.nr - y.nr)
    .slice(0, b - a + 1);
  if (wahl.length < b - a + 1) throw new Error(`Abschnitt ${a}–${b}: nur ${wahl.length} Figuren`);
  wahl.sort((x, y) => y.quote - x.quote || x.n - y.n || x.nr - y.nr);
  // Im letzten Abschnitt ist die Zielkurve flach (~25 % ab Level 300). Dort
  // NICHT von leicht nach schwer ordnen, sonst bekäme dessen Anfang alle
  // leichten Restfiguren auf einmal — gemessen Level 450: 46 % statt 25 %.
  // Stattdessen gleichmäßig verzahnt: je eine leichte, eine schwere, …
  if (b === LEVELS) {
    const z = [];
    for (let lo = 0, hi = wahl.length - 1; lo <= hi; lo++, hi--) {
      z.push(wahl[hi]);
      if (lo !== hi) z.push(wahl[lo]);
    }
    wahl.splice(0, wahl.length, ...z);
  }
  // Nie zweimal hintereinander dieselbe Grundform: nach vorn tauschen.
  for (let i = 1; i < wahl.length; i++) {
    const davor = i === 1 && order.length ? order[order.length - 1] : wahl[i - 1];
    if (wahl[i].f.shape !== davor.f.shape) continue;
    const j = wahl.findIndex((p, k) => k > i && p.f.shape !== davor.f.shape);
    if (j > 0) [wahl[i], wahl[j]] = [wahl[j], wahl[i]];
  }
  for (const p of wahl) frei.delete(p);
  order.push(...wahl);
}

const nummern = order.map((p) => p.nr);
const sig = figs.levelOrderSig(nummern);
writeFileSync(
  'src/game/levelOrder.ts',
  `// ERZEUGT von \`node scripts/make-level-order.mjs\` — nicht von Hand ändern.\n` +
    `// ${LEVELS} Level, gemessen am planlosen Zufallsspieler (Vierer-Deck),\n` +
    `// Zielkurve von ${ziel(1).toFixed(2)} auf ${ziel(LEVELS).toFixed(2)} Gewinnquote.\n` +
    `// Die Signatur bindet die Liste an den Figuren-Generator (siehe figures.ts).\n` +
    `export const LEVEL_ORDER: number[] = [\n` +
    nummern.map((n, i) => (i % 20 === 0 ? '  ' : '') + n + ',' + (i % 20 === 19 ? '\n' : ' ')).join('').trimEnd() +
    `\n];\nexport const LEVEL_ORDER_SIG = ${sig};\n`,
);
for (const l of [1, 10, 25, 50, 100, 150, 200, 300, 400, 500, 600]) {
  const p = order[l - 1];
  console.log(`Level ${String(l).padStart(3)}: ${p.f.cols}×${p.f.rows} n=${p.n} Ebenen ${p.f.layerCount}  Quote ${p.quote.toFixed(2)} (Ziel ${ziel(l).toFixed(2)})`);
}
console.log('→ src/game/levelOrder.ts geschrieben');

// Prüft den Figuren-Generator headless: Brettmaße, Level-Rampe, Parität,
// Schweben, Lösbarkeit sowie die Filter von Zen/Pagode/Festivals.
// Aufruf aus dem Projekt-Root: node scripts/check-figures.mjs
import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';

const require0 = createRequire(import.meta.url);

async function load(entry) {
  const r = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    external: ['@capacitor/preferences', 'react', 'react-dom'],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', r.outputFiles[0].text)(mod, mod.exports, require0);
  return mod.exports;
}

const figs = await load('src/game/figures.ts');
const eng = await load('src/game/engine.ts');
const tiles = await load('src/game/tiles.ts');
const layouts = await load('src/game/layouts.ts');

const all = figs.allFigures();
let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${msg}`);
  if (!ok) fails++;
};

console.log(`\nFiguren: ${all.length}`);
const maxCols = Math.max(...all.map((f) => f.cols));
const maxRows = Math.max(...all.map((f) => f.rows));
const counts = all.map((f) => f.cells.length);
console.log(`max Brett: ${maxCols}×${maxRows} · Steine ${Math.min(...counts)}–${Math.max(...counts)}\n`);

check(maxCols <= 8 && maxRows <= 9, `Brett global ≤ 8×9 (ist ${maxCols}×${maxRows})`);

// --- Level-Rampe: nicht jede Figur wird ein Level (levelFigures) -------------
const lvl = figs.levelFigures();
console.log(`Level-Rampe: ${lvl.length} Level aus ${all.length} Figuren\n`);

check(lvl.every((f) => f.cells.length >= 36), `kein Level unter 36 Steinen (${lvl.filter((f) => f.cells.length < 36).length} Verstöße)`);
const bad = lvl.slice(0, 15).filter((f) => f.cols > 5 || f.rows > 6);
check(bad.length === 0, `Level 1–15 klein (≤5×6, große Steine) — ${bad.length} Verstöße`);
for (const [c, r] of [[5, 6], [6, 7], [7, 8]]) {
  const i = lvl.findIndex((f) => f.cols > c || f.rows > r);
  console.log(`       erstes Brett > ${c}×${r}: Level ${i + 1}`);
}

check(all.every((f) => f.layerCount >= 2), `keine flachen Bretter (${all.filter((f) => f.layerCount < 2).length} einschichtige)`);
const avg = (from, to, pick) => {
  const s = lvl.slice(from, to);
  return s.reduce((a, f) => a + pick(f), 0) / s.length;
};
const layFr = avg(0, 25, (f) => f.layerCount), laySp = avg(200, lvl.length, (f) => f.layerCount);
check(layFr < laySp, `Stapelung steigt (Level 1–25 ${layFr.toFixed(2)} < ab 200 ${laySp.toFixed(2)} Ebenen)`);
const tilesFr = avg(0, 25, (f) => f.cells.length), tilesSp = avg(200, lvl.length, (f) => f.cells.length);
check(tilesSp > tilesFr * 1.5, `Steinzahl steigt deutlich (Level 1–25 ${tilesFr.toFixed(1)} -> ab 200 ${tilesSp.toFixed(1)})`);

// Rampe: maxDim je 50er-Band nicht fallend
let prev = 0, mono = true;
for (let i = 0; i < lvl.length; i += 50) {
  const band = lvl.slice(i, i + 50);
  const dim = Math.max(...band.map((f) => Math.max(f.cols, f.rows)));
  if (dim < prev) mono = false;
  prev = Math.max(prev, dim);
}
check(mono, 'Brettgröße wächst über die Level monoton');

check(all.every((f) => f.cells.length % 2 === 0), 'Steinzahl überall gerade');

const floats = all.filter((f) => {
  const set = new Set(f.cells.map((c) => `${c.col},${c.row},${c.layer}`));
  return f.cells.some((c) => c.layer > 0 && !set.has(`${c.col},${c.row},${c.layer - 1}`));
});
check(floats.length === 0, `kein Stein schwebt (${floats.length} Verstöße)`);

// Lösbarkeit: jedes Board muss vollständig generierbar sein
let genFail = 0;
for (const f of all) {
  const rng = eng.mulberry32(7);
  const board = eng.generateBoard(f.cells, eng.buildNeighbors(f.cells), tiles.deckForCount(f.cells.length), rng);
  if (!board || board.length !== f.cells.length) genFail++;
}
check(genFail === 0, `alle ${all.length} Boards lösbar generierbar (${genFail} Fehler)`);

// Modus-Filter
const zen = all.filter((f) => f.cells.length >= 30 && f.cells.length <= 64 && f.layerCount <= 3 && f.cols <= 7 && f.rows <= 8);
check(zen.length >= 200, `Zen-Filter liefert ${zen.length} Figuren (≥200)`);

for (const p of ['laterne', 'bluete', 'drache', 'ring']) {
  const n = all.filter((f) => f.shape.startsWith(p)).length;
  check(n >= 10, `Festival-Form "${p}": ${n} Figuren (≥10)`);
}

const pagodaOk = [1, 50, 100].every((floor) => all[Math.round(((floor - 1) / 99) * (all.length - 1))]);
check(pagodaOk, 'Pagoden-Etagen 1/50/100 definiert');

// Neue Layouts für Daily & Blitz
for (const name of ['daily', 'blitz']) {
  const l = layouts.getLayout(name);
  if (!l) { check(false, `Layout "${name}" existiert`); continue; }
  const cols = Math.max(...l.cells.map((c) => c.col)) + 1;
  const rows = Math.max(...l.cells.map((c) => c.row)) + 1;
  const set = new Set(l.cells.map((c) => `${c.col},${c.row},${c.layer}`));
  const floating = l.cells.filter((c) => c.layer > 0 && !set.has(`${c.col},${c.row},${c.layer - 1}`));
  const board = eng.generateBoard(l.cells, eng.buildNeighbors(l.cells), tiles.deckForCount(l.cells.length), eng.mulberry32(3));
  check(
    l.cells.length % 2 === 0 && floating.length === 0 && board?.length === l.cells.length && cols <= 7 && rows <= 8,
    `Layout "${name}": ${cols}×${rows}, ${l.cells.length} Steine, lösbar, kein Schweben`,
  );
}

// Level-Stichproben
console.log('\nStichproben:');
for (const n of [1, 5, 10, 25, 50, 100, 200, 300, lvl.length]) {
  const f = figs.figureForLevel(n);
  console.log(`  Level ${String(n).padStart(4)}: ${f.shape.padEnd(12)} ${f.cols}×${f.rows}  n=${String(f.cells.length).padStart(3)}  Ebenen ${f.layerCount}  (${f.profile})`);
}

console.log(fails === 0 ? '\n✅ alle Prüfungen bestanden\n' : `\n❌ ${fails} Prüfung(en) fehlgeschlagen\n`);
process.exit(fails === 0 ? 0 : 1);

// Prüft die Schwierigkeitskurve der Level-Kampagne so, wie das Spiel sie baut:
// Figur aus levelOrder.ts, Vierer-Deck und Kandidaten-Auswahl aus
// `haerteForLevel` — dann spielt ein planloser Zufallsspieler das gewählte Brett.
// Gemittelt über ein Fenster von 10 Leveln, damit einzelne Figuren nicht täuschen.
//
// Aufruf aus dem Projekt-Root: node scripts/check-schwierigkeit.mjs
// Ziel (18.10.2026, mit Josef abgestimmt): ~90 % auf Level 1, ~60 % auf 50,
// ~40 % auf 150, ~25 % ab 300. Eine Gegenprobe mit der ALTEN Bauweise (ohne
// Härte) muss deutlich leichter ausfallen — sonst misst der Test nichts.
import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';

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
const mods = await load('src/game/modifiers.ts');

const BRETTER = 6; // je Level
const MESSUNG = 40; // Partien auf dem gewählten Brett

function brettFuer(level, rand, mitHaerte) {
  const f = figs.figureForLevel(level);
  const nb = eng.buildNeighbors(f.cells);
  // Genau der Weg des Spiels (useGame → kampagnenBrett); ohne Härte die alte Bauweise.
  const m = mitHaerte ? { hidden: 0, specials: [], ...mods.haerteForLevel(level) } : mods.KEINE_MODS;
  return { brett: mods.kampagnenBrett(f.cells, nb, m, rand).tiles, nb };
}

function quote(von, mitHaerte) {
  let siege = 0, partien = 0;
  for (let l = von; l < von + 10; l++) {
    for (let b = 0; b < BRETTER; b++) {
      const rand = eng.mulberry32(eng.seedFromString(`kurve:${l}:${b}`));
      const { brett, nb } = brettFuer(l, rand, mitHaerte);
      siege += eng.zufallsSiege(brett, nb, MESSUNG, rand);
      partien += MESSUNG;
    }
  }
  return siege / partien;
}

let fails = 0;
const check = (ok, text) => { console.log(`  ${ok ? 'ok  ' : 'FEHL'} ${text}`); if (!ok) fails++; };

const ZIELE = [[1, 0.9], [31, 0.75], [41, 0.7], [50, 0.6], [100, 0.5], [121, 0.45], [131, 0.45], [150, 0.4], [251, 0.3], [261, 0.3], [300, 0.25], [450, 0.25], [590, 0.25], [700, 0.25]];
console.log('Level   neu    alt   Ziel');
const neu = [];
for (const [l, z] of ZIELE) {
  const q = quote(l, true), alt = quote(l, false);
  neu.push(q);
  console.log(`${String(l).padStart(5)}  ${(q * 100).toFixed(0).padStart(3)} %  ${(alt * 100).toFixed(0).padStart(3)} %  ~${z * 100} %`);
  check(Math.abs(q - z) <= 0.12, `Level ${l}: ${(q * 100).toFixed(0)} % liegt nah an ~${z * 100} %`);
  if (l >= 50) check(q < alt - 0.1, `Level ${l}: deutlich schwerer als ohne Härte (Gegenprobe)`);
}
const bei = (l) => neu[ZIELE.findIndex(([x]) => x === l)];
check(bei(1) > bei(50) && bei(50) > bei(150) && bei(150) > bei(300), 'Kurve fällt von Level 1 über 50 und 150 bis 300');

// Rechenzeit: das Spiel baut das Brett beim Levelstart auf dem Handy.
let langsamste = 0;
for (const l of [100, 300, 600, 900]) {
  const t0 = performance.now();
  for (let i = 0; i < 5; i++) brettFuer(l, Math.random, true);
  langsamste = Math.max(langsamste, (performance.now() - t0) / 5);
}
check(langsamste < 60, `Brettaufbau langsamstes Level ${langsamste.toFixed(0)} ms (Handy ~3× langsamer)`);

console.log(fails === 0 ? '\n✅ Schwierigkeitskurve passt\n' : `\n❌ ${fails} Prüfung(en) fehlgeschlagen\n`);
process.exit(fails === 0 ? 0 : 1);

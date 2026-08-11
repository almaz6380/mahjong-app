// Prüft die Paritäts-Invariante der Spezialsteine — der wichtigste Test dieser
// Mechanik.
//
// Hintergrund: `makePairs` in engine.ts bildet je matchKey-Gruppe nur
// `floor(Größe/2)` Paare. Hat eine Gruppe auf dem Brett eine UNGERADE Zahl von
// Steinen, ist das `pairs`-Array kürzer als die Zahl der Positionen. Eine
// Schutzzeile in `assignSolvable` fängt das ab (vorher: TypeError bis in die
// Oberfläche), aber das Brett ist dann trotzdem unlösbar — und kein Mischen
// repariert es.
//
// Deshalb muss gelten: **Jede matchKey-Gruppe bleibt gerade.** Bombe und Joker
// sind die einzigen Mechaniken, die das brechen könnten:
//   - Die Bombe räumt zusätzliche Steine  -> `blastSet` beschneidet auf Paare.
//   - Der Joker schlägt einen fremden Stein -> der zweite Joker nimmt dessen
//     Gestalt an, sonst bleiben zwei Waisen.
//
// Aufruf aus dem Projekt-Root: node scripts/check-specials.mjs

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

const E = await load('src/game/engine.ts');
const T = await load('src/game/tiles.ts');
const L = await load('src/game/layouts.ts');
const M = await load('src/game/modifiers.ts');
const F = await load('src/game/figures.ts');

let fehler = 0;
const pruef = (ok, msg) => {
  if (!ok) { console.log(`   ✗ ${msg}`); fehler++; }
};

const gruppen = (tiles) => {
  const m = new Map();
  for (const t of tiles) if (!t.removed) m.set(t.face.matchKey, (m.get(t.face.matchKey) ?? 0) + 1);
  return m;
};
const ungerade = (tiles) => [...gruppen(tiles)].filter(([, n]) => n % 2).map(([k]) => k);

// --- 1. Determinismus der Rampe ---------------------------------------------
console.log('\n1) Modifikatoren sind deterministisch');
for (const lvl of [1, 29, 30, 49, 50, 120, 220, 370]) {
  const a = JSON.stringify(M.modsForLevel(lvl, 60, { rated: true }));
  const b = JSON.stringify(M.modsForLevel(lvl, 60, { rated: true }));
  pruef(a === b, `Level ${lvl}: zwei Aufrufe liefern Unterschiedliches`);
}
pruef(M.modsForLevel(29, 60).hidden === 0, 'Level 29 hat verdeckte Steine (Schwelle ist 30)');
pruef(M.modsForLevel(30, 60).hidden > 0, 'Level 30 hat keine verdeckten Steine');
pruef(M.modsForLevel(49, 60).specials.length === 0, 'Level 49 hat Spezialsteine (Schwelle ist 50)');
pruef(M.modsForLevel(50, 60).specials.length > 0, 'Level 50 hat keine Spezialsteine');
pruef(
  !M.modsForLevel(200, 60, {}).specials.includes('time'),
  'Zeitbonus taucht ohne Uhr und ohne Wertung auf — dort waere er wirkungslos',
);
console.log(`   Level 30: ${M.modsForLevel(30, 60).hidden} verdeckt · Level 120: ${JSON.stringify(M.modsForLevel(120, 60, { rated: true }))}`);

// --- 2. Bretter mit Modifikatoren sind paritätstreu --------------------------
console.log('\n2) Bretter mit Modifikatoren: jede Gruppe gerade');
const figuren = F.allFigures();
let geprueft = 0;
for (let lvl = 1; lvl <= 400; lvl += 7) {
  const fig = figuren[lvl % figuren.length];
  const nb = E.buildNeighbors(fig.cells);
  const { tiles, pairs } = E.generateBoardWithPairs(fig.cells, nb, T.deckForCount(fig.cells.length));
  const mods = M.modsForLevel(lvl, fig.cells.length, { rated: true });
  const mit = M.applyHidden(M.applySpecials(tiles, pairs, mods.specials), mods.hidden);
  const u = ungerade(mit);
  pruef(u.length === 0, `Level ${lvl}: ungerade Gruppen ${JSON.stringify(u)}`);
  pruef(
    mit.filter((t) => t.hidden).length === Math.min(mods.hidden, mit.length),
    `Level ${lvl}: falsche Zahl verdeckter Steine`,
  );
  pruef(!mit.some((t) => t.hidden && t.face.special), `Level ${lvl}: ein Spezialstein liegt verdeckt`);
  geprueft++;
}
console.log(`   ${geprueft} Bretter geprüft`);

// --- 3. Fuzz: Bombe ----------------------------------------------------------
// Nach jeder Zündung muss die Parität halten UND reshuffleBoard darf nicht
// werfen. Ohne diesen Test faellt der Fehler erst auf, wenn ein Spieler in
// einem toten Brett sitzt.
console.log('\n3) Bombe: 4000 Zündungen');
let bomben = 0, geraeumt = 0, uebersprungen = 0;
for (let runde = 0; runde < 4000; runde++) {
  const fig = figuren[(runde * 13) % figuren.length];
  const nb = E.buildNeighbors(fig.cells);
  let { tiles, pairs } = E.generateBoardWithPairs(fig.cells, nb, T.deckForCount(fig.cells.length));
  if (!pairs.length) continue;
  tiles = M.applySpecials(tiles, pairs, ['bomb']);

  const zentren = tiles.filter((t) => t.face.special === 'bomb').map((t) => t.key);
  if (zentren.length !== 2) { pruef(false, `Runde ${runde}: ${zentren.length} Bombensteine statt 2`); continue; }

  // ⚠ Nur zünden, wenn beide Bombensteine FREI liegen — im Spiel lässt sich
  // nichts anderes anklicken (`clickTile` prüft `freeSet`). Ohne diese Bedingung
  // entfernt der Test tragende Steine und erzeugt Schweber, die es im Spiel
  // nie geben kann; er würde dann einen Fehler melden, der keiner ist.
  const p0 = new Uint8Array(tiles.length);
  for (const t of tiles) if (!t.removed) p0[t.key] = 1;
  if (!zentren.every((k) => E.isFreeIdx(k, p0, nb))) { uebersprungen++; continue; }

  let next = tiles.map((t) => (zentren.includes(t.key) ? { ...t, removed: true } : t));
  const p = new Uint8Array(next.length);
  for (const t of next) if (!t.removed) p[t.key] = 1;
  const raus = E.blastSet(next, nb, p, zentren);
  next = next.map((t) => (raus.has(t.key) ? { ...t, removed: true } : t));
  geraeumt += raus.size;
  bomben++;

  const u = ungerade(next);
  if (u.length) { pruef(false, `Runde ${runde}: nach der Bombe ungerade Gruppen ${JSON.stringify(u)}`); break; }

  // Schwebt etwas? Ein Stein ab Ebene 1 braucht einen Stein direkt darunter.
  // Im normalen Spiel gilt das automatisch (man raeumt von oben ab), die Bombe
  // koennte es brechen — `blastSet` filtert deshalb alles heraus, worauf noch
  // etwas liegt.
  const da = new Set(next.filter((t) => !t.removed).map((t) => `${t.layer}:${t.col}:${t.row}`));
  const schwebt = next.find(
    (t) => !t.removed && t.layer > 0 && !da.has(`${t.layer - 1}:${t.col}:${t.row}`),
  );
  if (schwebt) { pruef(false, `Runde ${runde}: Stein ${schwebt.key} schwebt`); break; }

  try {
    E.reshuffleBoard(next, nb);
  } catch (err) {
    pruef(false, `Runde ${runde}: reshuffleBoard hat geworfen — ${err.message}`);
    break;
  }
}
console.log(`   ${bomben} Zündungen · ${uebersprungen} übersprungen (Bomben lagen nicht frei) · im Schnitt ${(geraeumt / Math.max(1, bomben)).toFixed(1)} zusätzliche Steine`);

// --- 4. Fuzz: Joker ----------------------------------------------------------
console.log('\n4) Joker: 4000 Züge gegen zufällige Steine');
let joker = 0;
for (let runde = 0; runde < 4000; runde++) {
  const fig = figuren[(runde * 7) % figuren.length];
  const nb = E.buildNeighbors(fig.cells);
  let { tiles, pairs } = E.generateBoardWithPairs(fig.cells, nb, T.deckForCount(fig.cells.length));
  if (!pairs.length) continue;
  tiles = M.applySpecials(tiles, pairs, ['joker']);

  const jokerKeys = tiles.filter((t) => t.face.special === 'joker').map((t) => t.key);
  if (jokerKeys.length !== 2) { pruef(false, `Runde ${runde}: ${jokerKeys.length} Joker statt 2`); continue; }

  // Joker 1 schlaegt einen beliebigen normalen Stein.
  const opfer = tiles.find((t) => !t.removed && !t.face.special);
  if (!opfer) continue;
  let next = tiles.map((t) => (t.key === jokerKeys[0] || t.key === opfer.key ? { ...t, removed: true } : t));

  // ...und Joker 2 nimmt dessen Gestalt an (genau wie in useGame.clickTile).
  let getauscht = false;
  next = next.map((t) => {
    if (getauscht || t.removed || t.face.special !== 'joker') return t;
    getauscht = true;
    return { ...t, face: { ...opfer.face } };
  });
  joker++;

  const u = ungerade(next);
  if (u.length) { pruef(false, `Runde ${runde}: nach dem Joker ungerade Gruppen ${JSON.stringify(u)}`); break; }
  try {
    E.reshuffleBoard(next, nb);
  } catch (err) {
    pruef(false, `Runde ${runde}: reshuffleBoard hat geworfen — ${err.message}`);
    break;
  }
}
console.log(`   ${joker} Züge`);

// --- 5. Gegenprobe: OHNE die Verwandlung muss es brechen ---------------------
// Ein Test, der nie fehlschlägt, prüft nichts. Hier wird der Fehler absichtlich
// herbeigeführt — schlägt diese Probe NICHT an, ist der Test selbst kaputt.
console.log('\n5) Gegenprobe: ohne Joker-Verwandlung muss die Parität brechen');
{
  const fig = figuren[42];
  const nb = E.buildNeighbors(fig.cells);
  const { tiles, pairs } = E.generateBoardWithPairs(fig.cells, nb, T.deckForCount(fig.cells.length));
  const mit = M.applySpecials(tiles, pairs, ['joker']);
  const jk = mit.filter((t) => t.face.special === 'joker').map((t) => t.key);
  const opfer = mit.find((t) => !t.removed && !t.face.special);
  const ohne = mit.map((t) => (t.key === jk[0] || t.key === opfer.key ? { ...t, removed: true } : t));
  pruef(ungerade(ohne).length === 2, 'Die Gegenprobe schlägt nicht an — der Test misst nichts');
}

console.log(fehler ? `\n❌ ${fehler} Fehler` : '\n✅ alle Prüfungen bestanden');
process.exit(fehler ? 1 : 0);

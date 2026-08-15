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

// --- 6. Memory-Bretter -------------------------------------------------------
// Eine UNGERADE Kartenzahl hieße eine Karte ohne Partner — das Level ließe sich
// nie abschließen. Ebenso muss jede Karte ein Motiv haben (der Vorrat ist
// endlich) und in Stufe 2 dürfen keine Karten schweben.
console.log('\n6) Memory: 200 Level in beiden Stufen');
const MEM = await load('src/modes/memory/board.ts');
let mem = 0, memMax = 0;
for (let lvl = 1; lvl <= 200; lvl++) {
  const { cards, shape } = MEM.baueLevel(lvl);
  pruef(cards.length % 2 === 0, `Memory-Level ${lvl}: ${cards.length} Karten (ungerade)`);
  pruef(cards.length >= 12, `Memory-Level ${lvl}: nur ${cards.length} Karten`);
  pruef(!!shape, `Memory-Level ${lvl}: keine Figur`);
  pruef(cards.every((c) => typeof c.faceId === 'string' && c.faceId), `Memory-Level ${lvl}: Karte ohne Motiv`);

  // Jedes Motiv genau zweimal.
  const zaehl = new Map();
  for (const c of cards) zaehl.set(c.faceId, (zaehl.get(c.faceId) ?? 0) + 1);
  pruef([...zaehl.values()].every((n) => n === 2), `Memory-Level ${lvl}: Motiv nicht genau zweimal`);

  // Stufe 1 ist flach, Stufe 2 gestapelt und ohne Schweber.
  const ebenen = new Set(cards.map((c) => c.layer));
  if (lvl <= MEM.FLACH_BIS) {
    pruef(ebenen.size === 1 && ebenen.has(0), `Memory-Level ${lvl}: Stufe 1 ist nicht flach`);
  } else {
    const da = new Set(cards.map((c) => `${c.layer}:${c.col}:${c.row}`));
    const schwebt = cards.find((c) => c.layer > 0 && !da.has(`${c.layer - 1}:${c.col}:${c.row}`));
    pruef(!schwebt, `Memory-Level ${lvl}: Karte ${schwebt?.key} schwebt`);
  }

  // Determinismus: zweimal derselbe Aufruf, dasselbe Brett.
  pruef(
    JSON.stringify(MEM.baueLevel(lvl).cards) === JSON.stringify(cards),
    `Memory-Level ${lvl}: nicht deterministisch`,
  );

  // Mindestens eine Karte muss frei sein, sonst geht kein einziger Zug.
  pruef(cards.some((c) => !MEM.bedeckt(c, cards)), `Memory-Level ${lvl}: keine freie Karte`);

  mem++;
  memMax = Math.max(memMax, cards.length);
}
console.log(`   ${mem} Level · höchstens ${memMax} Karten`);

// --- 7. Lawine ---------------------------------------------------------------
// Flaches Raster, Paare schlagen, Steine fallen nach. Drei Invarianten:
// (a) Parität — jede Sorte gerade oft, sonst ist das Brett unlösbar;
// (b) Schwerkraft — nach jedem Zug kein Stein über leerer Zelle;
// (c) Liveness — nach jedem Mischen existiert sofort wieder ein Zug.
console.log('\n7) Lawine: 200 Level — Parität, Schwerkraft, Liveness');
const LW = await load('src/modes/lawine/logic.ts');

// Kein Stein über leerer Zelle derselben Spalte (= niemand schwebt).
const lwSchweber = (b) => {
  const da = new Set(b.tiles.map((t) => `${t.r}:${t.c}`));
  return b.tiles.find((t) => t.r < b.rows - 1 && !da.has(`${t.r + 1}:${t.c}`));
};

let lwMisch = 0, lwMaxSteine = 0, lwVorher = null;
for (let lvl = 1; lvl <= 200; lvl++) {
  const cfg = LW.lawineConfig(lvl);
  const b = LW.makeLevel(lvl);

  pruef(b.tiles.length === cfg.rows * cfg.cols, `Lawine-Level ${lvl}: Brett nicht voll`);
  pruef(b.tiles.length % 2 === 0, `Lawine-Level ${lvl}: ${b.tiles.length} Steine (ungerade)`);
  pruef(b.faceIds.length === cfg.faces, `Lawine-Level ${lvl}: Motiv-Vorrat kleiner als die Rampe verlangt`);

  const zaehl = new Map();
  for (const t of b.tiles) zaehl.set(t.face, (zaehl.get(t.face) ?? 0) + 1);
  pruef([...zaehl.values()].every((n) => n % 2 === 0), `Lawine-Level ${lvl}: Sorte ungerade oft`);

  pruef(JSON.stringify(LW.makeLevel(lvl)) === JSON.stringify(b), `Lawine-Level ${lvl}: nicht deterministisch`);
  pruef(!!LW.findAnyPair(b), `Lawine-Level ${lvl}: kein Zug auf dem frischen Brett`);

  // Rampe wächst monoton (rows, Steinzahl, Sorten).
  if (lwVorher) {
    pruef(cfg.rows >= lwVorher.rows, `Lawine-Level ${lvl}: rows fällt`);
    pruef(cfg.rows * cfg.cols >= lwVorher.rows * lwVorher.cols, `Lawine-Level ${lvl}: Steinzahl fällt`);
    pruef(cfg.faces >= lwVorher.faces, `Lawine-Level ${lvl}: Sorten fallen`);
  }
  lwVorher = cfg;
  lwMaxSteine = Math.max(lwMaxSteine, b.tiles.length);

  // Durchspiel-Simulation: greedy matchen bis leer; jede Sackgasse muss das
  // Mischen SOFORT auflösen, und nach jedem Setteln schwebt niemand.
  const rand = E.mulberry32(E.seedFromString('lawine-sim:' + lvl));
  const deckel = b.tiles.length; // n/2 Paare — mehr Züge kann es nicht geben
  let zuege = 0;
  while (b.tiles.length > 0 && zuege < deckel) {
    let pair = LW.findAnyPair(b);
    if (!pair) {
      LW.shuffleRemaining(b, rand);
      lwMisch++;
      pair = LW.findAnyPair(b);
      pruef(!!pair, `Lawine-Level ${lvl}: Mischen ließ keine Sackgasse hinter sich (Liveness verletzt)`);
      if (!pair) break;
    }
    LW.removePair(b, pair[0], pair[1]);
    LW.applyGravity(b);
    const s = lwSchweber(b);
    pruef(!s, `Lawine-Level ${lvl}: Stein ${s?.id} schwebt nach Zug ${zuege}`);
    zuege++;
  }
  pruef(b.tiles.length === 0, `Lawine-Level ${lvl}: nicht leergespielt (${b.tiles.length} übrig)`);
}
console.log(`   200 Level · höchstens ${lwMaxSteine} Steine · ${lwMisch} Rettungs-Mischungen`);

// Notfall-Zweig des Mischens erzwingen: rand ≈ 1 macht Fisher-Yates zur
// Identität — ein totes Brett bleibt 60 Versuche lang tot, erst der Zwangs-
// Tausch schafft das Paar. Beide Ziel-Formen (zwei Spalten / eine Spalte).
{
  const stur = () => 0.999999;
  // Zwei belegte Spalten, Faces übers Kreuz -> kein Zug möglich.
  const zwei = {
    rows: 9, cols: 8, faceIds: ['a', 'b'],
    tiles: [
      { id: 0, face: 0, r: 7, c: 0 }, { id: 1, face: 1, r: 8, c: 0 },
      { id: 2, face: 1, r: 7, c: 5 }, { id: 3, face: 0, r: 8, c: 5 },
    ],
  };
  pruef(!LW.findAnyPair(zwei), 'Lawine-Notfall: das Zwei-Spalten-Brett müsste tot sein');
  LW.shuffleRemaining(zwei, stur);
  pruef(!!LW.findAnyPair(zwei), 'Lawine-Notfall (zwei Spalten): Zwangs-Tausch schafft keinen Zug');
  pruef(!lwSchweber(zwei), 'Lawine-Notfall: Mischen hat Positionen verändert');

  // Eine belegte Spalte, Faces im Wechsel -> senkrecht nie gleich, Linien verstellt.
  const eine = {
    rows: 9, cols: 8, faceIds: ['a', 'b'],
    tiles: [
      { id: 0, face: 0, r: 5, c: 3 }, { id: 1, face: 1, r: 6, c: 3 },
      { id: 2, face: 0, r: 7, c: 3 }, { id: 3, face: 1, r: 8, c: 3 },
    ],
  };
  pruef(!LW.findAnyPair(eine), 'Lawine-Notfall: das Ein-Spalten-Brett müsste tot sein');
  LW.shuffleRemaining(eine, stur);
  pruef(!!LW.findAnyPair(eine), 'Lawine-Notfall (eine Spalte): Zwangs-Tausch schafft keinen Zug');
}

// Gegenproben — ein Test, der nie anschlägt, prüft nichts.
{
  // (a) Schweber absichtlich erzeugen: untersten Stein einer Spalte entfernen,
  // OHNE applyGravity — der Invarianten-Wächter MUSS ihn melden.
  const b = LW.makeLevel(1);
  const unten = b.tiles.find((t) => t.r === b.rows - 1);
  b.tiles = b.tiles.filter((t) => t !== unten);
  pruef(!!lwSchweber(b), 'Lawine-Gegenprobe: der Schweber-Wächter schlägt nicht an — er misst nichts');

  // (b) Verstellte Linie darf NICHT matchen: gleiche Sorte mit Stein dazwischen,
  // beide unter Deckel-Steinen (sonst griffe die Oben-frei-Regel zu Recht).
  const blockiert = {
    rows: 2, cols: 3, faceIds: ['a', 'b'],
    tiles: [
      { id: 0, face: 0, r: 1, c: 0 }, { id: 1, face: 1, r: 1, c: 1 }, { id: 2, face: 0, r: 1, c: 2 },
      { id: 3, face: 1, r: 0, c: 0 }, { id: 4, face: 1, r: 0, c: 2 },
    ],
  };
  pruef(!LW.canMatch(blockiert, 0, 2), 'Lawine-Gegenprobe: verstellte Linie gilt fälschlich als frei');
  // (c) Oben-frei-Regel selbst: Deckel weg -> dasselbe Paar MUSS matchen.
  const offen = { ...blockiert, tiles: blockiert.tiles.slice(0, 3) };
  pruef(LW.canMatch(offen, 0, 2), 'Lawine-Gegenprobe: Oben-frei-Regel greift nicht');
}

console.log(fehler ? `\n❌ ${fehler} Fehler` : '\n✅ alle Prüfungen bestanden');
process.exit(fehler ? 1 : 0);

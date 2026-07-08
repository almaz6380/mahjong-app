// Mahjong Crush — Level-Engine über den Match-3-Primitiven (logic.ts).
//
// Zellmodell:
//   g[i]    >= 0      Steinsorte 0..k-1
//   g[i] === EMPTY    leer (nur während der Auflösung)
//   g[i] === DRAGON   Drachen-Bombe (sortenlos; Tausch mit Stein löscht dessen Sorte)
//   g[i] === BLOCKED  Jade-Block (armor[i] > 0), fällt nicht, bricht durch Nachbar-Matches
//   spec[i] === LINE  Reihen-Blitz: löscht beim Auslösen Zeile + Spalte
//
// Entstehung: 4er-Reihe -> Reihen-Blitz, 5er-Reihe oder L/T-Kreuzung -> Drache.

import { ROWS, COLS, adjacent, type Grid } from './logic';
import type { Goal, LevelDef } from './levels';
import { mulberry32 } from '../../game/engine';

export const N = ROWS * COLS;
export const EMPTY = -1;
export const DRAGON = -2;
export const BLOCKED = -3;
export const LINE = 1;

type Rng = () => number;
const idx = (r: number, c: number) => r * COLS + c;

export interface CrushState {
  def: LevelDef;
  g: Grid;
  spec: number[];
  armor: number[];
  movesLeft: number;
  score: number;
  collected: number[]; // pro Sorte
  blocksLeft: number;
  status: 'play' | 'win' | 'lose';
}

export interface MoveResult {
  ok: boolean;
  cleared: number;
  cascades: number;
  spawnedLine: boolean;
  spawnedDragon: boolean;
  brokeBlock: boolean;
  reshuffled: boolean;
}

const NO_MOVE: MoveResult = { ok: false, cleared: 0, cascades: 0, spawnedLine: false, spawnedDragon: false, brokeBlock: false, reshuffled: false };

// --- Brett-Aufbau ------------------------------------------------------------

export function makeLevel(def: LevelDef): CrushState {
  const rand = mulberry32(def.seed);
  const armor = new Array(N).fill(0);
  for (const b of def.blocks) armor[b.cell] = b.armor;

  let g: Grid = [];
  for (let tries = 0; tries < 200; tries++) {
    g = fillBoard(armor, def.k, rand);
    if (findRuns(g).length === 0 && hasValidMove(g, armor)) break;
  }
  return {
    def,
    g,
    spec: new Array(N).fill(0),
    armor: armor.slice(),
    movesLeft: def.moves,
    score: 0,
    collected: new Array(def.k).fill(0),
    blocksLeft: def.blocks.length,
    status: 'play',
  };
}

function fillBoard(armor: number[], k: number, rand: Rng): Grid {
  const g = new Array(N).fill(EMPTY);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = idx(r, c);
      if (armor[i] > 0) { g[i] = BLOCKED; continue; }
      const bad = new Set<number>();
      if (c >= 2 && g[idx(r, c - 1)] === g[idx(r, c - 2)] && g[idx(r, c - 1)] >= 0) bad.add(g[idx(r, c - 1)]);
      if (r >= 2 && g[idx(r - 1, c)] === g[idx(r - 2, c)] && g[idx(r - 1, c)] >= 0) bad.add(g[idx(r - 1, c)]);
      const opts: number[] = [];
      for (let v = 0; v < k; v++) if (!bad.has(v)) opts.push(v);
      g[i] = opts[(rand() * opts.length) | 0];
    }
  }
  return g;
}

// --- Runs (3+ gleiche in Reihe/Spalte) ---------------------------------------

export function findRuns(g: Grid): number[][] {
  const runs: number[][] = [];
  const flush = (buf: number[]) => { if (buf.length >= 3) runs.push(buf.slice()); };
  for (let r = 0; r < ROWS; r++) {
    let buf: number[] = [];
    for (let c = 0; c < COLS; c++) {
      const i = idx(r, c);
      if (g[i] >= 0 && buf.length && g[i] === g[buf[buf.length - 1]]) buf.push(i);
      else { flush(buf); buf = g[i] >= 0 ? [i] : []; }
    }
    flush(buf);
  }
  for (let c = 0; c < COLS; c++) {
    let buf: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      const i = idx(r, c);
      if (g[i] >= 0 && buf.length && g[i] === g[buf[buf.length - 1]]) buf.push(i);
      else { flush(buf); buf = g[i] >= 0 ? [i] : []; }
    }
    flush(buf);
  }
  return runs;
}

// --- Zug-Gültigkeit -----------------------------------------------------------

function isTile(v: number): boolean {
  return v >= 0 || v === DRAGON;
}

export function validSwap(st: CrushState, a: number, b: number): boolean {
  if (!adjacent(a, b) || !isTile(st.g[a]) || !isTile(st.g[b])) return false;
  if (st.g[a] === DRAGON || st.g[b] === DRAGON) return true;
  const sw = st.g.slice();
  [sw[a], sw[b]] = [sw[b], sw[a]];
  return findRuns(sw).length > 0;
}

export function hasValidMove(g: Grid, armor: number[]): boolean {
  for (let i = 0; i < N; i++) {
    if (!isTile(g[i])) continue;
    for (const j of [i + 1, i + COLS]) {
      if (j >= N || !adjacent(i, j) || !isTile(g[j])) continue;
      if (g[i] === DRAGON || g[j] === DRAGON) return true;
      const sw = g.slice();
      [sw[i], sw[j]] = [sw[j], sw[i]];
      if (findRuns(sw).length > 0) return true;
    }
  }
  return false;
}

// --- Ziele ---------------------------------------------------------------------

export function goalProgress(st: CrushState, goal: Goal): { have: number; target: number } {
  if (goal.kind === 'score') return { have: Math.min(st.score, goal.target), target: goal.target };
  if (goal.kind === 'collect') return { have: Math.min(st.collected[goal.sort] ?? 0, goal.target), target: goal.target };
  return { have: st.def.blocks.length - st.blocksLeft, target: st.def.blocks.length };
}

export function goalsMet(st: CrushState): boolean {
  return st.def.goals.every((goal) => {
    const p = goalProgress(st, goal);
    return p.have >= p.target;
  });
}

export function starsFor(def: LevelDef, movesLeft: number): number {
  if (movesLeft >= Math.ceil(def.moves * 0.35)) return 3;
  if (movesLeft >= Math.ceil(def.moves * 0.15)) return 2;
  return 1;
}

// --- Zug ausführen ---------------------------------------------------------------

export function applyMove(prev: CrushState, a: number, b: number, rand: Rng = Math.random): { st: CrushState; res: MoveResult } {
  if (prev.status !== 'play' || !validSwap(prev, a, b)) return { st: prev, res: NO_MOVE };

  const st: CrushState = {
    ...prev,
    g: prev.g.slice(),
    spec: prev.spec.slice(),
    armor: prev.armor.slice(),
    collected: prev.collected.slice(),
  };
  const res: MoveResult = { ok: true, cleared: 0, cascades: 0, spawnedLine: false, spawnedDragon: false, brokeBlock: false, reshuffled: false };

  [st.g[a], st.g[b]] = [st.g[b], st.g[a]];
  [st.spec[a], st.spec[b]] = [st.spec[b], st.spec[a]];
  st.movesLeft--;

  // Startmenge der zu löschenden Zellen bestimmen.
  let clearSet: Set<number>;
  if (st.g[a] === DRAGON || st.g[b] === DRAGON) {
    clearSet = new Set<number>();
    if (st.g[a] === DRAGON && st.g[b] === DRAGON) {
      for (let i = 0; i < N; i++) if (isTile(st.g[i])) clearSet.add(i);
    } else {
      const dragonAt = st.g[a] === DRAGON ? a : b;
      const sort = st.g[dragonAt === a ? b : a];
      clearSet.add(dragonAt);
      for (let i = 0; i < N; i++) if (st.g[i] === sort) clearSet.add(i);
    }
  } else {
    clearSet = collectWithSpawns(st, res, [a, b]);
  }

  // Kaskaden auflösen.
  for (let guard = 0; guard < 40 && clearSet.size > 0; guard++) {
    res.cascades++;
    expandDetonations(st, clearSet);
    damageArmor(st, res, clearSet);
    res.cleared += clearSet.size;
    st.score += clearSet.size * (10 + 5 * (res.cascades - 1));
    for (const i of clearSet) {
      if (st.g[i] >= 0) st.collected[st.g[i]] = (st.collected[st.g[i]] ?? 0) + 1;
      st.g[i] = EMPTY;
      st.spec[i] = 0;
    }
    collapse(st, rand);
    clearSet = collectWithSpawns(st, res, null);
  }

  // Sackgasse -> mischen (Panzer + Spezialsteine bleiben erhalten).
  if (!hasValidMove(st.g, st.armor)) {
    reshuffle(st, rand);
    res.reshuffled = true;
  }

  if (goalsMet(st)) st.status = 'win';
  else if (st.movesLeft <= 0) st.status = 'lose';

  return { st, res };
}

// Runs finden, Spezialsteine daraus entstehen lassen, Rest als Löschmenge liefern.
// prefer: beim Spieler-Zug entstehen Spezialsteine bevorzugt auf der getauschten Zelle.
function collectWithSpawns(st: CrushState, res: MoveResult, prefer: number[] | null): Set<number> {
  const runs = findRuns(st.g);
  const clear = new Set<number>();
  if (runs.length === 0) return clear;

  const runCount = new Map<number, number>();
  for (const run of runs) for (const i of run) runCount.set(i, (runCount.get(i) ?? 0) + 1);

  const spawned = new Set<number>();
  const spawnAt = (run: number[], kind: 'line' | 'dragon', at?: number) => {
    const cell = at ?? (prefer?.find((p) => run.includes(p)) ?? run[(run.length / 2) | 0]);
    if (kind === 'dragon') { st.g[cell] = DRAGON; st.spec[cell] = 0; res.spawnedDragon = true; }
    else { st.spec[cell] = LINE; res.spawnedLine = true; }
    spawned.add(cell);
  };

  for (const run of runs) {
    // L/T-Kreuzung: Zelle liegt in 2 Runs -> Drache an der Kreuzung.
    const cross = run.find((i) => (runCount.get(i) ?? 0) > 1 && !spawned.has(i));
    if (run.length >= 5) spawnAt(run, 'dragon');
    else if (cross !== undefined) spawnAt(run, 'dragon', cross);
    else if (run.length === 4) spawnAt(run, 'line');
    for (const i of run) clear.add(i);
  }
  for (const i of spawned) clear.delete(i);
  return clear;
}

// Reihen-Blitze in der Löschmenge zünden (transitiv).
function expandDetonations(st: CrushState, clearSet: Set<number>) {
  const queue = [...clearSet];
  while (queue.length) {
    const i = queue.pop()!;
    if (st.spec[i] !== LINE) continue;
    const r = (i / COLS) | 0, c = i % COLS;
    for (let cc = 0; cc < COLS; cc++) {
      const j = idx(r, cc);
      if (isTile(st.g[j]) && !clearSet.has(j)) { clearSet.add(j); queue.push(j); }
    }
    for (let rr = 0; rr < ROWS; rr++) {
      const j = idx(rr, c);
      if (isTile(st.g[j]) && !clearSet.has(j)) { clearSet.add(j); queue.push(j); }
    }
  }
}

// Jade-Blöcke neben gelöschten Zellen beschädigen.
function damageArmor(st: CrushState, res: MoveResult, clearSet: Set<number>) {
  for (const i of clearSet) {
    const r = (i / COLS) | 0, c = i % COLS;
    const nbs = [
      r > 0 ? idx(r - 1, c) : -1,
      r < ROWS - 1 ? idx(r + 1, c) : -1,
      c > 0 ? idx(r, c - 1) : -1,
      c < COLS - 1 ? idx(r, c + 1) : -1,
    ];
    for (const j of nbs) {
      if (j < 0 || st.armor[j] <= 0) continue;
      st.armor[j]--;
      if (st.armor[j] === 0) {
        st.g[j] = EMPTY;
        st.blocksLeft--;
        res.brokeBlock = true;
      }
    }
  }
}

// Schwerkraft je Spalte, segmentweise zwischen Jade-Blöcken; oben füllt zufällig auf.
function collapse(st: CrushState, rand: Rng) {
  const { g, spec, armor } = st;
  const k = st.def.k;
  for (let c = 0; c < COLS; c++) {
    let r = ROWS - 1;
    while (r >= 0) {
      if (armor[idx(r, c)] > 0) { r--; continue; }
      let top = r;
      while (top - 1 >= 0 && armor[idx(top - 1, c)] === 0) top--;
      const keep: [number, number][] = [];
      for (let rr = r; rr >= top; rr--) {
        const i = idx(rr, c);
        if (g[i] !== EMPTY) keep.push([g[i], spec[i]]);
      }
      let ki = 0;
      for (let rr = r; rr >= top; rr--) {
        const i = idx(rr, c);
        if (ki < keep.length) { g[i] = keep[ki][0]; spec[i] = keep[ki][1]; ki++; }
        else { g[i] = (rand() * k) | 0; spec[i] = 0; }
      }
      r = top - 1;
    }
  }
}

// Booster „Mischen": Brett neu verteilen, ohne einen Zug zu verbrauchen.
export function shuffleBoard(prev: CrushState, rand: Rng = Math.random): CrushState {
  const st: CrushState = { ...prev, g: prev.g.slice(), spec: prev.spec.slice(), armor: prev.armor.slice() };
  reshuffle(st, rand);
  return st;
}

// Steine (inkl. Spezialsteine) auf den freien Zellen neu verteilen.
function reshuffle(st: CrushState, rand: Rng) {
  const cells: number[] = [];
  for (let i = 0; i < N; i++) if (st.armor[i] === 0) cells.push(i);
  for (let tries = 0; tries < 80; tries++) {
    const vals = cells.map((i) => [st.g[i], st.spec[i]] as [number, number]);
    for (let n = vals.length - 1; n > 0; n--) {
      const m = (rand() * (n + 1)) | 0;
      [vals[n], vals[m]] = [vals[m], vals[n]];
    }
    cells.forEach((i, n) => { st.g[i] = vals[n][0]; st.spec[i] = vals[n][1]; });
    if (findRuns(st.g).length === 0 && hasValidMove(st.g, st.armor)) return;
  }
  // Notausgang: komplett neu füllen (Spezialsteine gehen verloren).
  const fresh = fillBoard(st.armor, st.def.k, rand);
  for (let i = 0; i < N; i++) { st.g[i] = fresh[i]; st.spec[i] = 0; }
}

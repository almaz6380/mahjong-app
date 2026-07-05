// Match-3-Logik (headless, testbar). Grid = number[rows*cols], Wert = Sorte 0..K-1.

export const ROWS = 8;
export const COLS = 7;
export const K = 6; // Anzahl Stein-Sorten
export const MOVES = 25;

export type Grid = number[];
const N = ROWS * COLS;
const idx = (r: number, c: number) => r * COLS + c;

export function fill(rand: () => number = Math.random): Grid {
  const g = new Array(N).fill(-1);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const bad = new Set<number>();
      if (c >= 2 && g[idx(r, c - 1)] === g[idx(r, c - 2)]) bad.add(g[idx(r, c - 1)]);
      if (r >= 2 && g[idx(r - 1, c)] === g[idx(r - 2, c)]) bad.add(g[idx(r - 1, c)]);
      const opts = [];
      for (let v = 0; v < K; v++) if (!bad.has(v)) opts.push(v);
      g[idx(r, c)] = opts[(rand() * opts.length) | 0];
    }
  }
  return g;
}

export function findMatches(g: Grid): Set<number> {
  const m = new Set<number>();
  // horizontal
  for (let r = 0; r < ROWS; r++) {
    let run = 1;
    for (let c = 1; c < COLS; c++) {
      if (g[idx(r, c)] === g[idx(r, c - 1)] && g[idx(r, c)] >= 0) run++;
      else { if (run >= 3) for (let k = 0; k < run; k++) m.add(idx(r, c - 1 - k)); run = 1; }
    }
    if (run >= 3) for (let k = 0; k < run; k++) m.add(idx(r, COLS - 1 - k));
  }
  // vertikal
  for (let c = 0; c < COLS; c++) {
    let run = 1;
    for (let r = 1; r < ROWS; r++) {
      if (g[idx(r, c)] === g[idx(r - 1, c)] && g[idx(r, c)] >= 0) run++;
      else { if (run >= 3) for (let k = 0; k < run; k++) m.add(idx(r - 1 - k, c)); run = 1; }
    }
    if (run >= 3) for (let k = 0; k < run; k++) m.add(idx(ROWS - 1 - k, c));
  }
  return m;
}

export function adjacent(a: number, b: number): boolean {
  const ra = (a / COLS) | 0, ca = a % COLS, rb = (b / COLS) | 0, cb = b % COLS;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

export function swapped(g: Grid, a: number, b: number): Grid {
  const n = g.slice();
  [n[a], n[b]] = [n[b], n[a]];
  return n;
}

// Kaskaden auflösen: löschen -> nachrücken -> auffüllen -> wiederholen.
export function resolve(g: Grid, rand: () => number = Math.random): { grid: Grid; cleared: number; cascades: number } {
  let grid = g.slice();
  let cleared = 0;
  let cascades = 0;
  for (let guard = 0; guard < 60; guard++) {
    const m = findMatches(grid);
    if (m.size === 0) break;
    cleared += m.size;
    cascades++;
    for (const i of m) grid[i] = -1;
    // Gravity je Spalte
    for (let c = 0; c < COLS; c++) {
      const col: number[] = [];
      for (let r = ROWS - 1; r >= 0; r--) if (grid[idx(r, c)] >= 0) col.push(grid[idx(r, c)]);
      for (let r = ROWS - 1, k = 0; r >= 0; r--, k++) {
        grid[idx(r, c)] = k < col.length ? col[k] : (rand() * K) | 0;
      }
    }
  }
  return { grid, cleared, cascades };
}

export function anyValidMove(g: Grid): boolean {
  for (let i = 0; i < N; i++) {
    for (const j of [i + 1, i + COLS]) {
      if (j < N && adjacent(i, j) && findMatches(swapped(g, i, j)).size > 0) return true;
    }
  }
  return false;
}

// Startbrett ohne bestehende Matches und mit mindestens einem gültigen Zug.
export function newBoard(rand: () => number = Math.random): Grid {
  for (let tries = 0; tries < 200; tries++) {
    const g = fill(rand);
    if (findMatches(g).size === 0 && anyValidMove(g)) return g;
  }
  return fill(rand);
}

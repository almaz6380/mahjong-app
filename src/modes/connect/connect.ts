// Mahjong Connect (Lianliankan) — headless Engine.
// Gepolstertes Gitter: W = cols+2, H = rows+2; der 1 Zelle breite Rand ist EMPTY,
// damit Verbindungswege außen um das Brett herum laufen können.
// Zwei gleiche, freie Steine sind verbindbar, wenn ein Weg aus waagerechten/
// senkrechten Segmenten mit höchstens 2 Richtungswechseln durch leere Felder passt.

export const EMPTY = -1;

export interface Board {
  W: number;
  H: number;
  rows: number;
  cols: number;
  g: number[]; // Länge W*H; EMPTY oder Face-Index 0..faceIds.length-1
  faceIds: string[]; // Index -> Tile-Face-id
}

type Rng = () => number;
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

export const rc = (b: Board, i: number) => ({ r: (i / b.W) | 0, c: i % b.W });
export const cellIndex = (b: Board, r: number, c: number) => r * b.W + c;
// Innenkoordinate (0-basiert) -> gepolsterter Index
export const inner = (b: Board, r: number, c: number) => (r + 1) * b.W + (c + 1);

export function makeBoard(rows: number, cols: number, faceIds: string[], rand: Rng = Math.random): Board {
  const W = cols + 2, H = rows + 2;
  const g = new Array(W * H).fill(EMPTY);
  const n = rows * cols; // muss gerade sein
  const pairs = n >> 1;
  const vals: number[] = [];
  for (let i = 0; i < pairs; i++) {
    const f = i % faceIds.length;
    vals.push(f, f);
  }
  for (let i = vals.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [vals[i], vals[j]] = [vals[j], vals[i]];
  }
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g[(r + 1) * W + (c + 1)] = vals[k++];
  const b: Board = { W, H, rows, cols, g, faceIds };
  if (!findAnyPair(b)) shuffleRemaining(b, rand);
  return b;
}

// Verbindungsweg zwischen a und b (gepolsterte Indizes) oder null.
// BFS über Zustände (Zelle, Richtung, Kurvenzahl) — max. 2 Kurven; gibt die
// Zellfolge a..bi für die Pfad-Animation zurück.
export function canConnect(b: Board, a: number, bi: number): number[] | null {
  const { g } = b;
  if (a === bi || g[a] === EMPTY || g[bi] === EMPTY || g[a] !== g[bi]) return null;
  const passable = (i: number) => i === bi || g[i] === EMPTY;
  return bfsPath(b, a, bi, passable);
}

// BFS auf Zuständen (cell,dir,turns) mit Kurven-Limit; speichert Elternzustand
// je Zustand und verfolgt den Weg zurück.
function bfsPath(b: Board, a: number, bi: number, passable: (i: number) => boolean): number[] | null {
  const { W, H } = b;
  const key = (cell: number, dir: number, turns: number) => (cell * 4 + dir) * 3 + turns;
  const parent = new Map<number, { pcell: number; pdir: number; pturns: number } | null>();
  const visited = new Set<number>();
  const queue: { cell: number; dir: number; turns: number }[] = [];
  for (let d = 0; d < 4; d++) {
    const nr = ((a / W) | 0) + DIRS[d][0];
    const nc = (a % W) + DIRS[d][1];
    if (nr < 0 || nc < 0 || nr >= H || nc >= W) continue;
    const n = nr * W + nc;
    if (!passable(n)) continue;
    const kk = key(n, d, 0);
    if (visited.has(kk)) continue;
    visited.add(kk);
    parent.set(kk, null);
    queue.push({ cell: n, dir: d, turns: 0 });
  }
  let head = 0;
  while (head < queue.length) {
    const st = queue[head++];
    if (st.cell === bi) {
      const path: number[] = [];
      let cur: { cell: number; dir: number; turns: number } | null = st;
      while (cur) {
        path.push(cur.cell);
        const p = parent.get(key(cur.cell, cur.dir, cur.turns));
        cur = p ? { cell: p.pcell, dir: p.pdir, turns: p.pturns } : null;
      }
      path.push(a);
      path.reverse();
      return path;
    }
    for (let d = 0; d < 4; d++) {
      const nturns = st.turns + (d === st.dir ? 0 : 1);
      if (nturns > 2) continue;
      const nr = ((st.cell / W) | 0) + DIRS[d][0];
      const nc = (st.cell % W) + DIRS[d][1];
      if (nr < 0 || nc < 0 || nr >= H || nc >= W) continue;
      const n = nr * W + nc;
      if (!passable(n)) continue;
      const kk = key(n, d, nturns);
      if (visited.has(kk)) continue;
      visited.add(kk);
      parent.set(kk, { pcell: st.cell, pdir: st.dir, pturns: st.turns });
      queue.push({ cell: n, dir: d, turns: nturns });
    }
  }
  return null;
}

export function findAnyPair(b: Board): [number, number] | null {
  const { g } = b;
  const byFace = new Map<number, number[]>();
  for (let i = 0; i < g.length; i++) {
    if (g[i] === EMPTY) continue;
    (byFace.get(g[i]) ?? byFace.set(g[i], []).get(g[i])!).push(i);
  }
  for (const cells of byFace.values()) {
    for (let x = 0; x < cells.length; x++)
      for (let y = x + 1; y < cells.length; y++)
        if (canConnect(b, cells[x], cells[y])) return [cells[x], cells[y]];
  }
  return null;
}

export function removePair(b: Board, a: number, bi: number) {
  b.g[a] = EMPTY;
  b.g[bi] = EMPTY;
}

export function remaining(b: Board): number {
  let n = 0;
  for (const v of b.g) if (v !== EMPTY) n++;
  return n;
}

export function isCleared(b: Board): boolean {
  return remaining(b) === 0;
}

// Reststeine neu verteilen, bis mindestens ein verbindbares Paar existiert.
// Garantie: falls Zufall scheitert, zwei gleiche Steine nebeneinander erzwingen.
export function shuffleRemaining(b: Board, rand: Rng = Math.random) {
  const cells: number[] = [];
  for (let i = 0; i < b.g.length; i++) if (b.g[i] !== EMPTY) cells.push(i);
  if (cells.length < 2) return;
  for (let tries = 0; tries < 60; tries++) {
    const vals = cells.map((i) => b.g[i]);
    for (let i = vals.length - 1; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      [vals[i], vals[j]] = [vals[j], vals[i]];
    }
    cells.forEach((i, k) => (b.g[i] = vals[k]));
    if (findAnyPair(b)) return;
  }
  // Notfall-Garantie: gleiche Sorte in zwei horizontal benachbarte Zellen legen.
  const byFace = new Map<number, number[]>();
  for (const i of cells) (byFace.get(b.g[i]) ?? byFace.set(b.g[i], []).get(b.g[i])!).push(i);
  let face = -1;
  for (const [f, cs] of byFace) if (cs.length >= 2) { face = f; break; }
  if (face < 0) return;
  for (const i of cells) {
    const right = i + 1;
    if (cells.includes(right) && (i % b.W) + 1 < b.W - 1) {
      // Tausche so, dass i und right beide 'face' tragen.
      swapValueInto(b, cells, i, face);
      swapValueInto(b, cells, right, face);
      return;
    }
  }
}

function swapValueInto(b: Board, cells: number[], target: number, face: number) {
  if (b.g[target] === face) return;
  const src = cells.find((i) => b.g[i] === face && i !== target);
  if (src === undefined) return;
  [b.g[target], b.g[src]] = [b.g[src], b.g[target]];
}

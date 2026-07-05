// Mahjong-2048-Logik (headless, testbar). Raster 4x4, Werte = Stufe 1..11.

export const SIZE = 4;
export const MAX = 11;
export type Dir = 'up' | 'down' | 'left' | 'right';
export type Grid = number[]; // Länge 16, 0 = leer

export function emptyGrid(): Grid {
  return new Array(SIZE * SIZE).fill(0);
}

export function spawn(grid: Grid, rand: () => number = Math.random): boolean {
  const free: number[] = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] === 0) free.push(i);
  if (!free.length) return false;
  const idx = free[(rand() * free.length) | 0];
  grid[idx] = rand() < 0.1 ? 2 : 1; // meist Stufe 1
  return true;
}

function collapse(vals: number[]): { out: number[]; gained: number } {
  const f = vals.filter((v) => v > 0);
  const res: number[] = [];
  let gained = 0;
  for (let i = 0; i < f.length; i++) {
    if (i + 1 < f.length && f[i] === f[i + 1] && f[i] < MAX) {
      const nl = f[i] + 1;
      res.push(nl);
      gained += 1 << nl;
      i++;
    } else {
      res.push(f[i]);
    }
  }
  while (res.length < SIZE) res.push(0);
  return { out: res, gained };
}

// Indizes einer Linie in Zugrichtung (von „vorne" nach „hinten").
function lineIndices(dir: Dir, k: number): number[] {
  const idx: number[] = [];
  for (let i = 0; i < SIZE; i++) {
    if (dir === 'left') idx.push(k * SIZE + i);
    else if (dir === 'right') idx.push(k * SIZE + (SIZE - 1 - i));
    else if (dir === 'up') idx.push(i * SIZE + k);
    else idx.push((SIZE - 1 - i) * SIZE + k);
  }
  return idx;
}

export function move(grid: Grid, dir: Dir): { grid: Grid; moved: boolean; gained: number } {
  const next = grid.slice();
  let moved = false;
  let gained = 0;
  for (let k = 0; k < SIZE; k++) {
    const idx = lineIndices(dir, k);
    const vals = idx.map((i) => grid[i]);
    const { out, gained: g } = collapse(vals);
    gained += g;
    idx.forEach((i, p) => {
      if (next[i] !== out[p]) moved = true;
      next[i] = out[p];
    });
  }
  return { grid: next, moved, gained };
}

export function canMove(grid: Grid): boolean {
  return (['up', 'down', 'left', 'right'] as Dir[]).some((d) => move(grid, d).moved);
}

export function newGame(rand: () => number = Math.random): Grid {
  const g = emptyGrid();
  spawn(g, rand);
  spawn(g, rand);
  return g;
}

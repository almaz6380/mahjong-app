// Mahjong Dimensions — 3D-Solitaire (drehbarer Steinturm), headless & testbar.
// Steine liegen in einem gestuften 3D-Gitter (x,y,z). Ein Stein ist FREI, wenn
// nichts direkt darüber liegt UND mindestens eine der vier Seiten offen ist.
// Bretter werden GARANTIERT lösbar erzeugt (Paare in einer gültigen Abräumreihenfolge).

import { buildDeck } from '../../game/tiles';

export interface Cell { x: number; y: number; z: number; }
export interface DTile { id: number; face: string; x: number; y: number; z: number; removed: boolean; }
export interface Board {
  tiles: DTile[];
  solution: [number, number][]; // garantierte Löse-Paare (in Reihenfolge)
}
type Rng = () => number;

export const FACES: string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of buildDeck()) if (!seen.has(f.id)) { seen.add(f.id); out.push(f.id); }
  return out;
})();

// Gestufte, zentrierte Quadrat-Ebenen (Pyramidenturm). base ungerade.
export function genCells(base: number): Cell[] {
  const cells: Cell[] = [];
  let z = 0;
  for (let size = base; size >= 1; size -= 2, z++) {
    const off = (base - size) / 2;
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) cells.push({ x: off + c, y: off + r, z });
  }
  if (cells.length % 2 !== 0) cells.pop(); // gerade Anzahl (oberste Zelle weg)
  return cells;
}

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

function freeInSet(cell: Cell, present: Set<string>): boolean {
  if (present.has(key(cell.x, cell.y, cell.z + 1))) return false; // etwas liegt darüber
  const sides = [
    key(cell.x - 1, cell.y, cell.z), key(cell.x + 1, cell.y, cell.z),
    key(cell.x, cell.y - 1, cell.z), key(cell.x, cell.y + 1, cell.z),
  ];
  return sides.some((k) => !present.has(k)); // mind. eine Seite offen
}

export function makeBoard(level: number, rand: Rng = Math.random): Board {
  const base = Math.min(5 + 2 * Math.floor((level - 1) / 2), 9); // 5,5,7,7,9,...
  const faceCount = Math.min(FACES.length, 12 + level);
  const faceList = [...FACES].sort(() => rand() - 0.5).slice(0, faceCount);

  for (let attempt = 0; attempt < 30; attempt++) {
    const cells = genCells(base);
    const present = new Set(cells.map((c) => key(c.x, c.y, c.z)));
    const idxByKey = new Map(cells.map((c, i) => [key(c.x, c.y, c.z), i]));
    const faces = new Array<string>(cells.length);
    const solution: [number, number][] = [];
    let k = 0, stuck = false;

    while (present.size > 0) {
      const free: number[] = [];
      for (const kk of present) {
        const i = idxByKey.get(kk)!;
        if (freeInSet(cells[i], present)) free.push(i);
      }
      if (free.length < 2) { stuck = true; break; }
      for (let i = free.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [free[i], free[j]] = [free[j], free[i]]; }
      const a = free[0], b = free[1];
      const f = faceList[k % faceList.length];
      faces[a] = f; faces[b] = f; k++;
      present.delete(key(cells[a].x, cells[a].y, cells[a].z));
      present.delete(key(cells[b].x, cells[b].y, cells[b].z));
      solution.push([a, b]);
    }
    if (stuck) continue;
    const tiles: DTile[] = cells.map((c, i) => ({ id: i, face: faces[i], x: c.x, y: c.y, z: c.z, removed: false }));
    return { tiles, solution };
  }
  // Fallback (sollte nicht eintreten)
  const cells = genCells(base);
  return { tiles: cells.map((c, i) => ({ id: i, face: FACES[i % FACES.length], x: c.x, y: c.y, z: c.z, removed: false })), solution: [] };
}

function presentSet(board: Board): Set<string> {
  const s = new Set<string>();
  for (const t of board.tiles) if (!t.removed) s.add(key(t.x, t.y, t.z));
  return s;
}

export function isFree(board: Board, id: number, present = presentSet(board)): boolean {
  const t = board.tiles[id];
  if (!t || t.removed) return false;
  return freeInSet(t, present);
}

export function freeTiles(board: Board): number[] {
  const present = presentSet(board);
  return board.tiles.filter((t) => !t.removed && freeInSet(t, present)).map((t) => t.id);
}

export function canMatch(board: Board, a: number, b: number): boolean {
  if (a === b) return false;
  const ta = board.tiles[a], tb = board.tiles[b];
  if (!ta || !tb || ta.removed || tb.removed || ta.face !== tb.face) return false;
  const present = presentSet(board);
  return freeInSet(ta, present) && freeInSet(tb, present);
}

export function removePair(board: Board, a: number, b: number) {
  board.tiles[a].removed = true;
  board.tiles[b].removed = true;
}

export function isWon(board: Board): boolean {
  return board.tiles.every((t) => t.removed);
}

export function findHint(board: Board): [number, number] | null {
  const free = freeTiles(board);
  for (let i = 0; i < free.length; i++)
    for (let j = i + 1; j < free.length; j++)
      if (board.tiles[free[i]].face === board.tiles[free[j]].face) return [free[i], free[j]];
  return null;
}

export function hasMoves(board: Board): boolean {
  return findHint(board) !== null;
}

export function remaining(board: Board): number {
  return board.tiles.filter((t) => !t.removed).length;
}

// Booster: Faces der verbleibenden Steine neu verteilen.
export function shuffleRemaining(board: Board, rand: Rng = Math.random) {
  const rest = board.tiles.filter((t) => !t.removed);
  const faces = rest.map((t) => t.face);
  for (let i = faces.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [faces[i], faces[j]] = [faces[j], faces[i]]; }
  rest.forEach((t, i) => (t.face = faces[i]));
}

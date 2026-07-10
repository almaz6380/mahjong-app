// Tile Match ("Dreier-Match") — headless Engine, testbar.
// Steine liegen in überlappenden Ebenen (Pyramide). Ein Stein ist antippbar (frei),
// wenn kein Stein einer höheren Ebene ihn überdeckt. Getippte Steine wandern in eine
// 7-Slot-Ablage; liegen 3 gleiche dort, verschwinden sie.

import { buildDeck } from '../../game/tiles';

export const TRAY_SIZE = 7;

export type TileState = 'board' | 'tray' | 'cleared';
export interface MTile {
  id: number;
  face: string; // Face-id (Match nach exakter id)
  x: number;
  y: number;
  layer: number;
  state: TileState;
}
export interface Board {
  tiles: MTile[];
  tray: number[]; // Reihenfolge der Tile-ids in der Ablage
  solution: number[]; // garantierte Löse-Reihenfolge (aufeinanderfolgende Tripel) – für Tipp/Test
}

type Rng = () => number;

// Verschiedene Steinsorten (wie in Memory): 34 eindeutige Motive.
export const FACES: string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of buildDeck()) if (!seen.has(f.id)) { seen.add(f.id); out.push(f.id); }
  return out;
})();

// Slot-Positionen als Pyramide erzeugen (jede höhere Ebene kleiner, um 0.5 versetzt).
function genSlots(cols: number, rows: number, layers: number): { x: number; y: number; layer: number }[] {
  const slots: { x: number; y: number; layer: number }[] = [];
  for (let l = 0; l < layers; l++) {
    const c = cols - l, r = rows - l;
    if (c < 1 || r < 1) break;
    const off = l * 0.5;
    for (let row = 0; row < r; row++)
      for (let col = 0; col < c; col++) slots.push({ x: col + off, y: row + off, layer: l });
  }
  return slots;
}

// Eine gültige Entfern-Reihenfolge (jeder Stein ist beim Entfernen frei) berechnen.
function removalOrder(slots: { x: number; y: number; layer: number }[], rand: Rng): number[] {
  const removed = new Array(slots.length).fill(false);
  const order: number[] = [];
  const covered = (i: number) => {
    const t = slots[i];
    for (let j = 0; j < slots.length; j++) {
      if (removed[j] || j === i) continue;
      const o = slots[j];
      if (o.layer > t.layer && Math.abs(o.x - t.x) < 1 && Math.abs(o.y - t.y) < 1) return true;
    }
    return false;
  };
  while (order.length < slots.length) {
    const free: number[] = [];
    for (let i = 0; i < slots.length; i++) if (!removed[i] && !covered(i)) free.push(i);
    if (free.length === 0) break; // sollte bei Pyramide nie passieren
    const pick = free[(rand() * free.length) | 0];
    removed[pick] = true;
    order.push(pick);
  }
  return order;
}

// Board bauen — GARANTIERT lösbar: Faces werden entlang der Entfern-Reihenfolge in
// aufeinanderfolgenden Dreiergruppen vergeben (so löst sich jedes Tripel beim Abräumen sofort).
export function makeBoard(level: number, rand: Rng = Math.random): Board {
  const lv = Math.max(1, level);
  const cols = Math.min(4 + Math.floor(lv / 2), 7);
  const rows = Math.min(4 + Math.floor(lv / 3), 7);
  const layers = Math.min(2 + Math.floor(lv / 2), 4);

  const slots = genSlots(cols, rows, layers);
  while (slots.length % 3 !== 0) slots.pop();
  const total = slots.length;
  const triples = total / 3;

  const faceCount = Math.min(Math.max(6, 6 + Math.floor(lv / 2)), FACES.length, triples);
  const faceList = [...FACES].sort(() => rand() - 0.5).slice(0, faceCount);

  const order = removalOrder(slots, rand);
  const faces = new Array<string>(total);
  for (let k = 0; k < triples; k++) {
    const f = faceList[k % faceCount];
    faces[order[3 * k]] = f;
    faces[order[3 * k + 1]] = f;
    faces[order[3 * k + 2]] = f;
  }
  const tiles: MTile[] = slots.map((s, i) => ({ id: i, face: faces[i], x: s.x, y: s.y, layer: s.layer, state: 'board' }));
  return { tiles, tray: [], solution: order };
}

// Überdeckt ein noch liegender Stein höherer Ebene diesen Stein?
export function isFree(board: Board, id: number): boolean {
  const t = board.tiles[id];
  if (!t || t.state !== 'board') return false;
  for (const o of board.tiles) {
    if (o.state !== 'board' || o.layer <= t.layer) continue;
    if (Math.abs(o.x - t.x) < 1 && Math.abs(o.y - t.y) < 1) return false;
  }
  return true;
}

export function freeTiles(board: Board): number[] {
  return board.tiles.filter((t) => t.state === 'board' && isFree(board, t.id)).map((t) => t.id);
}

// Ablage auflösen: je 3 gleiche Faces entfernen (cleared).
function resolveTray(board: Board) {
  let changed = true;
  while (changed) {
    changed = false;
    const byFace = new Map<string, number[]>();
    for (const id of board.tray) {
      const f = board.tiles[id].face;
      (byFace.get(f) ?? byFace.set(f, []).get(f)!).push(id);
    }
    for (const ids of byFace.values()) {
      if (ids.length >= 3) {
        const three = ids.slice(0, 3);
        for (const id of three) board.tiles[id].state = 'cleared';
        board.tray = board.tray.filter((id) => !three.includes(id));
        changed = true;
        break;
      }
    }
  }
}

// Freien Stein antippen -> Ablage. Gibt false zurück, wenn nicht möglich.
export function pick(board: Board, id: number): boolean {
  if (board.tray.length >= TRAY_SIZE) return false;
  if (!isFree(board, id)) return false;
  board.tiles[id].state = 'tray';
  board.tray.push(id);
  resolveTray(board);
  return true;
}

export function isWon(board: Board): boolean {
  return board.tiles.every((t) => t.state === 'cleared');
}
export function isLost(board: Board): boolean {
  return board.tray.length >= TRAY_SIZE;
}

// --- Booster ---------------------------------------------------------------
// Letzten Ablage-Stein zurück aufs Brett.
export function undo(board: Board): boolean {
  if (board.tray.length === 0) return false;
  const id = board.tray.pop()!;
  board.tiles[id].state = 'board';
  return true;
}
// Bis zu 3 Steine aus der Ablage zurück aufs Brett (Slots frei machen).
export function removeThree(board: Board): boolean {
  if (board.tray.length === 0) return false;
  const take = board.tray.slice(0, 3);
  board.tray = board.tray.slice(take.length);
  for (const id of take) board.tiles[id].state = 'board';
  return true;
}
// Faces der noch liegenden Brett-Steine neu verteilen (Sortenanzahl bleibt).
export function shuffleRemaining(board: Board, rand: Rng = Math.random): void {
  const onBoard = board.tiles.filter((t) => t.state === 'board');
  const faces = onBoard.map((t) => t.face);
  for (let i = faces.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [faces[i], faces[j]] = [faces[j], faces[i]];
  }
  onBoard.forEach((t, i) => (t.face = faces[i]));
}

export function remaining(board: Board): number {
  return board.tiles.filter((t) => t.state !== 'cleared').length;
}

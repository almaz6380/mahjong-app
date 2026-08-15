// Lawine (Schiebe-Mahjong) — headless Engine, getrennt vom Screen, damit
// scripts/check-specials.mjs sie laden kann (Muster memory/board.ts).
//
// Regel: Zwei GLEICHE Steine sind schlagbar, wenn sie orthogonal benachbart
// sind ODER in derselben Zeile/Spalte liegen und dazwischen nur leere Zellen
// sind ODER beide ganz oben auf ihrer Spalte liegen (Weg über den Haufen
// hinweg — das Gegenstück zu Connects Außenrand, und mit der Schwerkraft
// dieselbe Anschauung wie „frei" im Solitaire). Nach jedem Schlag fallen die
// Steine spaltenweise nach unten (applyGravity) — das Brett formt sich mit
// jedem Zug um.
//
// Die Oben-frei-Regel ist KEINE Kür, sondern gemessen: Ohne sie braucht selbst
// ein zufällig, aber legal spielender Simulant auf 9×8/14 Sorten Ø8 Rettungs-
// Mischungen pro Level (Sackgassen sind bei reiner Linien-Regel strukturell,
// auch mit wenigen Sorten); mit ihr sind es Ø3–4, auf kleinen Brettern Ø1.
// Messskript-Muster im Session-Verlauf (lawine-rules.mjs).
//
// Datenmodell: Tile-LISTE statt Grid. Die UI braucht stabile Identitäten
// (key = tile.id), damit die Fall-Animation als CSS-Transition auf left/top
// laufen kann; ein Grid entsteht bei Bedarf on demand (Bretter ≤ 72 Zellen,
// der O(n)-Aufbau ist egal). Die Engine mutiert in place (Konvention der
// Connect-Engine); React-Updates klonen vorher mit clone().
//
// Liveness-Garantie von shuffleRemaining (setzt ein GESETTELTES Brett voraus,
// also nach applyGravity bzw. auf dem vollen Startrechteck): Sind ≥2 Spalten
// belegt, stehen deren unterste Steine alle in Zeile rows-1; zwischen zwei in
// der Spaltenliste AUFEINANDERFOLGENDEN belegten Spalten liegen nur komplett
// leere Spalten → Zeilen-Match. Ist nur eine Spalte belegt, sind ihre zwei
// obersten Steine senkrecht benachbart. Der Notfall-Zweig zwingt eine Sorte
// mit ≥2 Exemplaren auf genau so ein Positions-Paar — dabei sind BEIDE Ziele
// als Tauschquelle ausgeschlossen, sonst kann der zweite Tausch den ersten
// wieder ausbauen.

import { mulberry32, seedFromString } from '../../game/engine';
import { distinctFacesByGroup } from '../../game/tiles';
import { lawineConfig } from './levels';

export { lawineConfig } from './levels';

export interface LawineTile {
  id: number; // stabil über das ganze Level (React-Key für die Fall-Animation)
  face: number; // Index in board.faceIds
  r: number;
  c: number;
}

export interface LawineBoard {
  rows: number;
  cols: number;
  tiles: LawineTile[];
  faceIds: string[]; // Index -> Tile-Face-id
}

type Rng = () => number;

// Motiv-Vorrat, gemeinsame Quelle mit Connect (src/game/tiles.ts).
export const DISTINCT: string[] = distinctFacesByGroup();

// Zelle (r,c) -> Index in b.tiles oder -1.
export function buildGrid(b: LawineBoard): number[] {
  const g = new Array(b.rows * b.cols).fill(-1);
  b.tiles.forEach((t, i) => (g[t.r * b.cols + t.c] = i));
  return g;
}

export function makeBoard(rows: number, cols: number, faceIds: string[], rand: Rng = Math.random): LawineBoard {
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
  const tiles: LawineTile[] = [];
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles.push({ id: k, face: vals[k++], r, c });
  const b: LawineBoard = { rows, cols, tiles, faceIds };
  if (!findAnyPair(b)) shuffleRemaining(b, rand);
  return b;
}

// Deterministisch je Level (wie Memory): „Neu" liefert exakt dasselbe Brett.
export function makeLevel(level: number): LawineBoard {
  const cfg = lawineConfig(level);
  const rand = mulberry32(seedFromString('lawine:' + level));
  return makeBoard(cfg.rows, cfg.cols, DISTINCT.slice(0, cfg.faces), rand);
}

function tileById(b: LawineBoard, id: number): LawineTile | undefined {
  return b.tiles.find((t) => t.id === id);
}

// Freie Linie zwischen zwei Steinen derselben Zeile/Spalte (Enden exklusiv).
function lineClear(b: LawineBoard, g: number[], a: LawineTile, t: LawineTile): boolean {
  if (a.r === t.r) {
    const [c1, c2] = a.c < t.c ? [a.c, t.c] : [t.c, a.c];
    for (let c = c1 + 1; c < c2; c++) if (g[a.r * b.cols + c] !== -1) return false;
    return true;
  }
  if (a.c === t.c) {
    const [r1, r2] = a.r < t.r ? [a.r, t.r] : [t.r, a.r];
    for (let r = r1 + 1; r < r2; r++) if (g[r * b.cols + a.c] !== -1) return false;
    return true;
  }
  return false;
}

// Liegt nichts über dem Stein in seiner Spalte? (= oberster Stein der Spalte)
function topFree(b: LawineBoard, t: LawineTile): boolean {
  return !b.tiles.some((x) => x.c === t.c && x.r < t.r);
}

export function canMatch(b: LawineBoard, idA: number, idB: number, grid?: number[]): boolean {
  if (idA === idB) return false;
  const a = tileById(b, idA);
  const t = tileById(b, idB);
  if (!a || !t || a.face !== t.face) return false;
  if (Math.abs(a.r - t.r) + Math.abs(a.c - t.c) === 1) return true; // benachbart
  if (lineClear(b, grid ?? buildGrid(b), a, t)) return true;
  return topFree(b, a) && topFree(b, t); // über den Haufen hinweg
}

// Erstes schlagbares Paar (Tile-IDs) — Sackgassen-Detektor und Tipp-Quelle.
export function findAnyPair(b: LawineBoard): [number, number] | null {
  const g = buildGrid(b);
  const byFace = new Map<number, LawineTile[]>();
  for (const t of b.tiles) (byFace.get(t.face) ?? byFace.set(t.face, []).get(t.face)!).push(t);
  for (const tiles of byFace.values()) {
    for (let x = 0; x < tiles.length; x++)
      for (let y = x + 1; y < tiles.length; y++)
        if (canMatch(b, tiles[x].id, tiles[y].id, g)) return [tiles[x].id, tiles[y].id];
  }
  return null;
}

export function removePair(b: LawineBoard, idA: number, idB: number) {
  b.tiles = b.tiles.filter((t) => t.id !== idA && t.id !== idB);
}

// Steine fallen spaltenweise nach unten. Rückgabe: hat sich etwas bewegt?
export function applyGravity(b: LawineBoard): boolean {
  let moved = false;
  for (let c = 0; c < b.cols; c++) {
    const col = b.tiles.filter((t) => t.c === c).sort((x, y) => y.r - x.r);
    let r = b.rows - 1;
    for (const t of col) {
      if (t.r !== r) {
        t.r = r;
        moved = true;
      }
      r--;
    }
  }
  return moved;
}

export function remaining(b: LawineBoard): number {
  return b.tiles.length;
}

export function isCleared(b: LawineBoard): boolean {
  return b.tiles.length === 0;
}

// Motive der Reststeine neu verteilen, bis mindestens ein schlagbares Paar
// existiert. Es werden NUR die Motive permutiert, nie die Positionen — die
// Gravity-Invariante (kein Stein über leerer Zelle) kann so nie brechen.
export function shuffleRemaining(b: LawineBoard, rand: Rng = Math.random) {
  if (b.tiles.length < 2) return;
  for (let tries = 0; tries < 60; tries++) {
    const vals = b.tiles.map((t) => t.face);
    for (let i = vals.length - 1; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      [vals[i], vals[j]] = [vals[j], vals[i]];
    }
    b.tiles.forEach((t, k) => (t.face = vals[k]));
    if (findAnyPair(b)) return;
  }
  // Notfall-Garantie: eine Sorte mit ≥2 Exemplaren auf ein sicher schlagbares
  // Positions-Paar zwingen (Beweis im Kopfkommentar).
  const count = new Map<number, number>();
  for (const t of b.tiles) count.set(t.face, (count.get(t.face) ?? 0) + 1);
  let face = -1;
  for (const [f, n] of count) if (n >= 2) { face = f; break; }
  if (face < 0) return;

  const byCol = new Map<number, LawineTile[]>();
  for (const t of b.tiles) (byCol.get(t.c) ?? byCol.set(t.c, []).get(t.c)!).push(t);
  const cols = [...byCol.keys()].sort((a, z) => a - z);
  let targets: [LawineTile, LawineTile];
  if (cols.length >= 2) {
    // Unterste Steine zweier aufeinanderfolgender belegter Spalten — dazwischen
    // liegen nur komplett leere Spalten, die Zeile ist frei.
    const bottom = (c: number) => byCol.get(c)!.reduce((m, t) => (t.r > m.r ? t : m));
    targets = [bottom(cols[0]), bottom(cols[1])];
  } else {
    // Nur eine Spalte belegt: die zwei obersten Steine sind senkrecht benachbart.
    const col = byCol.get(cols[0])!.sort((x, y) => x.r - y.r);
    targets = [col[0], col[1]];
  }
  for (const target of targets) {
    if (target.face === face) continue;
    const src = b.tiles.find((t) => t.face === face && t !== targets[0] && t !== targets[1]);
    if (!src) return;
    src.face = target.face;
    target.face = face;
  }
}

// Für React-Updates: die Engine mutiert in place, der State braucht frische Objekte.
export function clone(b: LawineBoard): LawineBoard {
  return { ...b, tiles: b.tiles.map((t) => ({ ...t })) };
}

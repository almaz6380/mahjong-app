import type { TileFace } from './tiles';
import type { Cell } from './layouts';

export type { Cell } from './layouts';

export interface PlacedTile {
  key: number;
  col: number;
  row: number;
  layer: number;
  face: TileFace;
  removed: boolean;
  /**
   * Liegt verdeckt (Rueckseite statt Motiv).
   *
   * Bewusst am STEIN-PLATZ und nicht am Motiv: `reshuffleBoard` permutiert
   * Faces auf feste Positionen, `hidden` bleibt damit an der Stelle kleben.
   * Das ist auch die richtige Bedeutung — die verdeckte Stelle ist ein dunkler
   * Fleck auf dem Brett, nach dem Mischen liegt dort ein anderes Motiv. Am
   * Motiv haengend wuerde der Fleck beim Mischen ueber das Brett springen und
   * dem Spieler verraten, welches Motiv das verdeckte ist.
   *
   * Die Sonderwirkungen (`special`) sitzen dagegen am `TileFace` — sie
   * gehoeren zum Stein, nicht zum Ort. Merksatz: Ort-Eigenschaften an
   * `PlacedTile`, Stein-Eigenschaften an `TileFace`.
   */
  hidden?: boolean;
}

export interface Neighbors {
  up: number[]; // Stein direkt darüber (gleiche col/row, layer+1)
  left: number[];
  right: number[];
}

// Kurzlebiger "verschwindender" Stein für die Match-Animation.
export interface FadeTile {
  key: number;
  col: number;
  row: number;
  layer: number;
  faceId: string;
}

const coordKey = (l: number, c: number, r: number) => `${l}:${c}:${r}`;

export function buildNeighbors(cells: Cell[]): Neighbors {
  const map = new Map<string, number>();
  cells.forEach((cell, i) => map.set(coordKey(cell.layer, cell.col, cell.row), i));

  const up: number[] = [];
  const left: number[] = [];
  const right: number[] = [];
  cells.forEach((cell, i) => {
    up[i] = map.get(coordKey(cell.layer + 1, cell.col, cell.row)) ?? -1;
    left[i] = map.get(coordKey(cell.layer, cell.col - 1, cell.row)) ?? -1;
    right[i] = map.get(coordKey(cell.layer, cell.col + 1, cell.row)) ?? -1;
  });
  return { up, left, right };
}

// Ein Stein ist "frei" (spielbar), wenn nichts darüber liegt UND mindestens
// eine der beiden Seiten (links/rechts) frei ist.
export function isFreeIdx(i: number, present: Uint8Array, nb: Neighbors): boolean {
  const up = nb.up[i];
  if (up !== -1 && present[up]) return false;
  const left = nb.left[i];
  const right = nb.right[i];
  const leftBlocked = left !== -1 && present[left] === 1;
  const rightBlocked = right !== -1 && present[right] === 1;
  return !leftBlocked || !rightBlocked;
}

// --- Zufallshelfer ---------------------------------------------------------

export type Rng = () => number; // liefert [0,1)

// Deterministischer RNG (mulberry32) – für die Tages-Challenge (Seed aus Datum).
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(arr: T[], rand: Rng = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Bildet aus einem Steine-Pool passende Paare (matchKey-Gruppen haben immer
// gerade Größe, weil normale Steine 4× und Blumen/Jahreszeiten je 4× vorkommen).
function makePairs(faces: TileFace[], rand: Rng = Math.random): [TileFace, TileFace][] {
  const groups = new Map<string, TileFace[]>();
  for (const f of faces) {
    const g = groups.get(f.matchKey) ?? [];
    g.push(f);
    groups.set(f.matchKey, g);
  }
  const pairs: [TileFace, TileFace][] = [];
  for (const g of groups.values()) {
    shuffle(g, rand);
    for (let i = 0; i + 1 < g.length; i += 2) pairs.push([g[i], g[i + 1]]);
  }
  return shuffle(pairs, rand);
}

// Kern der Lösbarkeits-Garantie: Wir "lösen" das Board rückwärts.
// In jedem Schritt entfernen wir zwei aktuell FREIE Positionen und weisen ihnen
// ein zusammenpassendes Paar zu. Die umgekehrte Reihenfolge ist damit ein
// garantiert gültiger Lösungsweg.
function assignSolvable(
  indices: number[],
  nb: Neighbors,
  pairs: [TileFace, TileFace][],
  size: number,
  rand: Rng = Math.random,
): Record<number, TileFace> | null {
  const present = new Uint8Array(size);
  for (const i of indices) present[i] = 1;

  const faceOf: Record<number, TileFace> = {};
  let remaining = indices.length;
  let pi = 0;

  while (remaining > 0) {
    const free: number[] = [];
    for (const i of indices) if (present[i] && isFreeIdx(i, present, nb)) free.push(i);
    if (free.length < 2) return null; // Sackgasse -> Aufrufer versucht es neu

    const a = free[(rand() * free.length) | 0];
    let b = a;
    while (b === a) b = free[(rand() * free.length) | 0];

    // ⚠ Schutz gegen einen sonst TÖDLICHEN Fall: `makePairs` laesst bei
    // ungerader Gruppengroesse den Rest liegen (`i + 1 < g.length`), das
    // `pairs`-Array ist dann KUERZER als die Zahl der Positionen. Ohne diese
    // Zeile destrukturiert die naechste Zeile `undefined` und wirft einen
    // TypeError — mitten aus der 800-Versuche-Schleife, ungefangen durch
    // `reshuffleBoard` und `useGame.shuffle()` hindurch bis in die Oberflaeche.
    // Blitz und Zen mischen bei Sackgassen von selbst, dort waere es ein
    // weisser Bildschirm.
    // Heute kann das nicht passieren (Steine verschwinden nur paarweise), aber
    // jede Mechanik, die einzelne Steine entfernt, wuerde es ausloesen.
    // Reproduziert am 11.08.2026: zwei Einzelentnahmen -> 2 ungerade Gruppen ->
    // TypeError. Mit dieser Zeile wird daraus ein sauberes „Mischen wirkt
    // nicht", und die vorhandene Sackgassen-UI uebernimmt.
    if (pi >= pairs.length) return null;

    const [f1, f2] = pairs[pi++];
    faceOf[a] = f1;
    faceOf[b] = f2;
    present[a] = 0;
    present[b] = 0;
    remaining -= 2;
  }
  return faceOf;
}

export function generateBoard(
  cells: Cell[],
  nb: Neighbors,
  deck: TileFace[],
  rand: Rng = Math.random,
): PlacedTile[] {
  const indices = cells.map((_, i) => i);
  for (let attempt = 0; attempt < 800; attempt++) {
    const faceOf = assignSolvable(indices, nb, makePairs(deck, rand), cells.length, rand);
    if (faceOf) {
      return cells.map((c, i) => ({
        key: i,
        col: c.col,
        row: c.row,
        layer: c.layer,
        face: faceOf[i],
        removed: false,
      }));
    }
  }
  // Sollte praktisch nie passieren – Fallback ohne Lösbarkeitsgarantie.
  return cells.map((c, i) => ({ key: i, ...c, face: deck[i], removed: false }));
}

// Mischt die noch vorhandenen Steine neu – wieder garantiert lösbar.
export function reshuffleBoard(tiles: PlacedTile[], nb: Neighbors): PlacedTile[] {
  const active = tiles.filter((t) => !t.removed);
  const indices = active.map((t) => t.key);
  const faces = active.map((t) => t.face);

  for (let attempt = 0; attempt < 800; attempt++) {
    const faceOf = assignSolvable(indices, nb, makePairs(faces), tiles.length);
    if (faceOf) {
      return tiles.map((t) => (t.removed ? t : { ...t, face: faceOf[t.key] }));
    }
  }
  return tiles;
}

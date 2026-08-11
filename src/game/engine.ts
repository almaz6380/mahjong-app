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
): { faceOf: Record<number, TileFace>; pairs: [number, number][] } | null {
  const present = new Uint8Array(size);
  for (const i of indices) present[i] = 1;

  const faceOf: Record<number, TileFace> = {};
  // Welche POSITIONEN einander zugewiesen wurden. Spezialsteine ersetzen später
  // genau ein solches Lösungspaar — nur dann bleibt die rückwärts konstruierte
  // Entfernungs-Reihenfolge Zug für Zug gültig.
  const pairIdx: [number, number][] = [];
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
    pairIdx.push([a, b]);
    present[a] = 0;
    present[b] = 0;
    remaining -= 2;
  }
  return { faceOf, pairs: pairIdx };
}

/**
 * Wie `generateBoard`, gibt aber zusätzlich die Lösungspaarung heraus:
 * `pairs[i] = [posA, posB]` sind die beiden Positionen, die die
 * Rückwärtskonstruktion einander zugewiesen hat.
 *
 * Spezialsteine überschreiben genau ein solches Paar (siehe modifiers.ts).
 * Zwei beliebige Steine derselben Gruppe zu nehmen wäre falsch: Die Parität
 * bliebe zwar heil, aber der Lösungsweg wäre zerstört, weil die früheren
 * Partner der beiden einander nicht mehr finden.
 */
export function generateBoardWithPairs(
  cells: Cell[],
  nb: Neighbors,
  deck: TileFace[],
  rand: Rng = Math.random,
): { tiles: PlacedTile[]; pairs: [number, number][] } {
  const indices = cells.map((_, i) => i);
  for (let attempt = 0; attempt < 800; attempt++) {
    const res = assignSolvable(indices, nb, makePairs(deck, rand), cells.length, rand);
    if (res) {
      return {
        tiles: cells.map((c, i) => ({
          key: i,
          col: c.col,
          row: c.row,
          layer: c.layer,
          face: res.faceOf[i],
          removed: false,
        })),
        pairs: res.pairs,
      };
    }
  }
  // Sollte praktisch nie passieren – Fallback ohne Lösbarkeitsgarantie.
  // Ohne Paarung: Spezialsteine werden dann nicht gesetzt, das Brett bleibt
  // trotzdem spielbar.
  return { tiles: cells.map((c, i) => ({ key: i, ...c, face: deck[i], removed: false })), pairs: [] };
}

// Signatur unveraendert — daily.ts, useGame.ts und scripts/check-figures.mjs
// haengen daran.
export function generateBoard(
  cells: Cell[],
  nb: Neighbors,
  deck: TileFace[],
  rand: Rng = Math.random,
): PlacedTile[] {
  return generateBoardWithPairs(cells, nb, deck, rand).tiles;
}

// Mischt die noch vorhandenen Steine neu – wieder garantiert lösbar.
/**
 * Welche Steine reisst eine Bombe zusaetzlich mit?
 *
 * Drei Filter, jeder aus einem konkreten Grund:
 *
 * 1. **Nachbarschaft** — Chebyshev-Radius 1 um die beiden Bombensteine, gleiche
 *    Ebene oder direkt darunter/darueber.
 * 2. **Nichts darueber** — sonst haengt der Stein darueber anschliessend in der
 *    Luft. Schwebende Steine sind im ganzen Projekt ausgeschlossen
 *    (`check-figures.mjs` prueft es fuer die Bretter).
 * 3. ⚠ **Nur VOLLSTAENDIGE matchKey-Paare** — der eigentliche Grund, warum
 *    diese Funktion existiert. Entfernt die Bombe drei Steine einer Sorte,
 *    bleibt ein Einzelstueck uebrig, das nie wieder einen Partner findet: Das
 *    Brett ist unloesbar, und kein Mischen repariert es (`makePairs` laesst den
 *    ungeraden Rest liegen). Aus jeder Gruppe mit ungerader Trefferzahl faellt
 *    deshalb ein Stein wieder heraus und bleibt stehen.
 *
 * Der Preis: Manchmal bleibt ein Nachbar liegen. Das ist verstaendlich und
 * deutlich billiger als ein totes Brett.
 */
export function blastSet(
  tiles: PlacedTile[],
  nb: Neighbors,
  present: Uint8Array,
  centers: number[],
): Set<number> {
  const byKey = new Map<number, PlacedTile>();
  for (const t of tiles) byKey.set(t.key, t);
  const mitte = centers.map((k) => byKey.get(k)).filter(Boolean) as PlacedTile[];

  const treffer: PlacedTile[] = [];
  for (const t of tiles) {
    if (t.removed || centers.includes(t.key)) continue;
    const nah = mitte.some(
      (m) => Math.abs(t.col - m.col) <= 1 && Math.abs(t.row - m.row) <= 1 && Math.abs(t.layer - m.layer) <= 1,
    );
    if (!nah) continue;
    // ⚠ NICHT `nb.up` benutzen. Das ist nur der Stein an exakt derselben
    // Koordinate eine Ebene hoeher — Ebenen liegen aber teils um einen halben
    // Schritt versetzt, ein Stein ruht dann auf bis zu vier Nachbarn, von denen
    // keiner `nb.up` ist. Mit `nb.up` liess die Bombe Steine schweben (vom
    // Fuzz-Test in check-specials.mjs sofort gefunden). Gefragt ist die echte
    // Auflagepruefung: ueberlappt irgendein Stein eine Ebene hoeher?
    const traegt = tiles.some(
      (u) => !u.removed && u.layer === t.layer + 1
        && Math.abs(u.col - t.col) < 1 && Math.abs(u.row - t.row) < 1,
    );
    if (traegt) continue;
    treffer.push(t);
  }

  // Auf gerade Gruppen beschneiden: aus jeder ungeraden Gruppe faellt der
  // entfernteste Stein wieder heraus.
  const gruppen = new Map<string, PlacedTile[]>();
  for (const t of treffer) {
    const g = gruppen.get(t.face.matchKey) ?? [];
    g.push(t);
    gruppen.set(t.face.matchKey, g);
  }
  const raus = new Set<number>();
  const abstand = (t: PlacedTile) =>
    Math.min(...mitte.map((m) => Math.abs(t.col - m.col) + Math.abs(t.row - m.row)));
  for (const g of gruppen.values()) {
    if (g.length % 2 === 0) {
      for (const t of g) raus.add(t.key);
    } else if (g.length > 1) {
      g.sort((a, b) => abstand(a) - abstand(b));
      for (const t of g.slice(0, g.length - 1)) raus.add(t.key);
    }
  }
  return raus;
}

export function reshuffleBoard(tiles: PlacedTile[], nb: Neighbors): PlacedTile[] {
  const active = tiles.filter((t) => !t.removed);
  const indices = active.map((t) => t.key);
  const faces = active.map((t) => t.face);

  for (let attempt = 0; attempt < 800; attempt++) {
    const res = assignSolvable(indices, nb, makePairs(faces), tiles.length);
    if (res) {
      // `hidden` bleibt über den Spread an der Position kleben — genau richtig:
      // Die verdeckte Stelle ist ein Fleck auf dem Brett, nach dem Mischen liegt
      // dort ein anderes Motiv. Das entwertet erspieltes Gedächtniswissen, und
      // das soll ein Rettungs-Mischen auch tun.
      return tiles.map((t) => (t.removed ? t : { ...t, face: res.faceOf[t.key] }));
    }
  }
  // ⚠ REFERENZ-VERTRAG: Bei Misserfolg dasselbe Array-Objekt zurückgeben.
  // `useGame.shuffle()` erkennt die Sackgasse an `next === tiles`. Ein
  // `tiles.map(...)` hier schaltet die Erkennung stumm ab — die Oberfläche
  // mischte dann endlos und verbrauchte Booster für nichts.
  return tiles;
}

// Solitaire-Duell: gemeinsamer Kern für App UND Server (worker/).
//
// ⚠ Diese Datei läuft auch im Cloudflare-Worker. Deshalb nur reine Logik —
// kein React, kein DOM, keine Bilder. Client und Server müssen aus Seed und
// Figur EXAKT dasselbe Brett bauen; jede Abweichung hier (anderer Zufalls-
// verbrauch, andere Reihenfolge) lässt den Server gültige Züge ablehnen.

import { allFigures } from '../game/figures';
import { getLayout } from '../game/layouts';
import { deckForCount, isPair } from '../game/tiles';
import {
  buildNeighbors,
  generateBoard,
  isFreeIdx,
  mulberry32,
  reshuffleBoard,
  seedFromString,
  type Neighbors,
  type PlacedTile,
  type Rng,
} from '../game/engine';

/** Nach so langer Zeit endet ein Duell; dann zählen die Reststeine. */
export const DUEL_TIME_CAP_MS = 10 * 60 * 1000;
/** Tipp und manuelles Mischen sperren das Brett so lange (statt Münzen). */
export const DUEL_PENALTY_MS = 5000;
/**
 * Sackgasse ohne Ausweg (das letzte Paar liegt gestapelt o. Ä.): Der Rest wird
 * abgeräumt, dafür kommt diese Strafzeit dazu. Passiert einem gierigen
 * Spieler auf etwa jedem 20. Brett — ohne Ausweg stünde er bis zum Zeitlimit.
 */
export const DUEL_STUCK_PENALTY_MS = 20000;
/** Countdown vor dem Start (3-2-1 plus Luft für langsame Verbindungen). */
export const DUEL_COUNTDOWN_MS = 3500;

// Mittlere Figuren: groß genug für ein echtes Rennen, klein genug für große
// Steine auf dem Handy. Mindestens zwei Ebenen, wie im Level-Modus.
const MIN_TILES = 44;
const MAX_TILES = 56;

let pool: string[] | null = null;
export function duelLayouts(): string[] {
  if (!pool) {
    pool = allFigures()
      .filter((f) => {
        const n = f.cells.length;
        const ebenen = new Set(f.cells.map((c) => c.layer)).size;
        return n >= MIN_TILES && n <= MAX_TILES && ebenen >= 2;
      })
      .map((f) => f.name);
  }
  return pool;
}

export function pickDuelLayout(seed: number): string {
  const p = duelLayouts();
  return p[seed % p.length];
}

/**
 * Das Duell-Brett. Bewusst OHNE verdeckte Steine und Spezialsteine — im
 * Wettrennen soll kein Zufall entscheiden.
 */
export function makeDuelBoard(seed: number, layoutName: string): PlacedTile[] {
  const lay = getLayout(layoutName);
  const nb = buildNeighbors(lay.cells);
  const rand = mulberry32(seedFromString(`duel-${seed}-${layoutName}`));
  return generateBoard(lay.cells, nb, deckForCount(lay.cells.length), rand);
}

/** Zufall für das n-te Mischen eines Spielers. Client und Server rechnen gleich. */
export function duelShuffleRand(seed: number, slot: number, n: number): Rng {
  return mulberry32(seedFromString(`duel-shuffle-${seed}-${slot}-${n}`));
}

/**
 * Spielt ein Solitaire-Brett Zug für Zug nach — ohne Oberfläche.
 *
 * Verwendet vom Server (prüft jeden gemeldeten Zug) und von der KI im Duell.
 * Verhalten muss `useGame` exakt entsprechen: Zurück macht das letzte Paar
 * wieder sichtbar, Mischen verteilt nur die Motive neu.
 */
export class SoloBoard {
  tiles: PlacedTile[];
  readonly nb: Neighbors;
  readonly history: [number, number][] = [];
  shuffles = 0;

  constructor(readonly seed: number, readonly layoutName: string, readonly slot: number) {
    this.tiles = makeDuelBoard(seed, layoutName);
    this.nb = buildNeighbors(getLayout(layoutName).cells);
  }

  get total(): number {
    return this.tiles.length;
  }

  get remaining(): number {
    let n = 0;
    for (const t of this.tiles) if (!t.removed) n++;
    return n;
  }

  private present(): Uint8Array {
    const p = new Uint8Array(this.tiles.length);
    for (const t of this.tiles) if (!t.removed) p[t.key] = 1;
    return p;
  }

  freeKeys(): number[] {
    const p = this.present();
    return this.tiles.filter((t) => !t.removed && isFreeIdx(t.key, p, this.nb)).map((t) => t.key);
  }

  /** Alle gerade möglichen Paare. */
  pairs(): [number, number][] {
    const free = this.freeKeys();
    const out: [number, number][] = [];
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (isPair(this.tiles[free[i]], this.tiles[free[j]])) out.push([free[i], free[j]]);
      }
    }
    return out;
  }

  /** Prüft und führt einen Zug aus. `false` = ungültig, nichts geändert. */
  match(a: number, b: number): boolean {
    if (a === b) return false;
    const ta = this.tiles[a];
    const tb = this.tiles[b];
    if (!ta || !tb || ta.removed || tb.removed) return false;
    const p = this.present();
    if (!isFreeIdx(a, p, this.nb) || !isFreeIdx(b, p, this.nb)) return false;
    if (!isPair(ta, tb)) return false;
    this.tiles = this.tiles.map((t) => (t.key === a || t.key === b ? { ...t, removed: true } : t));
    this.history.push([a, b]);
    return true;
  }

  undo(): boolean {
    const last = this.history.pop();
    if (!last) return false;
    const [a, b] = last;
    this.tiles = this.tiles.map((t) => (t.key === a || t.key === b ? { ...t, removed: false } : t));
    return true;
  }

  /** Mischt mit dem gemeinsamen Seed. `false` = es gibt keine lösbare Verteilung mehr. */
  shuffle(): boolean {
    const next = reshuffleBoard(this.tiles, this.nb, duelShuffleRand(this.seed, this.slot, this.shuffles));
    if (next === this.tiles) return false;
    this.tiles = next;
    this.shuffles++;
    return true;
  }
}

// Vereinfachte Hongkong-Faan-Wertung.

import { tileIndex, isSuited, type TileCode } from './tiles4';
import { seatWind, type GameState, type Meld } from './engine4';

interface SetInfo {
  isChow: boolean;
  code: TileCode; // repräsentativer Stein (Pung/Kong: der Stein; Chow: niedrigster)
  isKong: boolean;
}

// Verdeckte Zähler in `need` Sätze + Paar zerlegen (erste Lösung), Sätze zurückgeben.
function decompose(counts: number[], need: number): { sets: SetInfo[]; pairIndex: number } | null {
  const rec = (c: number[], n: number, acc: SetInfo[]): boolean => {
    if (n === 0) return c.every((x) => x === 0);
    let i = 0;
    while (i < 34 && c[i] === 0) i++;
    if (i === 34) return false;
    if (c[i] >= 3) {
      c[i] -= 3;
      acc.push({ isChow: false, code: codeAt(i), isKong: false });
      if (rec(c, n - 1, acc)) return true;
      acc.pop();
      c[i] += 3;
    }
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--;
      acc.push({ isChow: true, code: codeAt(i), isKong: false });
      if (rec(c, n - 1, acc)) return true;
      acc.pop();
      c[i]++; c[i + 1]++; c[i + 2]++;
    }
    return false;
  };

  for (let pi = 0; pi < 34; pi++) {
    if (counts[pi] >= 2) {
      const c = counts.slice();
      c[pi] -= 2;
      const acc: SetInfo[] = [];
      if (rec(c, need, acc)) return { sets: acc, pairIndex: pi };
    }
  }
  return null;
}

function codeAt(i: number): TileCode {
  if (i < 9) return 'm' + (i + 1);
  if (i < 18) return 's' + (i - 9 + 1);
  if (i < 27) return 'p' + (i - 18 + 1);
  return 'z' + (i - 27 + 1);
}

function meldToSet(m: Meld): SetInfo {
  const isChow = m.type === 'chow';
  const isKong = m.type === 'kong' || m.type === 'concealed_kong';
  const code = isChow ? [...m.tiles].sort()[0] : m.tiles[0];
  return { isChow, code, isKong };
}

export interface ScoreResult {
  faan: number;
  patterns: { name: string; faan: number }[];
  points: number;
}

export function scoreWin(state: GameState, winner: number): ScoreResult {
  const pl = state.players[winner];
  const declaredSets = pl.melds.map(meldToSet);
  const setsNeeded = 4 - pl.melds.length;

  // Verdeckte Hand inkl. Gewinnstein (bei Abwurf-Gewinn liegt der Stein noch nicht in der Hand).
  const concealed = [...pl.hand];
  if (state.result?.fromDiscard != null && state.result.winningTile) concealed.push(state.result.winningTile);
  const counts = new Array(34).fill(0);
  for (const t of concealed) { const i = tileIndex(t); if (i >= 0) counts[i]++; }

  const dec = decompose(counts, setsNeeded);
  const allSets: SetInfo[] = dec ? [...declaredSets, ...dec.sets] : declaredSets;

  const patterns: { name: string; faan: number }[] = [];
  const add = (name: string, faan: number) => patterns.push({ name, faan });

  add('faan.win', 1);

  // Selbstzug
  if (state.result?.fromDiscard == null) add('faan.selfDraw', 1);

  // All Pungs
  if (dec && allSets.length === 4 && allSets.every((s) => !s.isChow)) add('faan.allPungs', 3);
  // Alle Chows (Ping Wu) – nur wenn Paar keine Ehrenkarte
  if (dec && allSets.length === 4 && allSets.every((s) => s.isChow) && dec.pairIndex < 27) add('faan.allChows', 1);

  // Flush über alle Steine
  const allTiles: TileCode[] = [...concealed];
  for (const m of pl.melds) allTiles.push(...m.tiles);
  const suits = new Set<string>();
  let honors = false;
  for (const t of allTiles) {
    if (t[0] === 'z') honors = true;
    else if (t[0] === 'm' || t[0] === 's' || t[0] === 'p') suits.add(t[0]);
  }
  if (suits.size === 1 && !honors) add('faan.fullFlush', 6);
  else if (suits.size === 1 && honors) add('faan.halfFlush', 3);

  // Drachen- und Wind-Pungs
  const roundIdx = 27 + state.roundWind;
  const seatIdx = 27 + seatWind(state, winner);
  for (const s of allSets) {
    if (s.isChow) continue;
    const i = tileIndex(s.code);
    if (i >= 31) add('faan.dragonPung', 1);
    else if (i === roundIdx) add('faan.roundWindPung', 1);
    else if (i === seatIdx && i < 31) add('faan.seatWindPung', 1);
  }

  // Bonus-Blumen passend zum Sitz
  const seat = seatWind(state, winner);
  for (const b of pl.bonus) {
    const r = +b.slice(1);
    if ((b[0] === 'f' || b[0] === 'g') && r === seat + 1) add('faan.seatFlower', 1);
  }

  const faan = patterns.reduce((a, p) => a + p.faan, 0);
  // Punkte für die Tabelle (kleiner, gedeckelt).
  const points = Math.min(faan, 13);
  return { faan, patterns, points };
}

// Münz-Belohnung, wenn der menschliche Spieler (Index 0) gewinnt.
export function coinsForWin(faan: number): number {
  return 30 + faan * 20;
}

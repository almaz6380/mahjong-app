// Gewinn-Erkennung (exakt) und Shanten-Schätzung (für KI/Hinweis).
// Standard-Hand = 4 Sätze (Pung/Chow) + 1 Paar. Kongs zählen als je 1 Satz
// und sind bei „declared melds" bereits aus den verdeckten Steinen entfernt.

import { toCounts, tileIndex, type TileCode } from './tiles4';

// Kann `c` in `need` Sätze zerlegt werden (Pung oder Chow)?
function canFormSets(c: number[], need: number): boolean {
  if (need === 0) return true;
  let i = 0;
  while (i < 34 && c[i] === 0) i++;
  if (i === 34) return false;

  // Pung
  if (c[i] >= 3) {
    c[i] -= 3;
    if (canFormSets(c, need - 1)) {
      c[i] += 3;
      return true;
    }
    c[i] += 3;
  }
  // Chow (nur Zahlenfarben, Rang 1..7 als Startpunkt, gleiche Farbe)
  if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--;
    c[i + 1]--;
    c[i + 2]--;
    if (canFormSets(c, need - 1)) {
      c[i]++;
      c[i + 1]++;
      c[i + 2]++;
      return true;
    }
    c[i]++;
    c[i + 1]++;
    c[i + 2]++;
  }
  return false;
}

// Bilden die Zähler eine vollständige Hand aus `setsNeeded` Sätzen + 1 Paar?
export function isCompleteStandard(counts: ArrayLike<number>, setsNeeded: number): boolean {
  let total = 0;
  for (let i = 0; i < 34; i++) total += counts[i];
  if (total !== setsNeeded * 3 + 2) return false;

  const c = Array.from(counts, (x) => x as number);
  for (let i = 0; i < 34; i++) {
    if (c[i] >= 2) {
      c[i] -= 2;
      if (canFormSets(c, setsNeeded)) {
        c[i] += 2;
        return true;
      }
      c[i] += 2;
    }
  }
  return false;
}

// Bequemer Wrapper: gewinnt die Hand (verdeckte Codes) mit `declaredMelds` offenen Sätzen?
export function isWinningHand(concealed: TileCode[], declaredMelds: number): boolean {
  return isCompleteStandard(toCounts(concealed), 4 - declaredMelds);
}

// --- Shanten (Standardform), gepruntes DFS. -1 = fertig, 0 = tenpai (wartet). ---
export function shantenStandard(counts: ArrayLike<number>, declaredMelds: number): number {
  const c = Array.from(counts, (x) => x as number);
  let best = 8;

  const evaluate = (sets: number, partials: number, pair: boolean) => {
    let s = sets + declaredMelds;
    let p = partials;
    if (s + p > 4) p = 4 - s;
    const sh = 8 - 2 * s - p - (pair ? 1 : 0);
    if (sh < best) best = sh;
  };

  const dfs = (i0: number, sets: number, partials: number, pair: boolean) => {
    if (best <= -1) return;
    // Blöcke voll -> Rest sind Floats
    if (sets + partials >= 4 && pair) {
      evaluate(sets, partials, pair);
      return;
    }
    let i = i0;
    while (i < 34 && c[i] === 0) i++;
    if (i === 34) {
      evaluate(sets, partials, pair);
      return;
    }
    const canBlock = sets + partials < 4;
    // Pung
    if (c[i] >= 3) {
      c[i] -= 3;
      dfs(i, sets + 1, partials, pair);
      c[i] += 3;
    }
    // Chow
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--;
      c[i + 1]--;
      c[i + 2]--;
      dfs(i, sets + 1, partials, pair);
      c[i]++;
      c[i + 1]++;
      c[i + 2]++;
    }
    // Paar (als DAS Paar)
    if (c[i] >= 2 && !pair) {
      c[i] -= 2;
      dfs(i, sets, partials, true);
      c[i] += 2;
    }
    // Partielle Blöcke (nur wenn noch Platz)
    if (canBlock) {
      // Paar als Proto-Pung
      if (c[i] >= 2) {
        c[i] -= 2;
        dfs(i, sets, partials + 1, pair);
        c[i] += 2;
      }
      // Ryanmen/Penchan (i, i+1)
      if (i < 27 && i % 9 <= 7 && c[i + 1] > 0) {
        c[i]--;
        c[i + 1]--;
        dfs(i, sets, partials + 1, pair);
        c[i]++;
        c[i + 1]++;
      }
      // Kanchan (i, i+2)
      if (i < 27 && i % 9 <= 6 && c[i + 2] > 0) {
        c[i]--;
        c[i + 2]--;
        dfs(i, sets, partials + 1, pair);
        c[i]++;
        c[i + 2]++;
      }
    }
    // Float: eine Kopie verwerfen
    c[i]--;
    dfs(i, sets, partials, pair);
    c[i]++;
  };

  dfs(0, 0, 0, false);
  return best;
}

// Welche Steine (Index 0..33) vervollständigen die Hand? (Tenpai-Warteset)
export function winningWaits(concealed: TileCode[], declaredMelds: number): number[] {
  const base = toCounts(concealed);
  const waits: number[] = [];
  for (let i = 0; i < 34; i++) {
    if (base[i] >= 4) continue;
    base[i]++;
    if (isCompleteStandard(base, 4 - declaredMelds)) waits.push(i);
    base[i]--;
  }
  return waits;
}

export function isTenpai(concealed: TileCode[], declaredMelds: number): boolean {
  return winningWaits(concealed, declaredMelds).length > 0;
}

// Heuristische KI: Abwurf- und Anspruchs-Entscheidungen über Shanten.

import { tileIndex, toCounts, type TileCode } from './tiles4';
import { shantenStandard } from './win';
import { type ClaimOption, type GameState } from './engine4';

// „Nützlichkeit" eines Steins (höher = eher behalten).
function keepValue(counts: ArrayLike<number>, i: number): number {
  let v = (counts[i] as number) * 3;
  if (i < 27) {
    const r = i % 9;
    if (r > 0 && counts[i - 1]) v += 1;
    if (r < 8 && counts[i + 1]) v += 1;
    if (r > 1 && counts[i - 2]) v += 1;
    if (r < 7 && counts[i + 2]) v += 1;
  }
  return v;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

// Welchen Stein abwerfen? (Hand hat nach dem Zug 14 Steine.)
export function chooseDiscard(state: GameState, player: number, difficulty: Difficulty = 'normal'): TileCode {
  const pl = state.players[player];
  // Leicht: ab und zu einen zufälligen Stein abwerfen (schwächer).
  if (difficulty === 'easy' && Math.random() < 0.35) {
    return pl.hand[(Math.random() * pl.hand.length) | 0];
  }
  const melds = pl.melds.length;
  const counts = Array.from(toCounts(pl.hand), (x) => x);
  const uniq = [...new Set(pl.hand)];

  let bestTile = pl.hand[0];
  let bestShanten = Infinity;
  let bestUseless = -Infinity;

  for (const t of uniq) {
    const i = tileIndex(t);
    if (i < 0) continue;
    counts[i]--;
    const sh = shantenStandard(counts, melds);
    counts[i]++;
    const useless = -keepValue(counts, i);
    if (sh < bestShanten || (sh === bestShanten && useless > bestUseless)) {
      bestShanten = sh;
      bestUseless = useless;
      bestTile = t;
    }
  }
  return bestTile;
}

// Aktuelles Shanten der verdeckten Hand.
function handShanten(hand: TileCode[], melds: number): number {
  return shantenStandard(toCounts(hand), melds);
}

// Entscheidet, ob/wie `player` den Abwurf beansprucht.
export function decideClaim(
  state: GameState,
  opt: ClaimOption,
  difficulty: Difficulty = 'normal',
): { type: 'win' | 'kong' | 'pung' | 'chow'; tiles?: [TileCode, TileCode] } | null {
  if (opt.win) return { type: 'win' };

  const pl = state.players[opt.player];
  const tile = state.lastDiscard!.tile;
  const cur = handShanten(pl.hand, pl.melds.length);
  // Schwer nimmt auch gleich-gute Melds (aggressiver); leicht meldet kaum.
  const pungImproves = (after: number) => (difficulty === 'hard' ? after <= cur : after < cur);

  // Kong (offen) – nur wenn es nicht schadet.
  if (opt.kong && difficulty !== 'easy') {
    const rest = pl.hand.filter((t) => t !== tile);
    if (handShanten(rest, pl.melds.length + 1) <= cur) return { type: 'kong' };
  }
  // Pung – nur wenn es Shanten senkt.
  if (opt.pung) {
    const rest = removeN(pl.hand, tile, 2);
    const after = handShanten(rest, pl.melds.length + 1);
    // Leicht: nur bei deutlicher Verbesserung.
    const ok = difficulty === 'easy' ? after < cur - 0 && Math.random() < 0.5 : pungImproves(after);
    if (ok) return { type: 'pung' };
  }
  // Chow – leicht macht keine Chows.
  if (difficulty !== 'easy') {
    let bestChow: { tiles: [TileCode, TileCode]; sh: number } | null = null;
    for (const ch of opt.chows) {
      const r = removeSpecific(pl.hand, ch);
      const sh = handShanten(r, pl.melds.length + 1);
      const ok = difficulty === 'hard' ? sh <= cur : sh < cur;
      if (ok && (!bestChow || sh < bestChow.sh)) bestChow = { tiles: ch, sh };
    }
    if (bestChow) return { type: 'chow', tiles: bestChow.tiles };
  }
  return null;
}

function removeN(hand: TileCode[], t: TileCode, n: number): TileCode[] {
  const out = [...hand];
  for (let k = 0; k < n; k++) {
    const i = out.indexOf(t);
    if (i >= 0) out.splice(i, 1);
  }
  return out;
}
function removeSpecific(hand: TileCode[], tiles: TileCode[]): TileCode[] {
  const out = [...hand];
  for (const t of tiles) {
    const i = out.indexOf(t);
    if (i >= 0) out.splice(i, 1);
  }
  return out;
}

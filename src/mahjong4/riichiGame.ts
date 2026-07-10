// Riichi-Spiel-Schicht: nutzt engine4 (Zug/Abwurf) + riichi.ts (Wertung).
// Geschlossene Variante (kein Pon/Chi/Kan): Riichi, Tsumo, Ron, Dora, korrekte Wertung.

import { createGame, seatWind, type GameState } from './engine4';
import { codeFromIndex, tileIndex, toCounts, type TileCode } from './tiles4';
import { isWinningHand, winningWaits } from './win';
import { scoreHand, countDora, type Block, type WinCtx, type Scored } from './riichi';

export interface RiichiExtra {
  doraIndicator: TileCode;
  riichi: boolean[]; // je Spieler
}

export function riichiWall(rand: () => number = Math.random): TileCode[] {
  const wall: TileCode[] = [];
  for (let i = 0; i < 34; i++) { const c = codeFromIndex(i); for (let k = 0; k < 4; k++) wall.push(c); }
  for (let i = wall.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [wall[i], wall[j]] = [wall[j], wall[i]]; }
  return wall;
}

export function createRiichiGame(dealer: number, rand: () => number = Math.random): { state: GameState; extra: RiichiExtra } {
  const state = createGame(dealer, rand, riichiWall(rand));
  const doraIndicator = state.dead[state.dead.length - 5] ?? state.dead[0];
  return { state, extra: { doraIndicator, riichi: [false, false, false, false] } };
}

// Offene Melds → Blocks (in der geschlossenen Variante leer; hier robust gehalten).
function meldsToBlocks(state: GameState, player: number): Block[] {
  return state.players[player].melds.map((m): Block => {
    if (m.type === 'chow') return { type: 'chow', tile: Math.min(...m.tiles.map(tileIndex)), concealed: false };
    const tile = tileIndex(m.tiles[0]);
    if (m.type === 'kong' || m.type === 'concealed_kong') return { type: 'kong', tile, concealed: m.type === 'concealed_kong' };
    return { type: 'pung', tile, concealed: false };
  });
}

function buildCtx(state: GameState, extra: RiichiExtra, player: number, winTile: TileCode, tsumo: boolean): WinCtx {
  const all14: number[] = [];
  const pl = state.players[player];
  const hand = tsumo ? pl.hand : [...pl.hand, winTile];
  for (const c of hand) { const i = tileIndex(c); if (i >= 0) all14.push(i); }
  for (const m of pl.melds) for (const c of m.tiles) { const i = tileIndex(c); if (i >= 0) all14.push(i); }
  const doraCount = countDora(all14, [tileIndex(extra.doraIndicator)]);
  return {
    seatWind: 27 + seatWind(state, player),
    roundWind: 27 + state.roundWind,
    winTile: tileIndex(winTile),
    tsumo,
    riichi: extra.riichi[player],
    ippatsu: false,
    menzen: pl.melds.length === 0,
    doraCount,
  };
}

export function scoreRiichi(state: GameState, extra: RiichiExtra, player: number, winTile: TileCode, tsumo: boolean): Scored {
  const pl = state.players[player];
  const hand = tsumo ? pl.hand : [...pl.hand, winTile];
  const counts = toCounts(hand);
  const dealer = player === state.dealer;
  return scoreHand(counts, meldsToBlocks(state, player), buildCtx(state, extra, player, winTile, tsumo), dealer);
}

// Gewinn nur mit mind. 1 Yaku (sonst kein gültiger Riichi-Gewinn).
export function canRiichiWin(state: GameState, extra: RiichiExtra, player: number, winTile: TileCode, tsumo: boolean): boolean {
  const pl = state.players[player];
  const full = tsumo ? pl.hand : [...pl.hand, winTile];
  if (!isWinningHand(full, pl.melds.length)) return false;
  return scoreRiichi(state, extra, player, winTile, tsumo).points > 0;
}

// Furiten: einer der eigenen Warte-Steine liegt in den eigenen Abwürfen -> kein Ron.
export function isFuriten(state: GameState, player: number): boolean {
  const pl = state.players[player];
  const waits = winningWaits(pl.hand, pl.melds.length);
  if (waits.length === 0) return false;
  return pl.discards.some((d) => waits.includes(tileIndex(d)));
}

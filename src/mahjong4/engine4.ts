// 4-Spieler-Engine (Hongkong, vereinfacht). Mutierender Zustand; der React-Hook
// bzw. die Tests treiben den Ablauf über die exportierten Funktionen.

import { buildWall, isBonus, sortHand, toCounts, tileIndex, codeFromIndex, type TileCode } from './tiles4';
import { isWinningHand } from './win';

export type MeldType = 'pung' | 'kong' | 'concealed_kong' | 'chow';
export interface Meld {
  type: MeldType;
  tiles: TileCode[];
  from: number; // Spieler, von dem der Stein kam (bei concealed_kong = eigener Index)
}

export interface PlayerState {
  hand: TileCode[];
  melds: Meld[];
  discards: TileCode[];
  bonus: TileCode[];
}

export type Phase = 'draw' | 'discard' | 'claim' | 'over';

export interface WinResult {
  winner: number | null; // null = Abbruch (Wand leer)
  fromDiscard: number | null; // null = Selbstzug
  winningTile: TileCode | null;
}

export interface GameState {
  players: PlayerState[];
  live: TileCode[];
  livePos: number;
  dead: TileCode[];
  dealer: number;
  turn: number;
  phase: Phase;
  lastDiscard: { tile: TileCode; from: number } | null;
  lastDrawn: TileCode | null;
  result: WinResult | null;
  roundWind: number; // 0 = Ostrunde
}

export interface ClaimOption {
  player: number;
  pung: boolean;
  kong: boolean;
  chows: [TileCode, TileCode][];
  win: boolean;
}

export function seatWind(state: GameState, player: number): number {
  return (player - state.dealer + 4) % 4; // 0 O, 1 S, 2 W, 3 N
}

export function liveRemaining(state: GameState): number {
  return state.live.length - state.livePos;
}

function drawDead(state: GameState): TileCode | null {
  return state.dead.length ? state.dead.pop()! : null;
}

// Blumen/Jahreszeiten beiseitelegen und aus dem Dead Wall ersetzen.
function replaceBonus(state: GameState, p: number, first: TileCode): TileCode | null {
  let tile: TileCode | null = first;
  while (tile && isBonus(tile)) {
    state.players[p].bonus.push(tile);
    tile = drawDead(state);
  }
  return tile; // regulärer Stein oder null (Dead Wall leer)
}

export function createGame(dealer: number, rand: () => number = Math.random): GameState {
  const wall = buildWall(rand);
  const dead = wall.slice(wall.length - 14);
  const live = wall.slice(0, wall.length - 14);

  const players: PlayerState[] = [0, 1, 2, 3].map(() => ({ hand: [], melds: [], discards: [], bonus: [] }));
  const state: GameState = {
    players,
    live,
    livePos: 0,
    dead,
    dealer,
    turn: dealer,
    phase: 'draw',
    lastDiscard: null,
    lastDrawn: null,
    result: null,
    roundWind: 0,
  };

  // 13 an jeden austeilen.
  for (let n = 0; n < 13; n++) {
    for (let p = 0; p < 4; p++) players[p].hand.push(state.live[state.livePos++]);
  }
  // Anfangs-Blumen ersetzen.
  for (let p = 0; p < 4; p++) {
    for (let k = 0; k < players[p].hand.length; k++) {
      const t = players[p].hand[k];
      if (isBonus(t)) {
        const repl = replaceBonus(state, p, t);
        players[p].hand[k] = repl ?? players[p].hand[k];
      }
    }
    players[p].hand = players[p].hand.filter((t) => !isBonus(t));
    players[p].hand = sortHand(players[p].hand);
  }
  return state;
}

// Aktueller Spieler zieht (inkl. Blumen-Ersatz). Gibt den gezogenen Stein zurück.
export function draw(state: GameState): TileCode | null {
  if (state.phase !== 'draw') return null;
  const p = state.turn;
  if (state.livePos >= state.live.length) {
    state.phase = 'over';
    state.result = { winner: null, fromDiscard: null, winningTile: null };
    return null;
  }
  const raw = state.live[state.livePos++];
  const tile = isBonus(raw) ? replaceBonus(state, p, raw) : raw;
  if (!tile) {
    state.phase = 'over';
    state.result = { winner: null, fromDiscard: null, winningTile: null };
    return null;
  }
  state.players[p].hand.push(tile);
  state.players[p].hand = sortHand(state.players[p].hand);
  state.lastDrawn = tile;
  state.phase = 'discard';
  return tile;
}

// Kann der Spieler mit seiner aktuellen Hand (nach Zug) gewinnen?
export function canWinSelfDraw(state: GameState, player: number): boolean {
  const pl = state.players[player];
  return isWinningHand(pl.hand, pl.melds.length);
}

export function declareWin(state: GameState, player: number, fromDiscard: number | null, tile: TileCode) {
  state.result = { winner: player, fromDiscard, winningTile: tile };
  state.phase = 'over';
}

// Aktueller Spieler wirft ab.
export function discard(state: GameState, tile: TileCode): boolean {
  if (state.phase !== 'discard' || state.turn === -1) return false;
  const pl = state.players[state.turn];
  const idx = pl.hand.indexOf(tile);
  if (idx < 0) return false;
  pl.hand.splice(idx, 1);
  pl.discards.push(tile);
  state.lastDiscard = { tile, from: state.turn };
  state.lastDrawn = null;
  state.phase = 'claim';
  return true;
}

// Verdeckter Kong auf eigenem Zug (Discard-Phase, vor dem Abwurf).
export function concealedKong(state: GameState, tile: TileCode): boolean {
  if (state.phase !== 'discard') return false;
  const pl = state.players[state.turn];
  if (pl.hand.filter((t) => t === tile).length < 4) return false;
  pl.hand = pl.hand.filter((t) => t !== tile);
  pl.melds.push({ type: 'concealed_kong', tiles: [tile, tile, tile, tile], from: state.turn });
  const repl = replaceBonus(state, state.turn, drawDead(state) ?? '');
  if (repl) {
    pl.hand.push(repl);
    pl.hand = sortHand(pl.hand);
    state.lastDrawn = repl;
  }
  return true;
}

// Chow-Varianten: welche [t1,t2] aus der Hand vervollständigen `tile` zu einer Straße?
export function chowOptions(hand: TileCode[], tile: TileCode): [TileCode, TileCode][] {
  const i = tileIndex(tile);
  if (i < 0 || i >= 27) return []; // nur Zahlenfarben
  const r = i % 9;
  const has = (idx: number) => hand.includes(codeFromIndex(idx));
  const out: [TileCode, TileCode][] = [];
  if (r <= 6 && has(i + 1) && has(i + 2)) out.push([codeFromIndex(i + 1), codeFromIndex(i + 2)]);
  if (r >= 1 && r <= 7 && has(i - 1) && has(i + 1)) out.push([codeFromIndex(i - 1), codeFromIndex(i + 1)]);
  if (r >= 2 && has(i - 2) && has(i - 1)) out.push([codeFromIndex(i - 2), codeFromIndex(i - 1)]);
  return out;
}

// Was kann `player` auf den aktuellen Abwurf ansagen?
export function claimsFor(state: GameState, player: number): ClaimOption | null {
  if (state.phase !== 'claim' || !state.lastDiscard) return null;
  if (player === state.lastDiscard.from) return null;
  const pl = state.players[player];
  const tile = state.lastDiscard.tile;
  const same = pl.hand.filter((t) => t === tile).length;
  const isLeft = player === (state.lastDiscard.from + 1) % 4; // Chow nur vom linken Spieler
  const win = isWinningHand([...pl.hand, tile], pl.melds.length);
  const chows = isLeft ? chowOptions(pl.hand, tile) : [];
  if (same < 2 && chows.length === 0 && !win) return null;
  return { player, pung: same >= 2, kong: same >= 3, chows, win };
}

// Alle möglichen Ansprüche (für Treiber/KI).
export function allClaims(state: GameState): ClaimOption[] {
  const out: ClaimOption[] = [];
  for (let p = 0; p < 4; p++) {
    const c = claimsFor(state, p);
    if (c) out.push(c);
  }
  return out;
}

// Anspruch anwenden. Für Chow: `tiles` = die beiden Handsteine.
export function applyClaim(
  state: GameState,
  player: number,
  type: 'pung' | 'kong' | 'chow' | 'win',
  tiles?: [TileCode, TileCode],
): boolean {
  if (state.phase !== 'claim' || !state.lastDiscard) return false;
  const disc = state.lastDiscard;
  const pl = state.players[player];

  if (type === 'win') {
    declareWin(state, player, disc.from, disc.tile);
    return true;
  }

  // Abwurfstein aus dem Pond des Abwerfers nehmen.
  state.players[disc.from].discards.pop();

  const removeFromHand = (t: TileCode, count: number) => {
    for (let k = 0; k < count; k++) {
      const idx = pl.hand.indexOf(t);
      if (idx >= 0) pl.hand.splice(idx, 1);
    }
  };

  if (type === 'pung') {
    removeFromHand(disc.tile, 2);
    pl.melds.push({ type: 'pung', tiles: [disc.tile, disc.tile, disc.tile], from: disc.from });
  } else if (type === 'kong') {
    removeFromHand(disc.tile, 3);
    pl.melds.push({ type: 'kong', tiles: [disc.tile, disc.tile, disc.tile, disc.tile], from: disc.from });
    const repl = drawDead(state);
    const t = repl ? replaceBonus(state, player, repl) : null;
    if (t) pl.hand.push(t);
  } else if (type === 'chow') {
    if (!tiles) return false;
    removeFromHand(tiles[0], 1);
    removeFromHand(tiles[1], 1);
    pl.melds.push({ type: 'chow', tiles: sortHand([disc.tile, tiles[0], tiles[1]]), from: disc.from });
  }

  pl.hand = sortHand(pl.hand);
  state.turn = player;
  state.phase = 'discard';
  state.lastDiscard = null;
  return true;
}

// Kein Anspruch -> nächster Spieler zieht.
export function passClaims(state: GameState): void {
  if (state.phase !== 'claim') return;
  state.turn = (state.lastDiscard!.from + 1) % 4;
  state.lastDiscard = null;
  state.phase = 'draw';
}

// Riichi 1 gegen 1 auf dem Server.
//
// Zwei Menschen sitzen sich gegenüber (Plätze 0 und 2), die KI spielt die
// Plätze 1 und 3. Der Server führt die Mauer und alle Hände; jeder Client
// bekommt nur seine eigenen Steine zu sehen (`viewFor`).
//
// Der Ablauf folgt `src/mahjong4/useRiichi.ts` (geschlossene Variante: kein
// Pon/Chi/Kan), ergänzt um Zugzeiten und eine Partie über vier Hände.

import { draw, discard, declareWin, type GameState } from '../../src/mahjong4/engine4';
import { chooseDiscard } from '../../src/mahjong4/ai';
import { isTenpai } from '../../src/mahjong4/win';
import type { TileCode } from '../../src/mahjong4/tiles4';
import { createRiichiGame, canRiichiWin, isFuriten, scoreRiichi, type RiichiExtra } from '../../src/mahjong4/riichiGame';
import type { RiichiHandResult, RiichiView } from '../../src/duel/protocol';
import type { Match, RoomIO } from './io';

export const RIICHI_HANDS = 4;
export const START_POINTS = 25000;
export const TURN_MS = 15000;
export const RON_MS = 8000;
/** Ohne „Weiter" geht es nach dieser Zeit selbst in die nächste Hand. */
export const RESULT_MS = 20000;
const AI_DELAY = 700;
/** Nach Riichi wirft der Server den gezogenen Stein selbst ab. */
const AUTO_DELAY = 600;

/** Slot (0/1) → Platz am Tisch. Die Menschen sitzen sich gegenüber. */
export const SEAT_OF_SLOT = [0, 2];
const HUMAN_SEATS = new Set(SEAT_OF_SLOT);

type Pending =
  | { seat: number; kind: 'discard'; canTsumo: boolean; canRiichi: boolean; deadline: number }
  | { seat: number; kind: 'ron'; tile: TileCode; from: number; nextK: number; deadline: number };

export function canReachTenpai(hand: TileCode[], melds: number): boolean {
  const seen = new Set<string>();
  for (const tile of hand) {
    if (seen.has(tile)) continue;
    seen.add(tile);
    const rest = hand.slice();
    rest.splice(rest.indexOf(tile), 1);
    if (isTenpai(rest, melds)) return true;
  }
  return false;
}

export class RiichiMatch implements Match {
  over = false;
  private g!: GameState;
  private ex!: RiichiExtra;
  private handNo = 0;
  private points = [START_POINTS, START_POINTS, START_POINTS, START_POINTS];
  private pending: Pending | null = null;
  private result: RiichiHandResult | null = null;
  private ready = [false, false, false, false];

  constructor(private io: RoomIO, private names: () => string[]) {}

  start(_round: number): void {
    this.over = false;
    this.points = [START_POINTS, START_POINTS, START_POINTS, START_POINTS];
    this.handNo = 0;
    this.nextHand();
  }

  private rand = () => this.io.random();

  private nextHand(): void {
    this.handNo++;
    // Jeder Platz ist einmal Geber.
    const fresh = createRiichiGame((this.handNo - 1) % 4, this.rand);
    this.g = fresh.state;
    this.ex = fresh.extra;
    this.pending = null;
    this.result = null;
    this.ready = [false, false, false, false];
    this.broadcast();
    this.drive();
  }

  // ---- Ablauf ---------------------------------------------------------------

  private drive(): void {
    const g = this.g;
    if (this.pending || this.result) return;
    if (g.phase === 'over') return this.endDraw();
    if (g.phase !== 'draw') return;

    const seat = g.turn;
    if (!HUMAN_SEATS.has(seat)) {
      this.io.setTimer('act', AI_DELAY, () => this.aiTurn(seat));
      return;
    }
    const tile = draw(g);
    if ((g.phase as string) === 'over' || !tile) return this.endDraw();
    const canTsumo = canRiichiWin(g, this.ex, seat, tile, true);
    if (this.ex.riichi[seat] && !canTsumo) {
      // Nach Riichi ist die Hand gesperrt: gezogenen Stein abwerfen.
      this.broadcast();
      this.io.setTimer('act', AUTO_DELAY, () => this.doDiscard(seat, tile));
      return;
    }
    const pl = g.players[seat];
    const canRiichi = !this.ex.riichi[seat] && pl.melds.length === 0 && canReachTenpai(pl.hand, 0);
    const deadline = this.io.now() + TURN_MS;
    this.pending = { seat, kind: 'discard', canTsumo, canRiichi, deadline };
    // Zeit abgelaufen: den gezogenen Stein abwerfen (Tsumogiri).
    this.io.setTimer('act', TURN_MS, () => {
      if (this.pending?.kind === 'discard' && this.pending.seat === seat) this.humanDiscard(seat, this.g.lastDrawn ?? pl.hand[pl.hand.length - 1]);
    });
    this.broadcast();
  }

  private aiTurn(seat: number): void {
    const g = this.g;
    const ex = this.ex;
    const t = draw(g);
    if ((g.phase as string) === 'over' || !t) return this.endDraw();
    if (canRiichiWin(g, ex, seat, t, true)) return this.win(seat, t, true);
    let disc: TileCode;
    if (ex.riichi[seat]) disc = t;
    else {
      disc = chooseDiscard(g, seat, 'normal');
      if (g.players[seat].melds.length === 0 && canReachTenpai(g.players[seat].hand, 0) && this.rand() < 0.85) {
        ex.riichi[seat] = true;
      }
    }
    this.doDiscard(seat, disc);
  }

  private doDiscard(seat: number, tile: TileCode): void {
    if (!discard(this.g, tile)) return;
    this.broadcast();
    this.afterDiscard(seat, tile, 1);
  }

  /** Prüft reihum, ob jemand Ron machen kann — ab dem k-ten Platz nach dem Abwerfer. */
  private afterDiscard(from: number, tile: TileCode, startK: number): void {
    const g = this.g;
    for (let k = startK; k < 4; k++) {
      const p = (from + k) % 4;
      if (canRiichiWin(g, this.ex, p, tile, false) && !isFuriten(g, p)) {
        if (HUMAN_SEATS.has(p)) {
          const deadline = this.io.now() + RON_MS;
          this.pending = { seat: p, kind: 'ron', tile, from, nextK: k + 1, deadline };
          this.io.setTimer('act', RON_MS, () => this.pass(p));
          this.broadcast();
          return;
        }
        return this.win(p, tile, false);
      }
    }
    g.turn = (from + 1) % 4;
    g.phase = 'draw';
    g.lastDiscard = null;
    this.drive();
  }

  private humanDiscard(seat: number, tile: TileCode): void {
    const p = this.pending;
    if (p?.kind !== 'discard' || p.seat !== seat) return;
    if (!this.g.players[seat].hand.includes(tile)) return;
    this.pending = null;
    this.io.clearTimer('act');
    this.doDiscard(seat, tile);
  }

  private pass(seat: number): void {
    const p = this.pending;
    if (p?.kind !== 'ron' || p.seat !== seat) return;
    this.pending = null;
    this.io.clearTimer('act');
    this.afterDiscard(p.from, p.tile, p.nextK);
  }

  private win(seat: number, tile: TileCode, tsumo: boolean): void {
    const g = this.g;
    const from = tsumo ? null : g.lastDiscard?.from ?? null;
    const hand = tsumo ? [...g.players[seat].hand] : [...g.players[seat].hand, tile];
    const scored = scoreRiichi(g, this.ex, seat, tile, tsumo);
    declareWin(g, seat, from, tile);
    const delta = [0, 0, 0, 0];
    if (from !== null) {
      delta[from] -= scored.points;
      delta[seat] += scored.points;
    } else {
      // Selbstzug: die drei anderen teilen sich die Zahlung (auf 100 gerundet).
      const share = Math.ceil(scored.points / 3 / 100) * 100;
      for (let p = 0; p < 4; p++) if (p !== seat) {
        delta[p] -= share;
        delta[seat] += share;
      }
    }
    this.finishHand({
      winner: seat,
      tsumo,
      from,
      winTile: tile,
      hand,
      scored: { han: scored.han, fu: scored.fu, points: scored.points, yakuman: scored.yakuman, yaku: scored.yaku },
      delta,
    });
  }

  private endDraw(): void {
    this.finishHand({ winner: null, tsumo: false, from: null, winTile: null, hand: null, scored: null, delta: [0, 0, 0, 0] });
  }

  private finishHand(r: RiichiHandResult): void {
    this.io.clearTimer('act');
    this.pending = null;
    for (let p = 0; p < 4; p++) this.points[p] += r.delta[p];
    this.result = r;
    this.ready = [false, false, false, false];
    this.broadcast();
    this.io.setTimer('act', RESULT_MS, () => this.advance());
  }

  private advance(): void {
    if (!this.result || this.over) return;
    this.io.clearTimer('act');
    if (this.handNo >= RIICHI_HANDS) return this.finishMatch();
    this.nextHand();
  }

  private finishMatch(): void {
    this.over = true;
    this.io.clearTimer('act');
    const [a, b] = SEAT_OF_SLOT.map((s) => this.points[s]);
    const winner = a === b ? null : a > b ? 0 : 1;
    this.sendEnd(winner, 'points');
  }

  private sendEnd(winner: number | null, reason: 'points' | 'forfeit'): void {
    const results = SEAT_OF_SLOT.map((s) => ({ remaining: 0, ms: null, points: this.points[s] }));
    for (const s of [0, 1]) this.io.send(s, { t: 'end', winner, reason, results });
  }

  forfeit(slot: number): void {
    if (this.over || !this.g) return;
    this.over = true;
    this.io.clearTimer('act');
    this.sendEnd(1 - slot, 'forfeit');
  }

  // ---- Eingaben ---------------------------------------------------------------

  onMsg(slot: number, msg: unknown): void {
    if (this.over || !this.g) return;
    const seat = SEAT_OF_SLOT[slot];
    const m = msg as { t: string; tile?: string };
    const p = this.pending;
    switch (m.t) {
      case 'discard':
        if (typeof m.tile === 'string') this.humanDiscard(seat, m.tile as TileCode);
        return;
      case 'tsumo':
        if (p?.kind === 'discard' && p.seat === seat && p.canTsumo) {
          this.pending = null;
          this.io.clearTimer('act');
          this.win(seat, this.g.lastDrawn!, true);
        }
        return;
      case 'riichi':
        if (p?.kind === 'discard' && p.seat === seat && p.canRiichi) {
          this.ex.riichi[seat] = true;
          this.pending = { ...p, canRiichi: false, canTsumo: false };
          this.broadcast();
        }
        return;
      case 'ron':
        if (p?.kind === 'ron' && p.seat === seat) {
          this.pending = null;
          this.io.clearTimer('act');
          this.win(seat, p.tile, false);
        }
        return;
      case 'pass':
        this.pass(seat);
        return;
      case 'next':
        if (!this.result) return;
        this.ready[seat] = true;
        if (SEAT_OF_SLOT.every((s) => this.ready[s])) this.advance();
        else this.broadcast();
        return;
    }
  }

  // ---- Ansichten ----------------------------------------------------------------

  resync(slot: number): void {
    if (!this.g) return;
    this.io.send(slot, { t: 'rstate', view: this.viewFor(slot), now: this.io.now() });
  }

  private broadcast(): void {
    for (const s of [0, 1]) this.resync(s);
  }

  viewFor(slot: number): RiichiView {
    const g = this.g;
    const me = SEAT_OF_SLOT[slot];
    const p = this.pending;
    const slotNames = this.names();
    const names = [0, 1, 2, 3].map((seat) => {
      const sl = SEAT_OF_SLOT.indexOf(seat);
      return sl >= 0 ? slotNames[sl] ?? '' : '';
    });
    let acting: RiichiView['acting'] = null;
    if (p) acting = { seat: p.seat, deadline: p.deadline };
    let my: RiichiView['my'] = null;
    if (p && p.seat === me) {
      my = p.kind === 'discard' ? { kind: 'discard', canTsumo: p.canTsumo, canRiichi: p.canRiichi } : { kind: 'ron', tile: p.tile };
    }
    return {
      mySeat: me,
      humans: [...SEAT_OF_SLOT],
      names,
      hand: [...g.players[me].hand],
      handCounts: g.players.map((pl) => pl.hand.length),
      discards: g.players.map((pl) => [...pl.discards]),
      riichi: [...this.ex.riichi],
      points: [...this.points],
      dealer: g.dealer,
      turn: g.turn,
      roundWind: g.roundWind,
      dora: this.ex.doraIndicator,
      wall: g.live.length - g.livePos,
      lastDiscard: g.lastDiscard ? { tile: g.lastDiscard.tile, from: g.lastDiscard.from } : null,
      lastDrawn: g.turn === me && g.phase === 'discard' ? g.lastDrawn : null,
      handNo: this.handNo,
      totalHands: RIICHI_HANDS,
      acting,
      my,
      result: this.result,
      ready: [...this.ready],
    };
  }
}

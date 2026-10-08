// Solitaire-Wettrennen auf dem Server.
//
// Der Server spielt beide Bretter mit (`SoloBoard`) und nimmt nur gültige
// Züge an. Damit lässt sich der Gegnerbalken nicht fälschen, ohne dass der
// Server das Brett selbst lösen muss.

import { DUEL_COUNTDOWN_MS, DUEL_STUCK_PENALTY_MS, DUEL_TIME_CAP_MS, pickDuelLayout, SoloBoard } from '../../src/duel/solitaire';
import type { EndReason, SoloOp } from '../../src/duel/protocol';
import type { Match, RoomIO } from './io';

interface Player {
  board: SoloBoard;
  /** Zeitpunkt des letzten geräumten Paares (für den Gleichstand). */
  lastMatchAt: number;
  finishedAt: number | null;
  stuck: boolean;
  log: SoloOp[];
}

export class SoloMatch implements Match {
  over = false;
  private seed = 0;
  private layout = '';
  private startAt = 0;
  private round = 0;
  private players: Player[] = [];

  constructor(private io: RoomIO) {}

  start(round: number): void {
    this.round = round;
    this.over = false;
    this.seed = Math.floor(this.io.random() * 2 ** 31);
    this.layout = pickDuelLayout(this.seed);
    this.startAt = this.io.now() + DUEL_COUNTDOWN_MS;
    this.players = [0, 1].map((slot) => ({
      board: new SoloBoard(this.seed, this.layout, slot),
      lastMatchAt: this.startAt,
      finishedAt: null,
      stuck: false,
      log: [],
    }));
    for (const slot of [0, 1]) this.resync(slot);
    this.io.setTimer('cap', DUEL_COUNTDOWN_MS + DUEL_TIME_CAP_MS, () => this.timeUp());
  }

  resync(slot: number): void {
    if (!this.players.length) return;
    this.io.send(slot, {
      t: 'start',
      seed: this.seed,
      layout: this.layout,
      startAt: this.startAt,
      now: this.io.now(),
      round: this.round,
    });
    // Nach einem Neustart der App kennt der Client nur Seed und Figur. Mit dem
    // Zugprotokoll spielt er sein Brett bis zum Stand des Servers nach.
    if (this.players[slot].log.length) {
      this.io.send(slot, { t: 'replay', round: this.round, log: [...this.players[slot].log] });
    }
    for (const s of [0, 1]) this.sendProgress(s, slot);
  }

  private sendProgress(of: number, to?: number): void {
    const p = this.players[of];
    const msg = {
      t: 'progress' as const,
      slot: of,
      remaining: p.board.remaining,
      total: p.board.total,
      stuck: p.stuck,
    };
    if (to === undefined) for (const s of [0, 1]) this.io.send(s, msg);
    else this.io.send(to, msg);
  }

  onMsg(slot: number, msg: unknown): void {
    if (this.over || !this.players.length) return;
    const m = msg as { t: string; a?: number; b?: number };
    const p = this.players[slot];
    if (p.finishedAt !== null || p.stuck) return;
    const now = this.io.now();
    // Kleine Toleranz: Uhren und Netz sind nie ganz gleich.
    if (now < this.startAt - 1000) return;

    if (m.t === 'match' && typeof m.a === 'number' && typeof m.b === 'number') {
      if (!p.board.match(m.a, m.b)) return; // ungültig: Stand bleibt, kein Fortschritt
      p.log.push(['m', m.a, m.b]);
      p.lastMatchAt = now;
      if (p.board.remaining === 0) p.finishedAt = now;
    } else if (m.t === 'undo') {
      if (!p.board.undo()) return;
      p.log.push(['u']);
    } else if (m.t === 'shuffle') {
      if (!p.board.shuffle()) return;
      p.log.push(['s']);
    } else if (m.t === 'stuck') {
      // Nur glauben, wenn es wirklich keinen Zug gibt und Mischen nicht hilft.
      if (p.board.pairs().length > 0) return;
      if (p.board.shuffle()) return; // (passiert nicht, wenn der Client ehrlich ist)
      // Sackgasse ohne Ausweg (z. B. letztes Paar gestapelt): Der Rest wird
      // abgeräumt, dafür zählt die Zeit erst nach der Strafe.
      p.stuck = true;
      p.finishedAt = now + DUEL_STUCK_PENALTY_MS;
      this.io.setTimer(`stuck-${slot}`, DUEL_STUCK_PENALTY_MS, () => this.checkEnd());
    } else {
      return;
    }
    this.sendProgress(slot);
    this.checkEnd();
  }

  private checkEnd(): void {
    if (this.over) return;
    // Wer zuerst fertig ist, gewinnt. Ein festgefahrener Spieler ist erst nach
    // Ablauf seiner Strafzeit „fertig" — räumt der andere vorher ab, gewinnt er.
    const now = this.io.now();
    const done = [0, 1].filter((s) => {
      const f = this.players[s].finishedAt;
      return f !== null && f <= now;
    });
    if (!done.length) return;
    done.sort((x, y) => this.players[x].finishedAt! - this.players[y].finishedAt!);
    const [first, second] = done;
    if (second !== undefined && this.players[first].finishedAt === this.players[second].finishedAt) {
      return this.finish(null, 'clear');
    }
    this.finish(first, this.players[first].stuck ? 'stuck' : 'clear');
  }

  private timeUp(): void {
    if (!this.over) this.decideByRemaining('time');
  }

  private decideByRemaining(reason: EndReason): void {
    // Wer festgefahren ist, hat 0 Reststeine — seine Strafzeit läuft aber noch.
    const rest = this.players.map((p) => (p.stuck ? 0 : p.board.remaining));
    if (rest[0] !== rest[1]) return this.finish(rest[0] < rest[1] ? 0 : 1, reason);
    const [a, b] = this.players;
    if (a.lastMatchAt !== b.lastMatchAt) return this.finish(a.lastMatchAt < b.lastMatchAt ? 0 : 1, reason);
    this.finish(null, reason);
  }

  forfeit(slot: number): void {
    if (this.over || !this.players.length) return;
    this.finish(1 - slot, 'forfeit');
  }

  private finish(winner: number | null, reason: EndReason): void {
    if (this.over) return;
    this.over = true;
    this.io.clearTimer('cap');
    this.io.clearTimer('stuck-0');
    this.io.clearTimer('stuck-1');
    const results = this.players.map((p) => ({
      remaining: p.board.remaining,
      ms: p.finishedAt !== null ? p.finishedAt - this.startAt : null,
    }));
    for (const s of [0, 1]) this.io.send(s, { t: 'end', winner, reason, results });
  }
}

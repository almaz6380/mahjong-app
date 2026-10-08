// Ein Duell-Raum: zwei Plätze, Anwesenheit, Aufgabe nach Verbindungsabbruch,
// Revanche. Das eigentliche Spiel steckt in SoloMatch bzw. RiichiMatch.

import { DUEL_PROTOCOL, type DuelGame, type ServerMsg } from '../../src/duel/protocol';
import type { Match, RoomIO } from './io';
import { SoloMatch } from './soloMatch';
import { RiichiMatch } from './riichiMatch';

/** So lange darf ein Spieler weg sein, bevor er das laufende Duell verliert. */
export const RECONNECT_MS = 30000;

interface Seat {
  pid: string;
  name: string;
  online: boolean;
}

export class Room {
  private seats: (Seat | null)[] = [null, null];
  private match: Match;
  private round = 0;
  private started = false;
  private lastEnd: ServerMsg | null = null;
  private want = [false, false];

  constructor(readonly game: DuelGame, readonly code: string, private io: RoomIO) {
    const inner: RoomIO = {
      ...io,
      send: (slot, msg) => {
        if (msg.t === 'end') this.lastEnd = msg;
        io.send(slot, msg);
      },
    };
    this.match = game === 'riichi' ? new RiichiMatch(inner, () => this.seats.map((s) => s?.name ?? '')) : new SoloMatch(inner);
  }

  /** Läuft gerade ein Spiel (nicht vorbei, schon begonnen)? */
  get running(): boolean {
    return this.started && !this.match.over;
  }

  get empty(): boolean {
    return this.seats.every((s) => !s || !s.online);
  }

  /**
   * Welcher Platz gehört diesem Spieler? Ändert noch nichts — die Laufzeit
   * trägt erst die Verbindung ein und ruft dann `join`, damit alle Antworten
   * schon an die neue Verbindung gehen.
   */
  claim(pid: string, v: number): { slot: number } | { error: 'full' | 'version' | 'bad' } {
    if (v !== DUEL_PROTOCOL) return { error: 'version' };
    if (typeof pid !== 'string' || pid.length < 8 || pid.length > 64) return { error: 'bad' };
    let slot = this.seats.findIndex((s) => s?.pid === pid);
    if (slot < 0) slot = this.seats.findIndex((s) => s === null);
    if (slot < 0) return { error: 'full' };
    return { slot };
  }

  join(slot: number, pid: string, name: string): void {
    const clean = String(name ?? '').slice(0, 32);
    this.seats[slot] = { pid, name: clean, online: true };
    this.io.clearTimer(`gone-${slot}`);
    this.io.send(slot, { t: 'joined', slot, game: this.game, code: this.code, now: this.io.now() });
    this.sendPlayers();

    if (!this.started && this.seats.every((s) => s?.online)) {
      this.started = true;
      this.round = 1;
      this.lastEnd = null;
      this.match.start(this.round);
    } else if (this.started) {
      this.match.resync(slot);
      if (this.match.over && this.lastEnd) this.io.send(slot, this.lastEnd);
      if (this.match.over) this.io.send(slot, { t: 'rematch', want: [...this.want] });
    }
  }

  onMsg(slot: number, msg: unknown): void {
    const m = msg as { t?: string };
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'ping') return this.io.send(slot, { t: 'pong', now: this.io.now() });
    if (m.t === 'leave') {
      if (this.running) this.match.forfeit(slot);
      return;
    }
    if (m.t === 'rematch') {
      if (!this.match.over) return;
      this.want[slot] = true;
      for (const s of [0, 1]) this.io.send(s, { t: 'rematch', want: [...this.want] });
      if (this.want[0] && this.want[1] && this.seats.every((s) => s?.online)) {
        this.want = [false, false];
        this.lastEnd = null;
        this.round++;
        this.match.start(this.round);
      }
      return;
    }
    this.match.onMsg(slot, msg);
  }

  /** Verbindung weg. Läuft ein Spiel, hat der Spieler RECONNECT_MS Zeit. */
  disconnect(slot: number): void {
    const seat = this.seats[slot];
    if (!seat) return;
    seat.online = false;
    this.want[slot] = false;
    this.sendPlayers();
    if (this.running) {
      this.io.setTimer(`gone-${slot}`, RECONNECT_MS, () => {
        if (!this.seats[slot]?.online && this.running) this.match.forfeit(slot);
      });
    } else if (!this.started) {
      // Vor dem Start einfach den Platz freigeben.
      this.seats[slot] = null;
      this.sendPlayers();
    }
  }

  private sendPlayers(): void {
    const players = this.seats.map((s) => ({ name: s?.name ?? '', online: !!s?.online }));
    for (const s of [0, 1]) if (this.seats[s]?.online) this.io.send(s, { t: 'players', players });
  }
}

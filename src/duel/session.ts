// Ein laufendes Duell aus Sicht der Oberfläche — egal ob gegen einen Menschen
// über den Server oder gegen die KI auf dem Gerät. Puffert die Nachrichten der
// aktuellen Runde, damit ein Bildschirm, der erst später einhängt, nichts
// verpasst (Start, Nachspiel-Protokoll, Fortschritt des Gegners).

import type { ClientMsg, DuelGame, PlayerInfo, ServerMsg } from './protocol';
import { DuelConnection, type ConnStatus } from './net';
import { Room } from '../../worker/logic/room';
import type { RoomIO } from '../../worker/logic/io';
import { SoloBoard } from './solitaire';
import { randomName } from './identity';

type Listener = (m: ServerMsg) => void;

export class DuelSession {
  slot = -1;
  game: DuelGame | null = null;
  players: PlayerInfo[] = [];
  status: ConnStatus = 'connecting';
  /** Gegen die KI auf dem Gerät (halbe Münzen, kein Server). */
  readonly vsBot: boolean;
  private buf: ServerMsg[] = [];
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(s: ConnStatus) => void>();
  private transport: { send(m: ClientMsg): void; serverNow(): number; close(leave?: boolean): void };

  private constructor(vsBot: boolean) {
    this.vsBot = vsBot;
    this.transport = { send: () => {}, serverNow: () => Date.now(), close: () => {} };
  }

  /** Raum auf dem Server betreten. */
  static online(code: string): DuelSession {
    const s = new DuelSession(false);
    const conn = new DuelConnection(code, (m) => s.feed(m), (st) => s.setStatus(st));
    s.transport = conn;
    conn.start();
    return s;
  }

  /** Solitaire-Duell gegen die KI — dieselben Regeln, der Raum läuft lokal. */
  static vsComputer(myPid: string, myName: string): DuelSession {
    const s = new DuelSession(true);
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    let bot: Bot | null = null;
    const io: RoomIO = {
      // Wie übers Netz: Nachrichten kommen asynchron an.
      send: (slot, msg) => setTimeout(() => (slot === 0 ? s.feed(msg) : bot?.onMsg(msg)), 0),
      now: () => Date.now(),
      random: () => Math.random(),
      setTimer: (name, ms, fn) => {
        const old = timers.get(name);
        if (old) clearTimeout(old);
        timers.set(name, setTimeout(fn, ms));
      },
      clearTimer: (name) => {
        const old = timers.get(name);
        if (old) clearTimeout(old);
        timers.delete(name);
      },
    };
    const room = new Room('solitaire', 'KI', io);
    bot = new Bot((m) => room.onMsg(1, m));
    s.transport = {
      send: (m) => room.onMsg(0, m),
      serverNow: () => Date.now(),
      close: () => {
        bot?.stop();
        bot = null;
        for (const t of timers.values()) clearTimeout(t);
        timers.clear();
      },
    };
    s.setStatus('open');
    room.join(0, myPid, myName);
    room.join(1, 'computer-gegner', randomName());
    return s;
  }

  private setStatus(st: ConnStatus): void {
    this.status = st;
    for (const fn of this.statusListeners) fn(st);
  }

  private feed(m: ServerMsg): void {
    if (m.t === 'joined') {
      this.slot = m.slot;
      this.game = m.game;
      this.buf = [];
    }
    if (m.t === 'players') this.players = m.players;
    // Neue Runde: Alte Nachrichten braucht niemand mehr.
    if (m.t === 'start' && !this.buf.some((x) => x.t === 'start' && x.round === m.round)) {
      this.buf = this.buf.filter((x) => x.t === 'joined' || x.t === 'players');
    }
    if (m.t !== 'pong') this.buf.push(m);
    if (this.buf.length > 400) this.buf.splice(2, this.buf.length - 300);
    for (const fn of this.listeners) fn(m);
  }

  subscribe(fn: Listener): () => void {
    for (const m of this.buf) fn(m);
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStatus(fn: (s: ConnStatus) => void): () => void {
    fn(this.status);
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  send(m: ClientMsg): void {
    this.transport.send(m);
  }

  serverNow(): number {
    return this.transport.serverNow();
  }

  close(leave = false): void {
    this.listeners.clear();
    this.statusListeners.clear();
    this.transport.close(leave);
  }
}

// ---------------------------------------------------------------------------

/**
 * Die KI im Solitaire-Duell. Spielt ein eigenes Brett mit menschlichem Tempo:
 * 2,8–5,5 s pro Paar, ab und zu eine längere Denkpause. Damit braucht sie für
 * ein Duell-Brett etwa zwei Minuten — schlagbar, aber nicht geschenkt.
 */
class Bot {
  private board: SoloBoard | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private round = -1;

  constructor(private send: (m: ClientMsg) => void) {}

  onMsg(m: ServerMsg): void {
    if (m.t === 'start' && m.round !== this.round) {
      this.round = m.round;
      this.board = new SoloBoard(m.seed, m.layout, 1);
      this.schedule(Math.max(0, m.startAt - Date.now()) + this.delay());
    }
    if (m.t === 'end') {
      this.stopTimer();
      // Revanche gegen die KI: Sie sagt immer zu.
      setTimeout(() => this.send({ t: 'rematch' }), 400);
    }
  }

  private delay(): number {
    const pause = Math.random() < 0.1 ? 4000 + Math.random() * 4000 : 0;
    return 2800 + Math.random() * 2700 + pause;
  }

  private schedule(ms: number): void {
    this.stopTimer();
    this.timer = setTimeout(() => this.step(), ms);
  }

  private step(): void {
    const b = this.board;
    if (!b || b.remaining === 0) return;
    const pairs = b.pairs();
    if (pairs.length) {
      const [a, c] = pairs[Math.floor(Math.random() * pairs.length)];
      b.match(a, c);
      this.send({ t: 'match', a, b: c });
    } else if (b.shuffle()) {
      this.send({ t: 'shuffle' });
    } else {
      this.send({ t: 'stuck' });
      return;
    }
    if (b.remaining > 0) this.schedule(this.delay());
  }

  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  stop(): void {
    this.stopTimer();
    this.board = null;
  }
}

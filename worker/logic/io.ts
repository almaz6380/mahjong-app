// Schnittstelle zwischen Spiellogik und Laufzeit. Im Worker steckt dahinter
// der Durable Object (WebSockets + setTimeout), im Test eine simulierte Uhr.
// So lässt sich die komplette Duell-Logik in Node prüfen.

import type { ServerMsg } from '../../src/duel/protocol';

export interface RoomIO {
  send(slot: number, msg: ServerMsg): void;
  now(): number;
  setTimer(name: string, ms: number, fn: () => void): void;
  clearTimer(name: string): void;
  random(): number;
}

export interface Match {
  /** Beide Spieler sind da — Spiel beginnen (auch für Revanche). */
  start(round: number): void;
  onMsg(slot: number, msg: unknown): void;
  /** Spieler hat sich (wieder) verbunden: aktuellen Stand nachschicken. */
  resync(slot: number): void;
  /** Spieler gibt auf bzw. ist nicht zurückgekommen. */
  forfeit(slot: number): void;
  readonly over: boolean;
}

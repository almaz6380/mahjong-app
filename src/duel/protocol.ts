// Nachrichten zwischen App und Duell-Server (worker/). Läuft auf beiden Seiten.
//
// Erhöhen, sobald sich Brett-Erzeugung oder Regeln ändern: Ein alter Client
// mit anderer Figuren-Rampe bekäme sonst ein anderes Brett als der Server.
export const DUEL_PROTOCOL = 1;

export type DuelGame = 'solitaire' | 'riichi';

/** Code-Alphabet ohne Verwechsler (0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 5;

export function normalizeCode(raw: string): string | null {
  const c = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== CODE_LEN) return null;
  for (const ch of c) if (!CODE_ALPHABET.includes(ch)) return null;
  return c;
}

export interface PlayerInfo {
  name: string;
  online: boolean;
}

// ---- Riichi-Ansicht (vom Server je Spieler zugeschnitten) -----------------

export interface RiichiScoredView {
  han: number;
  fu: number;
  points: number;
  yakuman: boolean;
  yaku: { name: string; han: number }[];
}

export interface RiichiHandResult {
  winner: number | null; // Platz, null = Wand leer
  tsumo: boolean;
  from: number | null; // Platz, der den Ron-Stein abgeworfen hat
  winTile: string | null;
  hand: string[] | null; // aufgedeckte Gewinnerhand
  scored: RiichiScoredView | null;
  delta: number[]; // Punkteänderung je Platz
}

export interface RiichiView {
  mySeat: number;
  humans: number[]; // Plätze der beiden Menschen
  names: string[]; // je Platz
  hand: string[]; // nur die eigene Hand
  handCounts: number[];
  discards: string[][];
  riichi: boolean[];
  points: number[];
  dealer: number;
  turn: number;
  roundWind: number;
  dora: string;
  wall: number;
  lastDiscard: { tile: string; from: number } | null;
  lastDrawn: string | null; // nur für mich, wenn ich am Zug bin
  handNo: number; // 1-basiert
  totalHands: number;
  /** Wer gerade handeln muss und bis wann (Serverzeit). */
  acting: { seat: number; deadline: number } | null;
  /** Meine möglichen Aktionen. */
  my: { kind: 'discard'; canTsumo: boolean; canRiichi: boolean } | { kind: 'ron'; tile: string } | null;
  result: RiichiHandResult | null;
  ready: boolean[]; // je Platz: „Weiter" gedrückt (nur Menschen relevant)
}

// ---- Nachrichten -------------------------------------------------------------

export type ClientMsg =
  | { t: 'hello'; pid: string; name: string; v: number }
  | { t: 'ping' }
  | { t: 'rematch' }
  | { t: 'leave' }
  // Solitaire
  | { t: 'match'; a: number; b: number }
  | { t: 'undo' }
  | { t: 'shuffle' }
  | { t: 'stuck' }
  // Riichi
  | { t: 'discard'; tile: string }
  | { t: 'tsumo' }
  | { t: 'riichi' }
  | { t: 'ron' }
  | { t: 'pass' }
  | { t: 'next' };

/** Ein Zug im Solitaire-Duell: Paar, Zurück oder Mischen. */
export type SoloOp = ['m', number, number] | ['u'] | ['s'];

export type EndReason = 'clear' | 'time' | 'forfeit' | 'stuck' | 'points';

export type ServerMsg =
  | { t: 'joined'; slot: number; game: DuelGame; code: string; now: number }
  | { t: 'players'; players: PlayerInfo[] }
  | { t: 'error'; code: 'notfound' | 'full' | 'version' | 'bad' }
  | { t: 'pong'; now: number }
  | { t: 'rematch'; want: boolean[] }
  // Solitaire
  | { t: 'start'; seed: number; layout: string; startAt: number; now: number; round: number }
  | { t: 'progress'; slot: number; remaining: number; total: number; stuck: boolean }
  /** Nach einem Neustart der App: eigene Züge in Reihenfolge zum Nachspielen. */
  | { t: 'replay'; round: number; log: SoloOp[] }
  // Riichi
  | { t: 'rstate'; view: RiichiView; now: number }
  // Beide
  | {
      t: 'end';
      winner: number | null; // Slot, null = unentschieden
      reason: EndReason;
      results: { remaining: number; ms: number | null; points?: number }[];
    };

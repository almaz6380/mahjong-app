// Mahjong Crush — Level-Definitionen. Deterministisch generiert (gleicher Seed
// -> gleiches Level für alle Spieler), Schwierigkeitsrampe über 50 Level.

import { mulberry32, seedFromString } from '../../game/engine';
import { ROWS, COLS } from './logic';

export const LEVEL_COUNT = 50;

export type Goal =
  | { kind: 'score'; target: number }
  | { kind: 'collect'; sort: number; target: number }
  | { kind: 'blocks' }; // alle Jade-Blöcke räumen

export interface BlockDef {
  cell: number; // Zell-Index (r*COLS+c)
  armor: number; // 1 = einfach, 2 = doppelt gepanzert
}

export interface LevelDef {
  id: number; // 1-basiert
  seed: number; // Seed fürs Brett
  k: number; // Anzahl Stein-Sorten
  moves: number; // Zug-Limit
  goals: Goal[];
  blocks: BlockDef[];
}

function makeDef(id: number): LevelDef {
  const rand = mulberry32(seedFromString('crush-def-' + id));
  const k = id < 8 ? 5 : 6;
  const moves = Math.max(14, 24 - Math.floor(id / 5));
  const goals: Goal[] = [];
  const blocks: BlockDef[] = [];

  // Level-Typ rotiert: 0 = Punkte, 1 = Sammeln, 2 = Blöcke (ab L6), höhere Level kombinieren.
  const type = id <= 3 ? 0 : id % 3;

  if (type === 2 && id >= 6) {
    const count = Math.min(2 + Math.floor((id - 6) / 3), 12);
    const used = new Set<number>();
    for (let n = 0; n < count; n++) {
      // Nicht in der obersten Reihe (Optik) und keine Duplikate.
      let cell = 0;
      for (let tries = 0; tries < 50; tries++) {
        const r = 1 + ((rand() * (ROWS - 1)) | 0);
        const c = (rand() * COLS) | 0;
        cell = r * COLS + c;
        if (!used.has(cell)) break;
      }
      if (used.has(cell)) continue;
      used.add(cell);
      blocks.push({ cell, armor: id >= 20 && n % 3 === 0 ? 2 : 1 });
    }
    goals.push({ kind: 'blocks' });
    // Kombiniert ab L25: zusätzlich sammeln.
    if (id >= 25) goals.push({ kind: 'collect', sort: (rand() * k) | 0, target: Math.round(moves * 0.8) });
  } else if (type === 1) {
    const sort = (rand() * k) | 0;
    goals.push({ kind: 'collect', sort, target: Math.round(moves * (0.9 + id * 0.012)) });
    if (id >= 30) goals.push({ kind: 'collect', sort: (sort + 1 + ((rand() * (k - 1)) | 0)) % k, target: Math.round(moves * 0.6) });
  } else {
    goals.push({ kind: 'score', target: Math.round((moves * (32 + id)) / 50) * 50 });
  }

  return { id, seed: seedFromString('crush-board-' + id), k, moves, goals, blocks };
}

export const LEVELS: LevelDef[] = Array.from({ length: LEVEL_COUNT }, (_, i) => makeDef(i + 1));

export function levelDef(id: number): LevelDef {
  return LEVELS[Math.min(Math.max(id, 1), LEVEL_COUNT) - 1];
}

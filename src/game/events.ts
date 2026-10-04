// Event des Tages — deterministisch aus dem Datum. Für einen der Modi gibt es
// heute einen einmaligen Münz-Bonus, wenn man ihn abschließt.
import { seedFromString } from './engine';
import { todayStr } from './progress';

// Nur Modi, deren recordModeBest-Key == modeId ist (zentraler Bonus-Hook).
export const EVENT_MODES = ['tilematch', 'blitz', 'merge', 'match3', 'sudoku'] as const;
export type EventMode = (typeof EVENT_MODES)[number];

export interface DailyEvent {
  mode: EventMode;
  titleKey: string;
  bonus: number;
}

const TITLE: Record<EventMode, string> = {
  tilematch: 'mode.tilematch',
  blitz: 'mode.blitz',
  merge: 'mode.merge',
  match3: 'mode.match3',
  sudoku: 'mode.sudoku',
};

export function todayEvent(dateStr: string = todayStr()): DailyEvent {
  const idx = seedFromString('event-' + dateStr) % EVENT_MODES.length;
  const mode = EVENT_MODES[idx];
  return { mode, titleKey: TITLE[mode], bonus: 40 };
}

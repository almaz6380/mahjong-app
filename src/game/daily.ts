import { deckForCount } from './tiles';
import { LAYOUTS } from './layouts';
import { buildNeighbors, generateBoard, mulberry32, seedFromString, type PlacedTile } from './engine';
import { todayStr } from './progress';

// Deterministische Tages-Challenge: gleicher Seed pro Tag -> gleiches Board für alle.
const DAILY_LAYOUT = 'turtle';
export const DAILY_REWARD = 100;

export function dailyLayoutName(): string {
  return DAILY_LAYOUT;
}

export function makeDailyBoard(dateStr: string = todayStr()): PlacedTile[] {
  const layout = LAYOUTS[DAILY_LAYOUT];
  const nb = buildNeighbors(layout.cells);
  const rand = mulberry32(seedFromString('daily-' + dateStr));
  return generateBoard(layout.cells, nb, deckForCount(layout.cells.length), rand);
}

export function dailyDoneToday(lastDaily: string): boolean {
  return lastDaily === todayStr();
}

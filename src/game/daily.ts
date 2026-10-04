import { deckForCount } from './tiles';
import { LAYOUTS } from './layouts';
import { buildNeighbors, generateBoard, mulberry32, seedFromString, type PlacedTile } from './engine';
import { todayStr } from './progress';
import { applyHidden, modsForLevel } from './modifiers';

// Deterministische Tages-Challenge: gleicher Seed pro Tag -> gleiches Board für alle.
const DAILY_LAYOUT = 'daily';
export const DAILY_REWARD = 30;

export function dailyLayoutName(): string {
  return DAILY_LAYOUT;
}

export function makeDailyBoard(dateStr: string = todayStr()): PlacedTile[] {
  const layout = LAYOUTS[DAILY_LAYOUT];
  const nb = buildNeighbors(layout.cells);
  const rand = mulberry32(seedFromString('daily-' + dateStr));
  const tiles = generateBoard(layout.cells, nb, deckForCount(layout.cells.length), rand);

  // Verdeckte Steine auch hier — aber ⚠ MIT demselben Datums-Seed. Mit
  // `Math.random` läge das Brett zwar gleich, die verdeckten Stellen wären aber
  // bei jedem Spieler andere, und die Tagesbestenliste vergliche
  // Ungleichartiges. Der Seed läuft nach der Bretterzeugung weiter, ist also
  // ein anderer Zustand als oben und trotzdem reproduzierbar.
  const mods = modsForLevel(DAILY_HIDDEN_SEED_LEVEL, layout.cells.length, { rated: true });
  return applyHidden(tiles, mods.hidden, rand);
}

// Die Tages-Challenge hat keine Levelnummer. Damit sie trotzdem in die Rampe
// passt, wird sie fest wie ein Level der Mitte behandelt: verdeckte Steine ja,
// aber in ruhigem Mass.
const DAILY_HIDDEN_SEED_LEVEL = 60;

export function dailyDoneToday(lastDaily: string): boolean {
  return lastDaily === todayStr();
}

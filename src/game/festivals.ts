// Saison-Feste: datumsbasierte Events mit passenden Figuren-Sets aus dem
// Generator. Während eines Fests zeigt die Startseite ein Banner; der erste
// Fest-Sieg pro Tag bringt einen Münz-Bonus (progress.lastFestival).

import { allFigures, type Figure } from './figures';

export interface Festival {
  id: string;
  titleKey: string; // fest.<id>
  emoji: string;
  shapePrefix: string; // Grundformen-Filter (figures.shape.startsWith)
  bonus: number;
  from: [number, number]; // [Monat, Tag] inklusive
  to: [number, number];
}

export const FESTIVALS: Festival[] = [
  { id: 'laterne', titleKey: 'fest.laterne', emoji: '🏮', shapePrefix: 'laterne', bonus: 50, from: [2, 10], to: [2, 24] },
  { id: 'sakura', titleKey: 'fest.sakura', emoji: '🌸', shapePrefix: 'bluete', bonus: 50, from: [3, 20], to: [4, 10] },
  { id: 'drache', titleKey: 'fest.drache', emoji: '🐉', shapePrefix: 'drache', bonus: 50, from: [5, 28], to: [6, 10] },
  { id: 'mond', titleKey: 'fest.mond', emoji: '🌕', shapePrefix: 'ring', bonus: 50, from: [9, 15], to: [10, 1] },
];

const key = (m: number, d: number) => m * 100 + d;

export function activeFestival(date: Date = new Date()): Festival | null {
  const now = key(date.getMonth() + 1, date.getDate());
  return (
    FESTIVALS.find((f) => {
      const a = key(f.from[0], f.from[1]);
      const b = key(f.to[0], f.to[1]);
      return a <= b ? now >= a && now <= b : now >= a || now <= b; // über Jahreswechsel
    }) ?? null
  );
}

// Fest-Figur des Tages: rotiert deterministisch durch die passenden Boards.
export function festivalFigure(fest: Festival, date: Date = new Date()): Figure {
  const figs = allFigures().filter((f) => f.shape.startsWith(fest.shapePrefix));
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return figs[dayOfYear % figs.length] ?? allFigures()[0];
}

// Board-Layouts als ASCII-Karten pro Ebene ('X' = Stein, '.' = leer).
// Spalte = Zeichen-Index, Zeile = Zeilen-Index, Ebene = Array-Index.
// Neue Layouts (z. B. eine echte "Schildkröte" mit Halb-Offsets) lassen sich
// hier einfach ergänzen. Wichtig: Gesamtzahl muss GERADE sein (Paare!).
// Die Level-Boards kommen seit v1.1 aus dem Figuren-Generator (figures.ts);
// die Layouts hier dienen noch der Tages-Challenge und dem Zeit-Blitz.

import { figureByName, figureForLevel } from './figures';

export interface Cell {
  col: number;
  row: number;
  layer: number;
}

export interface Layout {
  name: string;
  label: string;
  cells: Cell[];
}

function fromMaps(maps: string[][]): Cell[] {
  const cells: Cell[] = [];
  maps.forEach((rows, layer) => {
    rows.forEach((line, row) => {
      for (let col = 0; col < line.length; col++) {
        if (line[col] === 'X') cells.push({ col, row, layer });
      }
    });
  });
  return cells;
}

// "Classic" – gestufter Hügel mit 144 Steinen (100 + 40 + 4).
const CLASSIC = fromMaps([
  // Ebene 0 (Basis) – 100 Steine
  [
    '..XXXXXXXXXX..',
    '.XXXXXXXXXXXX.',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    '.XXXXXXXXXXXX.',
    '..XXXXXXXXXX..',
  ],
  // Ebene 1 – 40 Steine (10 breit × 4 hoch, mittig)
  [
    '..............',
    '..............',
    '..XXXXXXXXXX..',
    '..XXXXXXXXXX..',
    '..XXXXXXXXXX..',
    '..XXXXXXXXXX..',
    '..............',
    '..............',
  ],
  // Ebene 2 – 4 Steine (2 × 2, Spitze)
  [
    '..............',
    '..............',
    '..............',
    '......XX......',
    '......XX......',
    '..............',
    '..............',
    '..............',
  ],
]);

// "Mini" – kleiner, schneller Einstieg (64 Steine = 48 + 16).
const MINI = fromMaps([
  [
    'XXXXXXXXXXXX',
    'XXXXXXXXXXXX',
    'XXXXXXXXXXXX',
    'XXXXXXXXXXXX',
  ],
  [
    '............',
    '..XXXXXXXX..',
    '..XXXXXXXX..',
    '............',
  ],
]);

// "Pyramide" – gestufte Pyramide mit 4 Ebenen (84 + 40 + 12 + 4 = 140 Steine).
const PYRAMID = fromMaps([
  [
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
  ],
  [
    '..............',
    '..XXXXXXXXXX..',
    '..XXXXXXXXXX..',
    '..XXXXXXXXXX..',
    '..XXXXXXXXXX..',
    '..............',
  ],
  [
    '..............',
    '..............',
    '....XXXXXX....',
    '....XXXXXX....',
    '..............',
    '..............',
  ],
  [
    '..............',
    '..............',
    '......XX......',
    '......XX......',
    '..............',
    '..............',
  ],
]);

// "Schildkröte" – großes, dichtes Board (116 + 40 + 8 = 164 Steine).
const TURTLE = fromMaps([
  [
    '..XXXXXXXXXXXX..',
    '.XXXXXXXXXXXXXX.',
    'XXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXX',
    '.XXXXXXXXXXXXXX.',
    '..XXXXXXXXXXXX..',
  ],
  [
    '................',
    '................',
    '...XXXXXXXXXX...',
    '...XXXXXXXXXX...',
    '...XXXXXXXXXX...',
    '...XXXXXXXXXX...',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '......XXXX......',
    '......XXXX......',
    '................',
    '................',
    '................',
  ],
]);

// Kompakte Schildkröte für die Tages-Challenge (52 + 20 + 6 = 78 Steine).
// Klein genug, dass die Steine so groß sind wie in den Leveln.
const DAILY = fromMaps([
  [
    '.XXXXX.',
    'XXXXXXX',
    'XXXXXXX',
    'XXXXXXX',
    'XXXXXXX',
    'XXXXXXX',
    'XXXXXXX',
    '.XXXXX.',
  ],
  [
    '.......',
    '.XXXXX.',
    '.XXXXX.',
    '.XXXXX.',
    '.XXXXX.',
    '.......',
    '.......',
    '.......',
  ],
  [
    '.......',
    '.......',
    '.......',
    '..XXX..',
    '..XXX..',
    '.......',
    '.......',
    '.......',
  ],
]);

// Kompakter Hügel für den Zeit-Blitz (38 + 12 + 2 = 52 Steine).
const BLITZ = fromMaps([
  [
    '.XXXX.',
    'XXXXXX',
    'XXXXXX',
    'XXXXXX',
    'XXXXXX',
    'XXXXXX',
    '.XXXX.',
  ],
  [
    '......',
    '......',
    '.XXXX.',
    '.XXXX.',
    '.XXXX.',
    '......',
    '......',
  ],
  [
    '......',
    '......',
    '......',
    '..XX..',
    '......',
    '......',
    '......',
  ],
]);

export const LAYOUTS: Record<string, Layout> = {
  mini: { name: 'mini', label: 'layout.mini', cells: MINI },
  classic: { name: 'classic', label: 'layout.classic', cells: CLASSIC },
  pyramid: { name: 'pyramid', label: 'layout.pyramid', cells: PYRAMID },
  turtle: { name: 'turtle', label: 'layout.turtle', cells: TURTLE },
  daily: { name: 'daily', label: 'layout.dailyBoard', cells: DAILY },
  blitz: { name: 'blitz', label: 'layout.blitzBoard', cells: BLITZ },
};

// Layout per Name auflösen: klassische Namen (mini/classic/...) oder
// Generator-Figuren ('fig-<n>', siehe figures.ts).
export function getLayout(name: string): Layout {
  return figureByName(name) ?? LAYOUTS[name] ?? LAYOUTS.classic;
}

// Schwierigkeitsrampe: die Level laufen durch alle Generator-Figuren
// (klein & flach zuerst, groß & hoch später; >1000 einzigartige Boards).
// Die klassischen Layouts oben bleiben für Tages-Challenge & Zeit-Blitz.
export function layoutForLevel(level: number): Layout {
  return figureForLevel(level);
}

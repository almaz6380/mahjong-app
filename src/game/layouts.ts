// Board-Layouts als ASCII-Karten pro Ebene ('X' = Stein, '.' = leer).
// Spalte = Zeichen-Index, Zeile = Zeilen-Index, Ebene = Array-Index.
// Neue Layouts (z. B. eine echte "Schildkröte" mit Halb-Offsets) lassen sich
// hier einfach ergänzen. Wichtig: Gesamtzahl muss GERADE sein (Paare!).

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

export const LAYOUTS: Record<string, Layout> = {
  mini: { name: 'mini', label: 'Mini', cells: MINI },
  classic: { name: 'classic', label: 'Klassisch', cells: CLASSIC },
  pyramid: { name: 'pyramid', label: 'Pyramide', cells: PYRAMID },
  turtle: { name: 'turtle', label: 'Schildkröte', cells: TURTLE },
};

// Schwierigkeitsrampe: welches Layout gehört zu welchem Level?
//  Level 1–2:  Mini (schneller Einstieg)
//  Level 3–6:  Klassisch
//  Level 7+:   Pyramide / Schildkröte im Wechsel (endlos)
export function layoutForLevel(level: number): Layout {
  if (level <= 2) return LAYOUTS.mini;
  if (level <= 6) return LAYOUTS.classic;
  const hard = [LAYOUTS.pyramid, LAYOUTS.turtle];
  return hard[(level - 7) % hard.length];
}

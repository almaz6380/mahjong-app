// Definition der 144 Mahjong-Steine.
// Wir nutzen die Unicode-"Mahjong Tiles" (U+1F000..) als Grafik – keine Bild-Assets nötig.
// matchKey bestimmt, welche Steine zusammenpassen:
//  - normale Steine passen nur zu exakt gleichem Stein
//  - alle Blumen passen zueinander (matchKey 'flower')
//  - alle Jahreszeiten passen zueinander (matchKey 'season')
// group steuert die Farbe der Steine (siehe styles.css).

export type TileGroup =
  | 'char'
  | 'bam'
  | 'cir'
  | 'wind'
  | 'dragon'
  | 'flower'
  | 'season'
  | 'myth'
  | 'treasure';

export interface TileFace {
  id: string;
  glyph: string;
  matchKey: string;
  group: TileGroup;
}

const cp = (code: number) => String.fromCodePoint(code);

// Neue Serien (Entwurf 3): Mythen (龍/鳳/麒/龜) und Schätze (Laterne/Fächer/
// Münze/Glücksknoten). Jede Sorte 4× mit eigenem matchKey; sie kommen nur in
// größere Boards (siehe deckForCount), damit kleine Level klassisch bleiben.
const MYTHS: [string, string][] = [
  ['myth1', '龍'],
  ['myth2', '鳳'],
  ['myth3', '麒'],
  ['myth4', '龜'],
];
const TREASURES: [string, string][] = [
  ['treasure1', '🏮'],
  ['treasure2', '🪭'],
  ['treasure3', '🪙'],
  ['treasure4', '🪢'],
];

export function buildDeck(withSeries = false): TileFace[] {
  const faces: TileFace[] = [];

  const push4 = (id: string, glyph: string, group: TileGroup, matchKey = id) => {
    for (let i = 0; i < 4; i++) faces.push({ id, glyph, matchKey, group });
  };

  // Drei Farben à 1–9, jeweils 4×
  for (let r = 0; r < 9; r++) push4(`char${r + 1}`, cp(0x1f007 + r), 'char'); // Zahlen (Wan)
  for (let r = 0; r < 9; r++) push4(`bam${r + 1}`, cp(0x1f010 + r), 'bam'); // Bambus (Sou)
  for (let r = 0; r < 9; r++) push4(`cir${r + 1}`, cp(0x1f019 + r), 'cir'); // Kreise (Pin)

  // Winde O/S/W/N, jeweils 4×
  ['E', 'S', 'W', 'N'].forEach((w, i) => push4(`wind${w}`, cp(0x1f000 + i), 'wind'));

  // Drachen Rot/Grün/Weiß – als kräftig gefärbte CJK-Zeichen (nicht die Unicode-Kachel,
  // da der rote Drache sonst als einfarbiges Emoji erschiene).
  push4('dragonR', '中', 'dragon'); // Rot
  push4('dragonG', '發', 'dragon'); // Grün
  push4('dragonH', '白', 'dragon'); // Weiß

  // Blumen (je 1×, passen alle zueinander)
  for (let i = 0; i < 4; i++)
    faces.push({ id: `flower${i + 1}`, glyph: cp(0x1f022 + i), matchKey: 'flower', group: 'flower' });

  // Jahreszeiten (je 1×, passen alle zueinander)
  for (let i = 0; i < 4; i++)
    faces.push({ id: `season${i + 1}`, glyph: cp(0x1f026 + i), matchKey: 'season', group: 'season' });

  if (withSeries) {
    for (const [id, glyph] of MYTHS) push4(id, glyph, 'myth');
    for (const [id, glyph] of TREASURES) push4(id, glyph, 'treasure');
  }

  return faces; // 144 Steine, mit Serien 176
}

// Ab dieser Boardgröße mischen die neuen Serien mit. Die Bretter sind bewusst
// kompakt (max 8×9, ~140 Steine), damit die Steine groß bleiben – die Schwelle
// muss dazu passen, sonst erscheinen Mythen/Schätze nie und das Album bleibt leer.
const SERIES_MIN_TILES = 40;

// Deck passend zur Steinzahl eines Layouts.
//  - kleine Boards: klassisches 144er-Deck (generateBoard nutzt nur n/2 Paare).
//  - ab SERIES_MIN_TILES: + Mythen/Schätze (mehr Abwechslung auf größeren Boards).
//  - n > Deck: Deck paarweise erweitern, damit große Boards genug Steine haben.
export function deckForCount(n: number): TileFace[] {
  const base = buildDeck(n >= SERIES_MIN_TILES);
  if (n <= base.length) return base;
  const out = base.slice();
  for (let i = 0; out.length < n; i++) out.push(base[i]); // fügt ganze 4er-Gruppen -> Paarzahl bleibt gerade
  return out;
}

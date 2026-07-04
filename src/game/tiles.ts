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
  | 'season';

export interface TileFace {
  id: string;
  glyph: string;
  matchKey: string;
  group: TileGroup;
}

const cp = (code: number) => String.fromCodePoint(code);

export function buildDeck(): TileFace[] {
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

  return faces; // = 144 Steine
}

// Deck passend zur Steinzahl eines Layouts.
//  - n <= 144: das volle 144er-Deck (generateBoard nutzt nur n/2 Paare -> volle Varianz).
//  - n  > 144: Deck erweitern (paarweise), damit große Boards genug Steine haben.
export function deckForCount(n: number): TileFace[] {
  const base = buildDeck();
  if (n <= base.length) return base;
  const out = base.slice();
  for (let i = 0; out.length < n; i++) out.push(base[i]); // fügt ganze 4er-Gruppen -> Paarzahl bleibt gerade
  return out;
}

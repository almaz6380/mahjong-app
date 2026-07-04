// Steine-Modell für den 4-Spieler-Modus.
// Codes: 'm1'..'m9' (Zahlen/Wan), 's1'..'s9' (Bambus), 'p1'..'p9' (Kreise),
//        'z1'..'z7' (z1-4 Winde O/S/W/N, z5-7 Drachen Rot/Grün/Weiß),
//        Bonus: 'f1'..'f4' (Blumen), 'g1'..'g4' (Jahreszeiten).
// Die 34 Standard-Typen haben Index 0..33 (für Zähl-Arrays):
//   m1-9 = 0-8, s1-9 = 9-17, p1-9 = 18-26, z1-7 = 27-33.

export type TileCode = string;

const cp = (n: number) => String.fromCodePoint(n);

export function isBonus(code: TileCode): boolean {
  return code[0] === 'f' || code[0] === 'g';
}

// Index in ein 34er-Zähl-Array; -1 für Bonus.
export function tileIndex(code: TileCode): number {
  const s = code[0];
  const r = +code.slice(1);
  if (s === 'm') return r - 1;
  if (s === 's') return 9 + r - 1;
  if (s === 'p') return 18 + r - 1;
  if (s === 'z') return 27 + r - 1;
  return -1;
}

export function codeFromIndex(i: number): TileCode {
  if (i < 9) return 'm' + (i + 1);
  if (i < 18) return 's' + (i - 9 + 1);
  if (i < 27) return 'p' + (i - 18 + 1);
  return 'z' + (i - 27 + 1);
}

export function isSuited(i: number): boolean {
  return i < 27;
}
export function rankInSuit(i: number): number {
  return (i % 9) + 1; // nur sinnvoll für i<27
}

export function groupOf(code: TileCode): string {
  const s = code[0];
  if (s === 'm') return 'char';
  if (s === 's') return 'bam';
  if (s === 'p') return 'cir';
  if (s === 'f') return 'flower';
  if (s === 'g') return 'season';
  // z
  return +code.slice(1) <= 4 ? 'wind' : 'dragon';
}

export function glyph(code: TileCode): string {
  const s = code[0];
  const r = +code.slice(1);
  if (s === 'm') return cp(0x1f007 + r - 1);
  if (s === 's') return cp(0x1f010 + r - 1);
  if (s === 'p') return cp(0x1f019 + r - 1);
  if (s === 'f') return cp(0x1f022 + r - 1);
  if (s === 'g') return cp(0x1f026 + r - 1);
  // z: 1-4 Winde, 5-7 Drachen
  if (r <= 4) return cp(0x1f000 + r - 1);
  return ['中', '發', '白'][r - 5];
}

// Textfarbe des Steins (passend zu den Solitaire-Farben).
export function tileColor(code: TileCode): string {
  const s = code[0];
  if (s === 'm') return '#24406e';
  if (s === 's') return '#1f8a4d';
  if (s === 'p') return '#1f5fa8';
  if (s === 'f') return '#c2418a';
  if (s === 'g') return '#b7791f';
  const r = +code.slice(1);
  if (r <= 4) return '#3c4a5a'; // Winde
  return ['#c0392b', '#1f8a4d', '#2a5fa8'][r - 5]; // Drachen R/G/W
}

// Für spezielle aria-labels der Drachen (Farbe im CSS).
export function dragonKey(code: TileCode): string | null {
  if (code === 'z5') return 'dragonR';
  if (code === 'z6') return 'dragonG';
  if (code === 'z7') return 'dragonH';
  return null;
}

// Volle Mauer: 4× jeder der 34 Standard-Typen (136) + je 1× 8 Bonus = 144.
export function buildWall(rand: () => number = Math.random): TileCode[] {
  const wall: TileCode[] = [];
  for (let i = 0; i < 34; i++) {
    const c = codeFromIndex(i);
    for (let k = 0; k < 4; k++) wall.push(c);
  }
  for (let r = 1; r <= 4; r++) wall.push('f' + r);
  for (let r = 1; r <= 4; r++) wall.push('g' + r);
  // Fisher–Yates
  for (let i = wall.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  return wall;
}

// Zähl-Array (Länge 34) aus Hand-Codes (Bonus wird ignoriert).
export function toCounts(codes: TileCode[]): Int8Array {
  const c = new Int8Array(34);
  for (const code of codes) {
    const i = tileIndex(code);
    if (i >= 0) c[i]++;
  }
  return c;
}

// Hand hübsch sortieren (m<s<p<z, dann Rang; Bonus ans Ende).
export function sortHand(codes: TileCode[]): TileCode[] {
  const order = (c: TileCode) => {
    const i = tileIndex(c);
    if (i >= 0) return i;
    return 100 + (c.charCodeAt(0) - 'f'.charCodeAt(0)) * 10 + +c.slice(1);
  };
  return [...codes].sort((a, b) => order(a) - order(b));
}

// Prozeduraler Figuren-Generator: erzeugt >1000 einzigartige Board-Figuren
// (Entwurf 3, freigegeben 13.7.2026). 29 Grundformen (analytisch + ASCII) werden
// mit Größe × Höhenprofil × Aushöhlung variiert, teils gespiegelt. Garantien:
//  - gerade Steinzahl (Paare), 24–190 Steine
//  - obere Ebenen stehen immer auf der Ebene darunter (kein Schweben)
//  - keine Duplikate (Zell-Signatur)
//  - lösbar: Rückwärts-Konstruktion der Engine + Headless-Test über alle Figuren
// Alles deterministisch (kein Math.random) -> Level N zeigt immer dieselbe Figur.

import type { Cell, Layout } from './layouts';

/* ---------- Bitmasken ---------- */
interface Mask {
  w: number;
  h: number;
  a: Uint8Array;
}

const newMask = (w: number, h: number): Mask => ({ w, h, a: new Uint8Array(w * h) });
const get = (m: Mask, c: number, r: number) =>
  c >= 0 && r >= 0 && c < m.w && r < m.h && m.a[r * m.w + c] === 1;
const cnt = (m: Mask) => m.a.reduce((s, v) => s + v, 0);
const cloneMask = (m: Mask): Mask => ({ w: m.w, h: m.h, a: Uint8Array.from(m.a) });

function erode(m: Mask): Mask {
  const o = newMask(m.w, m.h);
  for (let r = 0; r < m.h; r++)
    for (let c = 0; c < m.w; c++)
      if (get(m, c, r) && get(m, c - 1, r) && get(m, c + 1, r) && get(m, c, r - 1) && get(m, c, r + 1))
        o.a[r * m.w + c] = 1;
  return o;
}

// Maske auf ein Zielraster umrechnen (Nearest Neighbor) – bringt die ASCII-Formen
// auf dieselben Größenstufen wie die analytischen (siehe SIZES).
function resample(m: Mask, w: number, h: number): Mask {
  const o = newMask(w, h);
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const sr = Math.min(m.h - 1, Math.floor(((r + 0.5) / h) * m.h));
      const sc = Math.min(m.w - 1, Math.floor(((c + 0.5) / w) * m.w));
      if (get(m, sc, sr)) o.a[r * w + c] = 1;
    }
  return o;
}

function sub(m: Mask, k: Mask): Mask {
  const o = cloneMask(m);
  for (let r = 0; r < m.h; r++)
    for (let c = 0; c < m.w; c++) if (get(k, c, r)) o.a[r * m.w + c] = 0;
  return o;
}

const ringOf = (m: Mask) => sub(m, erode(m));

function mirrorMask(m: Mask): Mask {
  const o = newMask(m.w, m.h);
  for (let r = 0; r < m.h; r++)
    for (let c = 0; c < m.w; c++) if (get(m, c, r)) o.a[r * m.w + (m.w - 1 - c)] = 1;
  return o;
}

function fromAscii(rows: string[]): Mask {
  const m = newMask(rows[0].length, rows.length);
  rows.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) if (line[c] === 'X') m.a[r * m.w + c] = 1;
  });
  return m;
}

// Analytische Form: f(u, y) auf normierten Koordinaten (-1..1, y zeigt nach oben).
type ShapeFn = (u: number, y: number) => boolean;
function analytic(f: ShapeFn, w: number, h: number): Mask {
  const m = newMask(w, h);
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const u = ((c + 0.5) / w) * 2 - 1;
      const y = 1 - ((r + 0.5) / h) * 2;
      if (f(u, y)) m.a[r * w + c] = 1;
    }
  return m;
}

/* ---------- Grundformen ---------- */
const ANALYTIC: [string, ShapeFn][] = [
  ['herz', (u, y) => {
    const x = u * 1.18, Y = y * 1.18 - 0.12;
    const q = x * x + Y * Y - 1;
    return q * q * q - x * x * Y * Y * Y < 0;
  }],
  ['raute', (u, y) => Math.abs(u) + Math.abs(y) <= 1.02],
  ['ring', (u, y) => { const r = Math.hypot(u, y); return r <= 0.99 && r >= 0.44; }],
  ['sanduhr', (u, y) => Math.abs(u) <= 0.24 + 0.76 * Math.abs(y)],
  ['kreuz', (u, y) => Math.abs(u) <= 0.36 || Math.abs(y) <= 0.36],
  ['halbmond', (u, y) => Math.hypot(u, y) <= 0.99 && Math.hypot(u - 0.45, y) >= 0.62],
  ['sechseck', (u, y) => Math.abs(u) <= 0.92 && 0.5 * Math.abs(u) + 0.82 * Math.abs(y) <= 0.82],
  ['auge', (u, y) => Math.hypot(u, y / 0.62) <= 0.99],
  ['pfeil', (u, y) => (y >= 0 ? Math.abs(u) <= (1 - y) * 0.98 : Math.abs(u) <= 0.3)],
  ...[4, 5, 6, 8].map((n): [string, ShapeFn] => [
    `stern${n}`,
    (u, y) => Math.hypot(u, y) <= 0.44 + 0.5 * Math.cos(n * Math.atan2(y, u) - (n * Math.PI) / 2),
  ]),
  ...[4, 5, 6].map((n): [string, ShapeFn] => [
    `bluete${n}`,
    (u, y) => Math.hypot(u, y) <= 0.34 + 0.62 * Math.pow(Math.abs(Math.cos((n * Math.atan2(y, u)) / 2)), 1.15),
  ]),
];

const ASCII: Record<string, string[]> = {
  drache: ['.XXXXXXX', 'XXXXXXXX', 'XX......', 'XX......', 'XXXXXXX.', '.XXXXXXX', '......XX', '......XX', 'XXXXXXXX', 'XXXXXXX.'],
  tor: ['XXXXXXXXXX', '.XXXXXXXX.', '..XX..XX..', '.XXXXXXXX.', '..XX..XX..', '..XX..XX..', '..XX..XX..', '.XXX..XXX.'],
  krone: ['X...X...X', 'X...X...X', 'XX.XXX.XX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '.XXXXXXX.'],
  fisch: ['....XXXX..', 'X..XXXXXX.', 'XX.XXXXXXX', 'XXXXXXXXXX', 'XX.XXXXXXX', 'X..XXXXXX.', '....XXXX..'],
  krabbe: ['XX......XX', '.XX....XX.', '..XXXXXX..', '.XXXXXXXX.', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '..X.XX.X..'],
  fledermaus: ['XX......XX', 'XXX....XXX', 'XXXX..XXXX', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXX..XXX.', '..X....X..'],
  laterne: ['..XX..', '.XXXX.', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX', '.XXXX.', '..XX..', '..XX..'],
  bruecke: ['....XX....', '..XXXXXX..', '.XXXXXXXX.', 'XXXX..XXXX', 'XXX....XXX', 'XX......XX', 'XX......XX'],
  schmetterling: ['XXX...XXX', 'XXXX.XXXX', 'XXXXXXXXX', '.XXXXXXX.', 'XXXXXXXXX', 'XXXX.XXXX', 'XXX...XXX'],
  rahmen: ['XXXXXXXX', 'XXXXXXXX', 'XX....XX', 'XX....XX', 'XX....XX', 'XX....XX', 'XXXXXXXX', 'XXXXXXXX'],
  schildkroete: ['..XXXX..', '.XXXXXX.', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..'],
  knospe: ['..XX..', '.XXXX.', 'XXXXXX', 'XXXXXX', 'XXXXXX', '.XXXX.', '..XX..'],
  turm: ['XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX'],
};

// Nur erkennbar unsymmetrische Formen werden zusätzlich gespiegelt.
const MIRRORABLE = new Set(['drache', 'fisch', 'halbmond']);

export type FigureSize = 'winzig' | 'klein' | 'mittel' | 'groß' | 'riesig';

export interface Figure extends Layout {
  shape: string; // Grundform, z. B. 'drache' -> i18n-Key 'fig.drache'
  sizeLabel: FigureSize;
  profile: string;
  shaft: string;
  mirrored: boolean;
  layerCount: number;
  cols: number; // Brettbreite in Zellen (für Level-Rampe & Modus-Filter)
  rows: number;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildFigures(): Figure[] {
  interface Base { shape: string; sizeLabel: FigureSize; mask: Mask; mirrored?: boolean }
  const bases: Base[] = [];

  // Größenstufen: Brett bleibt handlich (max 8×9), damit die Steine groß bleiben.
  const SIZES: [FigureSize, number, number][] = [
    ['winzig', 4, 5], ['klein', 5, 6], ['mittel', 6, 7], ['groß', 7, 8], ['riesig', 8, 9],
  ];
  for (const [key, f] of ANALYTIC)
    for (const [sizeLabel, w, h] of SIZES) bases.push({ shape: key, sizeLabel, mask: analytic(f, w, h) });

  // ASCII-Formen auf dieselben Raster bringen (statt dilate/erode-Sonderweg).
  for (const key of Object.keys(ASCII)) {
    const b = fromAscii(ASCII[key]);
    for (const [sizeLabel, w, h] of SIZES) {
      const m = resample(b, w, h);
      if (cnt(m) >= 12) bases.push({ shape: key, sizeLabel, mask: m });
    }
  }

  const withMirror: Base[] = [];
  for (const b of bases) {
    withMirror.push(b);
    if (MIRRORABLE.has(b.shape)) withMirror.push({ ...b, mask: mirrorMask(b.mask), mirrored: true });
  }

  const seen = new Set<string>();
  const out: (Figure & { hash: number })[] = [];

  for (const b of withMirror) {
    const e1 = erode(b.mask), e2 = erode(e1), e3 = erode(e2);
    // Kein flaches Profil mehr – einschichtige Bretter sind trivial. Jede Figur
    // hat mindestens zwei Ebenen (unten erzwungen, falls eine Ebene wegdünnt).
    const profiles: [string, Mask[]][] = [
      ['2 Ebenen', [b.mask, e1]],
      ['3 Ebenen', [b.mask, e1, e2]],
      ['4 Ebenen', [b.mask, e1, e2, e3]],
      ['Randkrone', [b.mask, ringOf(b.mask)]],
      ['Zinnen', [b.mask, e1, ringOf(e1)]],
    ];

    // Aushöhlungen stanzen ganze Säulen (gleiches Prädikat auf ALLEN Ebenen),
    // damit obere Steine getragen bleiben.
    const cx = b.mask.w / 2, cy = b.mask.h / 2;
    const hofSrc = cnt(e3) >= 2 ? e3 : null;
    const shafts: [string, ((c: number, r: number) => boolean) | null][] = [
      ['massiv', null],
      ['Innenhof', hofSrc
        ? (c, r) => get(hofSrc, c, r)
        : (c, r) => Math.abs(c + 0.5 - cx) < 1 && Math.abs(r + 0.5 - cy) < 1],
    ];
    // Doppelschacht nur, wenn zwischen den Schächten mindestens ein Steg bleibt –
    // bei schmalen Formen verschmelzen sie sonst zu einem Mittelschlitz.
    const lc = Math.max(1, Math.round(b.mask.w * 0.22));
    if (b.mask.w >= 3 + 2 * lc) {
      const rc = b.mask.w - 1 - lc;
      shafts.push(['Doppelschacht', (c, r) => (c === lc || c === rc) && Math.abs(r + 0.5 - cy) <= 1.5]);
    }

    for (const [profile, layersRaw] of profiles) {
      for (const [shaft, pred] of shafts) {
        let layers = layersRaw.map((m) => {
          if (!pred) return m;
          const o = cloneMask(m);
          for (let r = 0; r < m.h; r++)
            for (let c = 0; c < m.w; c++) if (pred(c, r)) o.a[r * m.w + c] = 0;
          return o;
        });
        layers = layers.filter((m, i) => i === 0 || cnt(m) >= 4);
        if (cnt(layers[0]) < 14) continue;
        if (layers.length < 2) continue; // keine flachen Bretter (obere Ebene weggedünnt)

        let cells: Cell[] = [];
        layers.forEach((m, layer) => {
          for (let r = 0; r < m.h; r++)
            for (let c = 0; c < m.w; c++) if (get(m, c, r)) cells.push({ col: c, row: r, layer });
        });
        if (cells.length % 2 === 1) {
          // Parität: einen Stein der obersten Ebene entfernen (Paare!)
          const top = Math.max(...cells.map((t) => t.layer));
          cells.splice(cells.findIndex((t) => t.layer === top), 1);
        }
        if (cells.length < 20 || cells.length > 190) continue;

        const minC = Math.min(...cells.map((t) => t.col));
        const minR = Math.min(...cells.map((t) => t.row));
        cells = cells.map((t) => ({ col: t.col - minC, row: t.row - minR, layer: t.layer }));

        const sig = cells.map((t) => `${t.col},${t.row},${t.layer}`).sort().join(';');
        if (seen.has(sig)) continue;
        seen.add(sig);

        out.push({
          name: '', // wird nach der Sortierung als stabiler Index vergeben
          label: `fig.${b.shape}`,
          shape: b.shape,
          sizeLabel: b.sizeLabel,
          profile,
          shaft,
          mirrored: !!b.mirrored,
          cells,
          layerCount: Math.max(...cells.map((t) => t.layer)) + 1,
          cols: Math.max(...cells.map((t) => t.col)) + 1,
          rows: Math.max(...cells.map((t) => t.row)) + 1,
          hash: hashStr(sig),
        });
      }
    }
  }

  // Level-Rampe: kleines Brett zuerst, damit die Steine früh groß sind. Reine
  // Steinzahl reicht dafür nicht (dünne Sterne sind breit trotz weniger Steine),
  // reine Größen-Buckets würden die Schwierigkeit am Bucket-Rand einbrechen lassen.
  // Deshalb: Steinzahl + Aufschlag je Größenstufe -> Stufen überlappen weich.
  // Stufen entsprechen den Steingrößen auf dem Handy: ≤5×6 ≈ 75 px, ≤6×7 ≈ 63,
  // ≤7×8 ≈ 55, 8×9 ≈ 48.
  const tier = (f: { cols: number; rows: number }) =>
    f.cols <= 5 && f.rows <= 6 ? 0 : f.cols <= 6 && f.rows <= 7 ? 1 : f.cols <= 7 && f.rows <= 8 ? 2 : 3;
  // Schwierigkeit = Grundfläche (Steingröße-Rampe) + Tiefe. Die Ebenen-Zahl geht
  // mit ein, damit früh 2 Ebenen kommen, zur Mitte 3, spät 3–4 – ohne die
  // Grundfläche (= Steingröße) durcheinanderzubringen (Tier dominiert mit ×30).
  const score = (f: (typeof out)[number]) => f.cells.length + 30 * tier(f) + 12 * f.layerCount;
  out.sort((a, b) => score(a) - score(b) || a.hash - b.hash);

  // Abwechslung: direkt aufeinanderfolgende Level nie mit derselben Grundform.
  for (let i = 1; i < out.length - 1; i++) {
    if (out[i].shape === out[i - 1].shape) {
      let j = i + 1;
      while (j < out.length && out[j].shape === out[i - 1].shape) j++;
      if (j < out.length) {
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
    }
  }

  out.forEach((f, i) => (f.name = `fig-${i + 1}`));
  return out;
}

let cache: Figure[] | null = null;
export function allFigures(): Figure[] {
  if (!cache) cache = buildFigures();
  return cache;
}

// Level -> Figur entlang der Rampe; nach der letzten Figur beginnt sie von vorn.
export function figureForLevel(level: number): Figure {
  const figs = allFigures();
  return figs[(Math.max(1, Math.floor(level)) - 1) % figs.length];
}

// 'fig-<n>' -> Figur (für useGame/newGame über den Layout-Namen).
export function figureByName(name: string): Figure | undefined {
  if (!name.startsWith('fig-')) return undefined;
  const idx = +name.slice(4) - 1;
  const figs = allFigures();
  return figs[idx] ?? undefined;
}

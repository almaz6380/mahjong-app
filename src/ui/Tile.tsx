// Gezeichnete SVG-Steine – gemeinsam für Solitaire und 4-Spieler.
// Nimmt entweder eine Solitaire-id ('char3','bam5','cir7','windE','dragonR','flower1','season2')
// oder einen 4-Spieler-Code ('m3','s5','p7','z1','z5','f1','g1') und zeichnet Korpus + Motiv.

type Suit = 'man' | 'sou' | 'pin' | 'wind' | 'dragon' | 'flower' | 'season' | 'myth' | 'treasure';
interface Face { suit: Suit; rank: number }

export function normalizeFace(key: string): Face {
  // 4-Spieler-Codes
  if (/^[mspz][0-9]$/.test(key) || /^[fg][0-9]$/.test(key)) {
    const s = key[0];
    const r = +key.slice(1);
    if (s === 'm') return { suit: 'man', rank: r };
    if (s === 's') return { suit: 'sou', rank: r };
    if (s === 'p') return { suit: 'pin', rank: r };
    if (s === 'f') return { suit: 'flower', rank: r };
    if (s === 'g') return { suit: 'season', rank: r };
    // z
    return r <= 4 ? { suit: 'wind', rank: r } : { suit: 'dragon', rank: r - 4 };
  }
  // Solitaire-ids
  if (key.startsWith('char')) return { suit: 'man', rank: +key.slice(4) };
  if (key.startsWith('bam')) return { suit: 'sou', rank: +key.slice(3) };
  if (key.startsWith('cir')) return { suit: 'pin', rank: +key.slice(3) };
  if (key.startsWith('wind')) return { suit: 'wind', rank: { E: 1, S: 2, W: 3, N: 4 }[key.slice(4)] ?? 1 };
  if (key.startsWith('dragon')) return { suit: 'dragon', rank: { R: 1, G: 2, H: 3 }[key.slice(6)] ?? 1 };
  if (key.startsWith('flower')) return { suit: 'flower', rank: +key.slice(6) };
  if (key.startsWith('season')) return { suit: 'season', rank: +key.slice(6) };
  if (key.startsWith('myth')) return { suit: 'myth', rank: +key.slice(4) };
  if (key.startsWith('treasure')) return { suit: 'treasure', rank: +key.slice(8) };
  return { suit: 'man', rank: 1 };
}

// Einmalige gemeinsame Defs (Verläufe) – in main.tsx gemountet.
export function TileDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <linearGradient id="tbody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#fdf9ef" />
          <stop offset="1" stopColor="#f0e7d3" />
        </linearGradient>
        {/* Glanz oben auf der Deckfläche */}
        <linearGradient id="tgloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tback" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a6b4f" />
          <stop offset="1" stopColor="#0f4531" />
        </linearGradient>
        {/* Gold (Krone) */}
        <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe07a" />
          <stop offset="0.5" stopColor="#f5b301" />
          <stop offset="1" stopColor="#c8890a" />
        </linearGradient>
        {/* Kristall (Sou) */}
        <linearGradient id="crystal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6ff0da" />
          <stop offset="0.5" stopColor="#22c4a8" />
          <stop offset="1" stopColor="#0f8f7c" />
        </linearGradient>
        {/* Jade (glänzend, wie die Glyphen der Gemini-Vorlage) */}
        <linearGradient id="jadeg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#49b87c" />
          <stop offset="0.55" stopColor="#1f8f52" />
          <stop offset="1" stopColor="#136a3c" />
        </linearGradient>
        {/* Rot-Lack (Drache 中, Akzente) */}
        <linearGradient id="redlac" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e05a41" />
          <stop offset="0.55" stopColor="#c23b2e" />
          <stop offset="1" stopColor="#992417" />
        </linearGradient>
        {/* Nutzer-Designs 17.7.2026: Lapis (Man-Ziffer), Rubin (萬), Onyx (Winde) */}
        <linearGradient id="lapis" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5578b8" />
          <stop offset="0.5" stopColor="#2e4a86" />
          <stop offset="1" stopColor="#1a2c58" />
        </linearGradient>
        <linearGradient id="ruby" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d0342a" />
          <stop offset="0.5" stopColor="#a81c14" />
          <stop offset="1" stopColor="#7c120c" />
        </linearGradient>
        <linearGradient id="onyx" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a40" />
          <stop offset="0.45" stop-color="#1c1c22" stopColor="#1c1c22" />
          <stop offset="1" stopColor="#060608" />
        </linearGradient>
        {/* Schiefer-Blau (weißer Drache 白) */}
        <linearGradient id="slate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d84a0" />
          <stop offset="0.5" stopColor="#4a5f7c" />
          <stop offset="1" stopColor="#2f4058" />
        </linearGradient>
        {/* Goldene Seitenfläche (3D-Korpus) – wie die Kanten der Gemini-Vorlage */}
        <linearGradient id="tside" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ecd9a4" />
          <stop offset="0.6" stopColor="#c9a75c" />
          <stop offset="1" stopColor="#96762f" />
        </linearGradient>
        {/* Clip auf die abgerundete Deckfläche (für die Marmor-Textur) */}
        <clipPath id="tfaceclip">
          <rect x="3" y="3" width="54" height="72" rx="11" />
        </clipPath>
      </defs>
    </svg>
  );
}

// Freigestellte Gemini-Motive (Quellen in design-sources/gemini-tiles/,
// Freistellung via scripts/extract-tiles.py). Fehlt ein Bild, greift automatisch
// der gezeichnete SVG-Fallback weiter unten. Not-Schalter: USE_IMG_MOTIFS.
const USE_IMG_MOTIFS = true;
const TILE_IMG = import.meta.glob('../assets/tiles/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const timg = (name: string): string | undefined =>
  USE_IMG_MOTIFS ? TILE_IMG[`../assets/tiles/${name}.webp`] : undefined;

// Chinesische Ziffern für die Zahlen-Steine (Jade-Ziffer über goldenem 萬).
const CJK_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

// Farben der drei Pin-Edelsteine (zyklisch pro Pip) – eigene, kräftige Gem-Töne.
const DOT_COLORS = ['#2f7ff2', '#22b06a', '#e0483d'];

// Facettierter runder Edelstein (ersetzt die flachen Pin-Kreise).
function Gem({ x, y, c, r = 5 }: { x: number; y: number; c: string; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={c} />
      <path d={`M${x - r} ${y} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`} fill="#fff" opacity="0.28" />
      <circle cx={x} cy={y} r={r} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="0.7" />
      <circle cx={x - r * 0.32} cy={y - r * 0.32} r={r * 0.28} fill="#fff" opacity="0.95" />
    </g>
  );
}

// Vertikaler Jade-Bambusstab mit Goldknoten (Sou) – Palette der Gemini-Vorlage.
function Crystal({ x, y, w = 7, h = 20 }: { x: number; y: number; w?: number; h?: number }) {
  const hw = w / 2, hh = h / 2;
  return (
    <g>
      <rect x={x - hw} y={y - hh} width={w} height={h} rx={hw} fill="url(#jadeg)" stroke="rgba(120,90,20,.55)" strokeWidth="0.6" />
      <rect x={x - hw} y={y - 1.7} width={w} height={3.4} rx={1.5} fill="url(#gold)" />
      <line x1={x - hw * 0.45} y1={y - hh + 2.5} x2={x - hw * 0.45} y2={y + hh - 2.5} stroke="rgba(255,255,255,.4)" strokeWidth="0.9" />
    </g>
  );
}

// Kleine Krone (Man-Emblem, "Royale").
function Crown({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <path d="M-11 5 L-11 -5 L-5 1 L0 -8 L5 1 L11 -5 L11 5 Z" fill="url(#gold)" stroke="rgba(120,80,0,.5)" strokeWidth="0.8" strokeLinejoin="round" />
      <rect x="-11" y="5" width="22" height="3.4" rx="1.2" fill="url(#gold)" stroke="rgba(120,80,0,.5)" strokeWidth="0.6" />
      <circle cx="0" cy="-8" r="1.7" fill="#fff3c4" />
      <circle cx="-11" cy="-5" r="1.5" fill="#fff3c4" />
      <circle cx="11" cy="-5" r="1.5" fill="#fff3c4" />
    </g>
  );
}

// Facettierte Raute (Basis für Winde/Drachen-Sigille).
function Diamond({ cx, cy, r, c }: { cx: number; cy: number; r: number; c: string }) {
  return (
    <g>
      <polygon points={`${cx},${cy - r} ${cx + r * 0.8},${cy} ${cx},${cy + r} ${cx - r * 0.8},${cy}`} fill={c} stroke="rgba(0,0,0,.3)" strokeWidth="0.8" strokeLinejoin="round" />
      <polygon points={`${cx},${cy - r} ${cx + r * 0.8},${cy} ${cx},${cy}`} fill="#fff" opacity="0.25" />
    </g>
  );
}

// Punkt-Anordnungen (Pin)
const PIN: Record<number, [number, number][]> = {
  1: [[30, 40]],
  2: [[30, 24], [30, 56]],
  3: [[17, 21], [30, 40], [43, 59]],
  4: [[20, 24], [40, 24], [20, 56], [40, 56]],
  5: [[20, 24], [40, 24], [30, 40], [20, 56], [40, 56]],
  6: [[20, 20], [40, 20], [20, 40], [40, 40], [20, 60], [40, 60]],
  7: [[16, 18], [30, 18], [44, 18], [20, 42], [40, 42], [20, 60], [40, 60]],
  8: [[20, 16], [40, 16], [20, 31], [40, 31], [20, 47], [40, 47], [20, 62], [40, 62]],
  9: [[16, 20], [30, 20], [44, 20], [16, 40], [30, 40], [44, 40], [16, 60], [30, 60], [44, 60]],
};
// Bambus-Anordnungen (Sou)
const SOU: Record<number, [number, number][]> = {
  1: [[30, 40]],
  2: [[22, 40], [38, 40]],
  3: [[30, 22], [22, 55], [38, 55]],
  4: [[22, 26], [38, 26], [22, 56], [38, 56]],
  5: [[22, 26], [38, 26], [30, 41], [22, 58], [38, 58]],
  6: [[20, 26], [30, 26], [40, 26], [20, 56], [30, 56], [40, 56]],
  7: [[30, 19], [20, 42], [30, 42], [40, 42], [20, 61], [30, 61], [40, 61]],
  8: [[16, 26], [27, 26], [38, 26], [49, 26], [16, 56], [27, 56], [38, 56], [49, 56]],
  9: [[18, 22], [30, 22], [42, 22], [18, 41], [30, 41], [42, 41], [18, 60], [30, 60], [42, 60]],
};

// Deckfläche (Stil der Gemini-Vorlage): Elfenbein-Marmor-Textur mit Goldrand,
// runde Ecken, weicher Glanz oben. Der #tbody-Grund bleibt darunter — Skins mit
// eigener Flächenfarbe blenden die Textur per CSS aus (.face-tex).
// Schatten/Korpus zeichnen die Tile-Varianten selbst (flach dezent, solid mit Kanten).
function TileBody({ children }: { children: React.ReactNode }) {
  const marble = timg('face-marble');
  return (
    <>
      <rect x="3" y="3" width="54" height="72" rx="11" fill="url(#tbody)" stroke="rgba(0,0,0,.10)" />
      {marble && (
        <image
          href={marble} x="3" y="3" width="54" height="72"
          preserveAspectRatio="none" clipPath="url(#tfaceclip)" className="face-tex"
        />
      )}
      {marble && (
        <rect
          x="4.2" y="4.2" width="51.6" height="69.6" rx="9.8" fill="none"
          stroke="url(#gold)" strokeWidth="1.4" opacity="0.9" className="face-tex"
        />
      )}
      {/* Auswahl-Tönung: Farbe setzt das CSS, und nur beim ausgewählten Stein
          (.tile.solid.selected). Liegt ÜBER der Marmor-Textur, aber UNTER Glanz
          und Motiv — die Fläche färbt sich, das Motiv bleibt unangetastet.
          Reiner Malvorgang (fill), bewusst KEIN CSS-Filter: der würde den Stein
          auf eine eigene Compositing-Ebene heben und auf iOS das ganze Brett
          verrutschen lassen (siehe CLAUDE.md, „iOS-Safari-Fallen"). */}
      <rect className="sel-tint" x="3" y="3" width="54" height="72" rx="11" fill="none" />
      <path d="M8 15 Q8 6 17 6 H43 Q52 6 52 15 Q52 20 30 20.5 Q8 21 8 15" fill="url(#tgloss)" opacity="0.55" />
      {children}
    </>
  );
}

// Rangzahl im eigenen Stil (arabisch, kräftig) – ersetzt chinesische Ziffern.
function Numeral({ n, x = 30, y = 34, size = 26, fill = '#1e2a44' }: { n: number; x?: number; y?: number; size?: number; fill?: string }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize={size} fontWeight="800" fill={fill}>{n}</text>
  );
}

// Windzeichen (E/S/W/N) – klassische CJK-Glyphen im Jade-Gold-Stil.
const WIND_CH = ['', '東', '南', '西', '北'];

// CJK-Glyphe im Stil der Gemini-Vorlage: farbige Glasur mit Goldrand.
function Glyph({ ch, fill, size = 34, y = 52 }: { ch: string; fill: string; size?: number; y?: number }) {
  return (
    <text
      x="30" y={y} textAnchor="middle"
      fontFamily="'Songti SC','Songti TC','STSong','Noto Serif CJK SC','Noto Serif SC',serif"
      fontSize={size} fontWeight="700" fill={fill}
      stroke="url(#gold)" strokeWidth="1" paintOrder="stroke" strokeLinejoin="round"
    >{ch}</text>
  );
}

function motif(f: Face): React.ReactNode {
  const { suit, rank } = f;
  // Voll-Motiv als freigestelltes Bild (wind1, dragon2, flower3, myth1 …), wenn vorhanden.
  const full = timg(suit + rank);
  if (full) {
    return <image href={full} x={9} y={11} width={42} height={56} className="motif-img" preserveAspectRatio="xMidYMid meet" />;
  }
  if (suit === 'pin') {
    const pts = PIN[rank] ?? [];
    const coin = timg('elem-pin');
    if (coin) {
      // Goldmünze (Gemini) je Pip – Größe nach Rang, exakt an den PIN-Koordinaten.
      const r = rank === 1 ? 14 : rank >= 8 ? 7 : 9;
      return pts.map(([x, y], i) => (
        <image key={i} href={coin} x={x - r} y={y - r} width={r * 2} height={r * 2} className="motif-img" preserveAspectRatio="xMidYMid meet" />
      ));
    }
    const r = rank === 1 ? 9 : rank >= 8 ? 4 : 5;
    return pts.map(([x, y], i) => <Gem key={i} x={x} y={y} c={DOT_COLORS[(rank === 1 ? 0 : i) % 3]} r={r} />);
  }
  if (suit === 'sou') {
    const pts = SOU[rank] ?? [];
    const bam = timg('elem-sou');
    if (bam) {
      // Bambusstab (Gemini) je Stab – Größe nach Rang, an den SOU-Koordinaten.
      const w = rank >= 8 ? 6.5 : rank >= 6 ? 7.5 : 9;
      const h = rank >= 6 ? 19 : 23;
      return pts.map(([x, y], i) => (
        <image
          key={i} href={bam} x={x - w / 2} y={y - h / 2} width={w} height={h}
          className="motif-img" preserveAspectRatio="xMidYMid meet"
        />
      ));
    }
    const w = rank >= 8 ? 5 : rank >= 6 ? 6 : 7;
    const h = rank >= 6 ? 17 : 20;
    return (
      <>
        {pts.map(([x, y], i) => <Crystal key={i} x={x} y={y} w={w} h={h} />)}
        {rank === 1 && <Gem x={30} y={20} c="#e0483d" r={4} />}
      </>
    );
  }
  if (suit === 'man') {
    // Nutzer-Design (17.7.2026, „八萬"): Lapis-blaue Ziffer oben, rubinrotes 萬
    // darunter, beide mit feiner Goldkante; kleine Rangzahl für Lesbarkeit.
    return (
      <>
        <Glyph ch={CJK_NUM[rank]} fill="url(#lapis)" size={27} y={33} />
        <Glyph ch="萬" fill="url(#ruby)" size={27} y={64} />
        <text x={49} y={71} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize={10} fontWeight={800} fill="#2e4a86">{rank}</text>
      </>
    );
  }
  if (suit === 'wind') {
    // Nutzer-Design (17.7.2026): Windzeichen in schwarzem Onyx-Glas mit Goldkante.
    return <Glyph ch={WIND_CH[rank] ?? WIND_CH[1]} fill="url(#onyx)" size={36} />;
  }
  if (suit === 'dragon') {
    if (rank === 1) {
      // Roter Drache: 中 in Rot-Lack mit Goldrand.
      return <Glyph ch="中" fill="url(#redlac)" />;
    }
    if (rank === 2) {
      // Grüner Drache: 發 in Jade mit Goldrand.
      return <Glyph ch="發" fill="url(#jadeg)" />;
    }
    // Weißer Drache (Nutzer-Design): 白 in Schiefer-Blau mit Goldkante.
    return <Glyph ch="白" fill="url(#slate)" size={36} />;
  }
  if (suit === 'myth') {
    // Mythen-Serie: CJK-Glyphen in der Vorlagen-Palette (Rot-Lack/Gold/Jade/Tief-Jade).
    const M: [string, string][] = [
      ['龍', 'url(#redlac)'], // Drache
      ['鳳', 'url(#gold)'],   // Phönix
      ['麒', 'url(#jadeg)'],  // Qilin
      ['龜', '#1b6e66'],      // Schildkröte
    ];
    const [ch, c] = M[(rank - 1) % 4];
    return (
      <g>
        <path d="M30 11 l3.5 5 h-7 z" fill="url(#gold)" />
        <Glyph ch={ch} fill={c} size={33} y={53} />
        <path d="M30 66 l3 4 -3 4 -3 -4 z" fill="url(#gold)" opacity="0.9" />
      </g>
    );
  }
  if (suit === 'treasure') {
    if (rank === 1) {
      // Laterne
      return (
        <g>
          <line x1="30" y1="12" x2="30" y2="18" stroke="#8a6a20" strokeWidth="2" />
          <rect x="20" y="16" width="20" height="5" rx="2" fill="url(#gold)" />
          <ellipse cx="30" cy="40" rx="14" ry="18" fill="#e0483d" stroke="rgba(0,0,0,.25)" />
          <path d="M22 26 q8 -4 16 0 M20 40 h20 M22 54 q8 4 16 0" stroke="rgba(255,235,200,.55)" strokeWidth="1.5" fill="none" />
          <rect x="21" y="57" width="18" height="5" rx="2" fill="url(#gold)" />
          <line x1="30" y1="62" x2="30" y2="69" stroke="#a52a1d" strokeWidth="2.5" />
        </g>
      );
    }
    if (rank === 2) {
      // Fächer
      return (
        <g>
          <path d="M30 62 L13 32 A 20 20 0 0 1 47 32 Z" fill="#f3e3c2" stroke="#8a6a20" strokeWidth="1.5" />
          <path d="M30 62 L21 27 M30 62 L30 22 M30 62 L39 27" stroke="#e0483d" strokeWidth="2" fill="none" />
          <circle cx="30" cy="62" r="3.5" fill="url(#gold)" />
        </g>
      );
    }
    if (rank === 3) {
      // Münze
      return (
        <g>
          <circle cx="30" cy="40" r="17" fill="url(#gold)" stroke="#8a6a20" strokeWidth="1.5" />
          <rect x="24.5" y="34.5" width="11" height="11" fill="#f6efe0" stroke="#8a6a20" strokeWidth="1.5" />
        </g>
      );
    }
    // Glücksknoten
    return (
      <g>
        <g stroke="#e0483d" strokeWidth="3" fill="none">
          <rect x="19" y="27" width="16" height="16" transform="rotate(45 27 35)" />
          <rect x="25" y="37" width="16" height="16" transform="rotate(45 33 45)" />
        </g>
        <path d="M30 58 l0 10 M26 64 l8 0" stroke="#e0483d" strokeWidth="2" />
      </g>
    );
  }
  // Blumen / Jahreszeiten – in der Vorlagen-Palette (Rot-Lack-Blüte / Gold-Sonne).
  const petals = suit === 'flower';
  const color = petals ? '#c2402f' : '#c9962a';
  return (
    <>
      {petals ? (
        // Blume nach Nutzer-Design (17.7.2026): rote Scheibe, schwarzer Kern,
        // goldener Doppelring — flach-modern.
        <g>
          <circle cx="30" cy="38" r="17.5" fill="none" stroke="url(#gold)" strokeWidth="2" />
          <circle cx="30" cy="38" r="15.6" fill="none" stroke="rgba(138,106,32,.55)" strokeWidth="0.6" />
          <circle cx="30" cy="38" r="14.6" fill="url(#redlac)" />
          <circle cx="30" cy="38" r="5.2" fill="#1c1713" />
        </g>
      ) : (
        <g>
          {/* Sonne/Strahlen (Jahreszeit) */}
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * 45) * Math.PI / 180;
            return <line key={i} x1={30 + Math.cos(a) * 11} y1={38 + Math.sin(a) * 11} x2={30 + Math.cos(a) * 18} y2={38 + Math.sin(a) * 18} stroke={color} strokeWidth="2.4" strokeLinecap="round" />;
          })}
          <circle cx="30" cy="38" r="10" fill="url(#gold)" stroke="rgba(138,106,32,.6)" strokeWidth="0.8" />
        </g>
      )}
      <Numeral n={rank} x={46} y={70} size={13} fill={color} />
    </>
  );
}

export function Tile({ face, className, solid }: { face: string; className?: string; solid?: boolean }) {
  const f = normalizeFace(face);
  if (solid) {
    // 3D-Korpus (Stil S3 „klassisch schräg – bündig"): schmale Seitenkante links (4)
    // + Unterkante (6), Schatten fällt NUR nach unten und bleibt innerhalb der
    // Korpusbreite – so entstehen keine dunklen Fugen zwischen Nachbarsteinen.
    // Die Deckfläche liegt bei (7,3) in Originalgröße 54×72; CSS (.tile.solid)
    // mappt genau sie aufs Button-Raster. Das Board legt den linken Nachbarn per
    // z-Reihenfolge obenauf, damit gleiche Ebenen bündig wirken.
    return (
      <svg className={'tileface' + (className ? ' ' + className : '')} viewBox="0 0 64 96" preserveAspectRatio="none">
        <rect x="3.5" y="9" width="57" height="78" rx="11" fill="#000" opacity="0.10" />
        <rect x="3" y="6.5" width="58" height="79" rx="11" fill="#000" opacity="0.14" />
        <rect x="3" y="3" width="58" height="78" rx="11" fill="url(#tside)" />
        <rect x="3.4" y="3.4" width="57.2" height="77.2" rx="10.6" fill="none" stroke="rgba(90,70,40,.35)" strokeWidth="0.8" />
        <g transform="translate(4 0)">
          <TileBody>{motif(f)}</TileBody>
        </g>
      </svg>
    );
  }
  // Flache Variante (alle anderen Modi): gleiche Deckfläche + dezente Unterkante,
  // bleibt in der 60×80-Box – kein Layoutwechsel für bestehende Nutzer.
  return (
    <svg className={'tileface' + (className ? ' ' + className : '')} viewBox="0 0 60 80" preserveAspectRatio="xMidYMid meet">
      <rect x="3" y="5.5" width="54" height="73" rx="11" fill="#000" opacity="0.12" />
      <rect x="3" y="3" width="54" height="75" rx="11" fill="url(#tside)" />
      <TileBody>{motif(f)}</TileBody>
    </svg>
  );
}

// Nur die Kreis-Punkte (ohne Stein-Korpus) – für Sudoku-Ziffern 1–9.
export function PinDigit({ rank, className }: { rank: number; className?: string }) {
  const pts = PIN[rank] ?? [];
  const r = rank === 1 ? 9 : rank >= 8 ? 4 : 5;
  return (
    <svg className={className} viewBox="8 10 44 60" preserveAspectRatio="xMidYMid meet" style={{ width: '82%', height: '82%' }}>
      {pts.map(([x, y], i) => (
        <Gem key={i} x={x} y={y} c={DOT_COLORS[(rank === 1 ? 0 : i) % 3]} r={r} />
      ))}
    </svg>
  );
}

// Verdeckte Rückseite (Memory & Co.): grüner Filz-Stein mit Ornament.
export function TileBack({ className }: { className?: string }) {
  return (
    <svg className={'tileface' + (className ? ' ' + className : '')} viewBox="0 0 60 80" preserveAspectRatio="xMidYMid meet">
      <rect x="3" y="6" width="54" height="72" rx="9" fill="#000" opacity="0.18" />
      <rect x="3" y="3" width="54" height="72" rx="9" fill="url(#tback)" />
      <rect x="3" y="3" width="54" height="72" rx="9" fill="none" stroke="rgba(255,255,255,.14)" />
      <rect x="9" y="12" width="42" height="54" rx="7" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" />
      <circle cx="30" cy="39" r="10" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="2" />
      <circle cx="30" cy="39" r="3.4" fill="rgba(255,255,255,.30)" />
    </svg>
  );
}

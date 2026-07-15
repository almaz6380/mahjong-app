// Gezeichnete SVG-Steine – gemeinsam für Solitaire und 4-Spieler.
// Nimmt entweder eine Solitaire-id ('char3','bam5','cir7','windE','dragonR','flower1','season2')
// oder einen 4-Spieler-Code ('m3','s5','p7','z1','z5','f1','g1') und zeichnet Korpus + Motiv.

import windE from '../assets/tile-wind-e.webp';
import windS from '../assets/tile-wind-s.webp';
import windW from '../assets/tile-wind-w.webp';
import windN from '../assets/tile-wind-n.webp';
import dragonGreen from '../assets/tile-dragon-green.webp';
import dragonWhite from '../assets/tile-dragon-white.webp';
import dragonRed from '../assets/symbol-zhong.webp';
import wan1 from '../assets/tile-wan-1.webp';
import wan2 from '../assets/tile-wan-2.webp';
import wan3 from '../assets/tile-wan-3.webp';
import wan4 from '../assets/tile-wan-4.webp';
import wan5 from '../assets/tile-wan-5.webp';
import wan6 from '../assets/tile-wan-6.webp';
import wan7 from '../assets/tile-wan-7.webp';
import wan8 from '../assets/tile-wan-8.webp';
import wan9 from '../assets/tile-wan-9.webp';
import blankTile from '../assets/tile-face.webp';
import pinDot from '../assets/tile-pin-dot.webp';
import souStick from '../assets/tile-sou-stick.webp';
import souBird from '../assets/tile-sou-bird.webp';
import flowerPlum from '../assets/tile-flower-plum.webp';
import flowerOrchid from '../assets/tile-flower-orchid.webp';
import flowerChrys from '../assets/tile-flower-chrys.webp';
import flowerBamboo from '../assets/tile-flower-bamboo.webp';
import seasonSpring from '../assets/tile-season-spring.webp';
import seasonSummer from '../assets/tile-season-summer.webp';
import seasonAutumn from '../assets/tile-season-autumn.webp';
import seasonWinter from '../assets/tile-season-winter.webp';

// Freigestellte Gemini-Symbole für Winde (東南西北) und Drachen (中/發/白).
// Roter Drache = dasselbe 中 wie auf dem Drehstein (symbol-zhong).
const WIND_IMG: Record<number, string> = { 1: windE, 2: windS, 3: windW, 4: windN };
const DRAGON_IMG: Record<number, string> = { 1: dragonRed, 2: dragonGreen, 3: dragonWhite };
// Zahlen-Steine 一萬…九萬 (chinesische Ziffer + 萬), traditionell.
const WAN_IMG: Record<number, string> = { 1: wan1, 2: wan2, 3: wan3, 4: wan4, 5: wan5, 6: wan6, 7: wan7, 8: wan8, 9: wan9 };
// Blumen 梅蘭菊竹 (Pflaume/Orchidee/Chrysantheme/Bambus) – freigestellte Gemini-Motive.
const FLOWER_IMG: Record<number, string> = { 1: flowerPlum, 2: flowerOrchid, 3: flowerChrys, 4: flowerBamboo };
// Jahreszeiten (Frühling/Sommer/Herbst/Winter) – freigestellte Gemini-Motive.
const SEASON_IMG: Record<number, string> = { 1: seasonSpring, 2: seasonSummer, 3: seasonAutumn, 4: seasonWinter };

type Suit = 'man' | 'sou' | 'pin' | 'wind' | 'dragon' | 'flower' | 'season' | 'myth' | 'treasure';
interface Face { suit: Suit; rank: number }

// Zeichen-Bild mittig im Steinkörper (Box um (30,40) im 60×80-Korpus).
function SymbolImg({ href }: { href: string }) {
  return <image href={href} x="13" y="16" width="34" height="48" preserveAspectRatio="xMidYMid meet" />;
}

// Token-Bild (Kreis/Bambus/Vogel) zentriert an (x,y) – für Pin/Sou-Anzahlen.
function TokenImg({ href, x, y, w, h }: { href: string; x: number; y: number; w: number; h: number }) {
  return <image href={href} x={x - w / 2} y={y - h / 2} width={w} height={h} preserveAspectRatio="xMidYMid meet" />;
}

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
        {/* Elfenbein-Deckfläche (aus dem Blankostein gesampelt) – harte, bündig
            kachelnde Basis, damit zwischen Steinen kein Filz durchscheint. */}
        <linearGradient id="tbody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ece2c7" />
          <stop offset="1" stopColor="#e6dabb" />
        </linearGradient>
        {/* Elfenbein-Seitenwand (3D-Steindicke, etwas dunkler). */}
        <linearGradient id="tside" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d3c4a0" />
          <stop offset="1" stopColor="#b09c72" />
        </linearGradient>
      </defs>
    </svg>
  );
}

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

// Punkt-Anordnungen (Pin)
const PIN: Record<number, [number, number][]> = {
  1: [[30, 40]],
  2: [[30, 24], [30, 56]],
  3: [[17, 21], [30, 40], [43, 59]],
  4: [[20, 24], [40, 24], [20, 56], [40, 56]],
  5: [[20, 24], [40, 24], [30, 40], [20, 56], [40, 56]],
  6: [[20, 20], [40, 20], [20, 40], [40, 40], [20, 60], [40, 60]],
  7: [[16, 18], [30, 18], [44, 18], [20, 42], [40, 42], [20, 60], [40, 60]],
  8: [[20, 18], [40, 18], [20, 34], [40, 34], [20, 50], [40, 50], [20, 65], [40, 65]],
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

// Deckfläche = freigestellter Gemini-Blankostein (premium Elfenbein). Motiv liegt
// darüber. `corpus` > 0 legt darunter eine abgedunkelte, nach unten versetzte Kopie
// als dezente Steindicke (3D-Block) an.
// Deckfläche: harte, bündig kachelnde Elfenbein-Basis (rundet leicht, füllt das
// Rasterfeld randvoll + 1u Bleed → benachbarte Steine stoßen bündig, kein Filz)
// + Gemini-Blankostein als Textur darüber (weiche Kante blendet in die Basis)
// + dünne dunkle Fuge zur Abgrenzung der Einzelsteine.
// Footprint = (3,3,54,72); mit Bleed 1 => (2,2,56,74).
function TileTop() {
  return (
    <>
      <rect x="2" y="2" width="56" height="74" rx="6" fill="url(#tbody)" />
      <image href={blankTile} x="2" y="2" width="56" height="74" preserveAspectRatio="none" />
      <rect x="2" y="2" width="56" height="74" rx="6" fill="none" stroke="rgba(60,45,15,.28)" strokeWidth="0.8" />
    </>
  );
}

// 3D-Steindicke: Elfenbein-Seitenwand NUR unten (Frontansicht, kein seitlicher
// Winkel), um +4.5 Einheiten ≈ 3.5px nach unten versetzt → überbrückt den
// senkrechten Stapel-Versatz DY=3.5 (Board.tsx). Steine stapeln sauber senkrecht.
function TileSide() {
  return <rect x="2" y="6.5" width="56" height="74" rx="6" fill="url(#tside)" stroke="rgba(60,45,15,.3)" strokeWidth="0.6" />;
}

function motif(f: Face): React.ReactNode {
  const { suit, rank } = f;
  if (suit === 'pin') {
    // Kreise (Pin) = freigestelltes Münz-Token, Anzahl 1–9 aus PIN-Positionen.
    const pts = PIN[rank] ?? [];
    const d = rank === 1 ? 30 : rank >= 7 ? 13 : 16;
    return pts.map(([x, y], i) => <TokenImg key={i} href={pinDot} x={x} y={y} w={d} h={d} />);
  }
  if (suit === 'sou') {
    // Bambus (Sou): 1 = Vogel, 2–9 = Bambusstäbe aus SOU-Positionen.
    if (rank === 1) return <TokenImg href={souBird} x={30} y={40} w={42} h={40} />;
    const pts = SOU[rank] ?? [];
    const sw = rank >= 6 ? 11 : 13;
    const sh = rank >= 6 ? 20 : 24;
    return pts.map(([x, y], i) => <TokenImg key={i} href={souStick} x={x} y={y} w={sw} h={sh} />);
  }
  if (suit === 'man') {
    // Zahlen-Stein 一萬…九萬 (Gemini-Symbol, hochformatig: Ziffer + 萬).
    return <image href={WAN_IMG[rank] ?? wan1} x="14" y="9" width="32" height="62" preserveAspectRatio="xMidYMid meet" />;
  }
  if (suit === 'wind') {
    // Freigestelltes Zeichen 東/南/西/北 (Gemini-Symbol).
    return <SymbolImg href={WIND_IMG[rank] ?? windE} />;
  }
  if (suit === 'dragon') {
    // Freigestelltes Zeichen 中/發/白 (Gemini-Symbol; Rot = Drehstein-中).
    return <SymbolImg href={DRAGON_IMG[rank] ?? dragonRed} />;
  }
  if (suit === 'myth') {
    // Mythen-Serie: kolorierte CJK-Glyphen mit Gold-Akzenten (Entwurf 3).
    const M: [string, string][] = [
      ['龍', '#e0483d'], // Drache
      ['鳳', '#c9962a'], // Phönix
      ['麒', '#22b06a'], // Qilin
      ['龜', '#2f7ff2'], // Schildkröte
    ];
    const [ch, c] = M[(rank - 1) % 4];
    return (
      <g>
        <path d="M30 11 l3.5 5 h-7 z" fill="url(#gold)" />
        <text
          x="30" y="53" textAnchor="middle"
          fontFamily="'Songti SC','Songti TC','STSong','Noto Serif CJK SC','Noto Serif SC',serif"
          fontSize="33" fontWeight="700" fill={c}
        >{ch}</text>
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
  if (suit === 'flower') {
    // Blumen (梅蘭菊竹) – freigestelltes Gemini-Motiv.
    return <image href={FLOWER_IMG[rank] ?? flowerPlum} x="9" y="12" width="42" height="52" preserveAspectRatio="xMidYMid meet" />;
  }
  // Jahreszeiten (Frühling/Sommer/Herbst/Winter) – freigestelltes Gemini-Motiv.
  return <image href={SEASON_IMG[rank] ?? seasonSpring} x="9" y="12" width="42" height="52" preserveAspectRatio="xMidYMid meet" />;
}

export function Tile({ face, className, solid }: { face: string; className?: string; solid?: boolean }) {
  const f = normalizeFace(face);
  if (solid) {
    // 3D-Korpus: Die abgedunkelte Kopie (Seitenwände unten+links) ist um
    // (-6,+9) Einheiten ≈ (5px links, 7px unten) gegen die Deckfläche versetzt
    // und überbrückt damit exakt den Stapel-Versatz aus Board.tsx (DX=5/DY=7).
    // So schließt die Kante des oberen Steins direkt an den unteren an – keine
    // Filz-Lücke im Stapel. Deckfläche mit 1u-Bleed gegen Lücken auf gleicher Ebene.
    // viewBox links negativ, damit die Seitenwand Platz hat und das Motiv (um 30,40)
    // zentriert bleibt. CSS (.tile.solid) mappt das Footprint (3,3,54,72) aufs Raster.
    return (
      <svg className={'tileface' + (className ? ' ' + className : '')} viewBox="-5 0 63 86" preserveAspectRatio="none">
        <TileSide />
        <TileTop />
        {motif(f)}
      </svg>
    );
  }
  return (
    <svg className={'tileface' + (className ? ' ' + className : '')} viewBox="0 0 60 80" preserveAspectRatio="xMidYMid meet">
      <TileTop />
      {motif(f)}
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

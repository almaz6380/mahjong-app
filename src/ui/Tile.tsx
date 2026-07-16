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
import mythDragon from '../assets/tile-myth-dragon.webp';
import mythPhoenix from '../assets/tile-myth-phoenix.webp';
import mythQilin from '../assets/tile-myth-qilin.webp';
import mythTurtle from '../assets/tile-myth-turtle.webp';
import treasureLantern from '../assets/tile-treasure-lantern.webp';
import treasureFan from '../assets/tile-treasure-fan.webp';
import treasureCoin from '../assets/tile-treasure-coin.webp';
import treasureKnot from '../assets/tile-treasure-knot.webp';

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
// Bonus-Serien (nur große Boards): Mythen 龍鳳麒龜, Schätze Laterne/Fächer/Münze/Knoten.
const MYTH_IMG: Record<number, string> = { 1: mythDragon, 2: mythPhoenix, 3: mythQilin, 4: mythTurtle };
const TREASURE_IMG: Record<number, string> = { 1: treasureLantern, 2: treasureFan, 3: treasureCoin, 4: treasureKnot };

type Suit = 'man' | 'sou' | 'pin' | 'wind' | 'dragon' | 'flower' | 'season' | 'myth' | 'treasure';
export interface Face { suit: Suit; rank: number }

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
        {/* Zweifarbige Steindicke: obere Hälfte Elfenbein, untere Hälfte blau
            (Wunsch Nutzer). Harter Stopp bei der Mitte der SICHTBAREN Tiefe.
            Der Verlauf liegt über der Seitenwand-Rect (objectBoundingBox);
            die Rect hat oben einen kleinen (verdeckten) Überlapp, daher liegt
            die sichtbare Mitte bei ~0.59 statt 0.5. */}
        <linearGradient id="tside2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6c8a4" />
          <stop offset="0.5" stopColor="#c4b384" />
          <stop offset="0.5" stopColor="#4a95e8" />
          <stop offset="1" stopColor="#265fa8" />
        </linearGradient>
        {/* Deckfläche der Board-Steine (StoneTile): sauberes, helles Warm-Elfenbein. */}
        <linearGradient id="stoneFront" x1="0" y1="0" x2="0.28" y2="1">
          <stop offset="0" stopColor="#fffefa" />
          <stop offset="0.55" stopColor="#f7f0de" />
          <stop offset="1" stopColor="#ece1c6" />
        </linearGradient>
        {/* Untere Seitenwand (Steindicke, im Schatten -> dunkler). */}
        <linearGradient id="stoneSideB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8c8a2" />
          <stop offset="1" stopColor="#ab9268" />
        </linearGradient>
        {/* Rechte Seitenwand (etwas heller als unten). */}
        <linearGradient id="stoneSideR" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e0d1ac" />
          <stop offset="1" stopColor="#bda878" />
        </linearGradient>
        {/* Sanftes Glanzlicht oben auf der Deckfläche. */}
        <linearGradient id="stoneGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0" />
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
// Footprint der Deckfläche: füllt das Rasterfeld randvoll (Bleed 1u) → benachbarte
// Steine stoßen bündig, kein Filz dazwischen; runde Ecken (rx 9) wie Referenz.
const TOP = { x: 2, y: 2, w: 56, h: 74, rx: 9 };

function TileTop() {
  const r = TOP;
  return (
    <>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} fill="url(#tbody)" />
      <image href={blankTile} x={r.x} y={r.y} width={r.w} height={r.h} preserveAspectRatio="none" />
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} fill="none" stroke="rgba(60,45,15,.28)" strokeWidth="0.8" />
    </>
  );
}

// 3D-Steindicke: zweifarbige Seitenwand unten (Frontansicht). Die Rect reicht
// mit kleinem Überlapp hinter die Deckfläche und ragt um die sichtbare Tiefe D
// nach unten → überbrückt den Stapel-Versatz DY (Board.tsx). Verlauf `#tside2`
// splittet oben Elfenbein / unten blau.
const SIDE_D = 10; // sichtbare Tiefe (px-nah); muss zu DY in Board.tsx passen
function TileSide() {
  const r = TOP;
  const fb = r.y + r.h; // Unterkante der Deckfläche = Oberkante der sichtbaren Tiefe
  // Rect = exakt die sichtbare Tiefe (kein Überlapp) → Verlauf-Split bei 50 %
  // trennt sauber obere Hälfte Elfenbein / untere Hälfte blau.
  return (
    <rect x={r.x} y={fb} width={r.w} height={SIDE_D} rx={r.rx}
      fill="url(#tside2)" stroke="rgba(30,40,70,.35)" strokeWidth="0.6" />
  );
}

export function motif(f: Face): React.ReactNode {
  const { suit, rank } = f;
  if (suit === 'pin') {
    // Kreise (Pin) = freigestelltes Münz-Token, Anzahl 1–9 aus PIN-Positionen.
    // Größer = füllt den Stein (v.a. bei wenigen Kreisen), wirkt nicht mehr „billig".
    const pts = PIN[rank] ?? [];
    const d = rank === 1 ? 46 : rank === 2 ? 28 : rank === 3 ? 21 : rank <= 5 ? 19 : rank === 6 ? 18 : 15;
    return pts.map(([x, y], i) => <TokenImg key={i} href={pinDot} x={x} y={y} w={d} h={d} />);
  }
  if (suit === 'sou') {
    // Bambus (Sou): 1 = Vogel, 2–9 = Bambusstäbe aus SOU-Positionen.
    if (rank === 1) return <TokenImg href={souBird} x={30} y={40} w={48} h={46} />;
    const pts = SOU[rank] ?? [];
    const sw = rank >= 6 ? 14 : 17;
    const sh = rank >= 6 ? 25 : 30;
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
    // Mythen 龍鳳麒龜 – freigestellte Gemini-Motive (Jade+Gold-Kreaturen).
    return <image href={MYTH_IMG[rank] ?? mythDragon} x="8" y="11" width="44" height="54" preserveAspectRatio="xMidYMid meet" />;
  }
  if (suit === 'treasure') {
    // Schätze (Laterne/Fächer/Münze/Knoten) – freigestellte Gemini-Motive.
    return <image href={TREASURE_IMG[rank] ?? treasureLantern} x="11" y="10" width="38" height="56" preserveAspectRatio="xMidYMid meet" />;
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

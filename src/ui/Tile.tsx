// Gezeichnete SVG-Steine – gemeinsam für Solitaire und 4-Spieler.
// Nimmt entweder eine Solitaire-id ('char3','bam5','cir7','windE','dragonR','flower1','season2')
// oder einen 4-Spieler-Code ('m3','s5','p7','z1','z5','f1','g1') und zeichnet Korpus + Motiv.

type Suit = 'man' | 'sou' | 'pin' | 'wind' | 'dragon' | 'flower' | 'season';
interface Face { suit: Suit; rank: number }

const CJK = "'Songti SC','Songti TC','STSong','SimSun','Noto Serif CJK SC','Noto Serif SC',serif";

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
  return { suit: 'man', rank: 1 };
}

// Einmalige gemeinsame Defs (Verläufe) – in main.tsx gemountet.
export function TileDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <linearGradient id="tbody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#f7f2e6" />
          <stop offset="1" stopColor="#e8dfca" />
        </linearGradient>
        <linearGradient id="bamboo" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#25925a" />
          <stop offset="0.5" stopColor="#3fb873" />
          <stop offset="1" stopColor="#1c7546" />
        </linearGradient>
        <linearGradient id="tback" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a6b4f" />
          <stop offset="1" stopColor="#0f4531" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WINDS = ['東', '南', '西', '北'];
const DOT_COLORS = ['#1f5fa8', '#1f8a4d', '#c0392b'];

function Dot({ x, y, c, r = 5 }: { x: number; y: number; c: string; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={c} />
      <circle cx={x} cy={y} r={r} fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="0.6" />
      <circle cx={x} cy={y} r={r * 0.4} fill="#fff" opacity="0.9" />
    </g>
  );
}

function Bamboo({ x, y, w = 7, h = 20 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={w / 2} fill="url(#bamboo)" stroke="rgba(0,0,0,.2)" strokeWidth="0.5" />
      <rect x={x - w / 2} y={y - 1} width={w} height={2} fill="#0f5230" opacity="0.8" />
      <rect x={x - w / 2} y={y - h / 2 + 3} width={w} height={1.4} fill="#0f5230" opacity="0.6" />
      <rect x={x - w / 2 + 1} y={y - h / 2} width={w * 0.35} height={h} rx={w / 4} fill="#7ee0a6" opacity="0.5" />
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

function TileBody({ children }: { children: React.ReactNode }) {
  return (
    <>
      <rect x="3" y="6" width="54" height="72" rx="9" fill="#000" opacity="0.18" />
      <rect x="3" y="3" width="54" height="72" rx="9" fill="url(#tbody)" />
      <rect x="3" y="3" width="54" height="72" rx="9" fill="none" stroke="rgba(0,0,0,.12)" />
      <rect x="7" y="6" width="46" height="9" rx="5" fill="#fff" opacity="0.55" />
      {children}
    </>
  );
}

function motif(f: Face): React.ReactNode {
  const { suit, rank } = f;
  if (suit === 'pin') {
    const pts = PIN[rank] ?? [];
    const r = rank === 1 ? 9 : rank >= 8 ? 4 : 5;
    return pts.map(([x, y], i) => <Dot key={i} x={x} y={y} c={DOT_COLORS[(rank === 1 ? 0 : i) % 3]} r={r} />);
  }
  if (suit === 'sou') {
    const pts = SOU[rank] ?? [];
    const w = rank >= 8 ? 5 : rank >= 6 ? 6 : 7;
    const h = rank >= 6 ? 17 : 20;
    return (
      <>
        {pts.map(([x, y], i) => <Bamboo key={i} x={x} y={y} w={w} h={h} />)}
        {rank === 1 && <circle cx="30" cy="22" r="4" fill="#c0392b" />}
      </>
    );
  }
  if (suit === 'man') {
    return (
      <>
        <text x="30" y="31" textAnchor="middle" fontFamily={CJK} fontSize="25" fontWeight="700" fill="#1e3a5f">{NUM[rank - 1]}</text>
        <text x="30" y="60" textAnchor="middle" fontFamily={CJK} fontSize="23" fontWeight="700" fill="#c0392b">萬</text>
      </>
    );
  }
  if (suit === 'wind') {
    return <text x="30" y="52" textAnchor="middle" fontFamily={CJK} fontSize="34" fontWeight="700" fill="#31404f">{WINDS[rank - 1]}</text>;
  }
  if (suit === 'dragon') {
    if (rank === 1) return <text x="30" y="53" textAnchor="middle" fontFamily={CJK} fontSize="36" fontWeight="700" fill="#c0392b">中</text>;
    if (rank === 2) return <text x="30" y="53" textAnchor="middle" fontFamily={CJK} fontSize="36" fontWeight="700" fill="#1f8a4d">發</text>;
    return <rect x="14" y="19" width="32" height="42" rx="4" fill="none" stroke="#2a5fa8" strokeWidth="3" />;
  }
  // Blumen / Jahreszeiten
  const color = suit === 'flower' ? '#c2418a' : '#0e8a86';
  const petals = suit === 'flower';
  return (
    <>
      {petals ? (
        <g>
          {[0, 60, 120, 180, 240, 300].map((a) => {
            const rad = (a * Math.PI) / 180;
            return <circle key={a} cx={30 + Math.cos(rad) * 9} cy={38 + Math.sin(rad) * 9} r="6" fill={color} opacity="0.9" />;
          })}
          <circle cx="30" cy="38" r="6" fill="#f5d24e" />
        </g>
      ) : (
        <g>
          <path d="M30 20 C 44 26, 44 48, 30 58 C 16 48, 16 26, 30 20 Z" fill={color} opacity="0.9" />
          <path d="M30 22 L30 56" stroke="#0a5b58" strokeWidth="1.4" />
        </g>
      )}
      <text x="46" y="68" textAnchor="middle" fontFamily={CJK} fontSize="12" fontWeight="700" fill={color}>{rank}</text>
    </>
  );
}

export function Tile({ face, className }: { face: string; className?: string }) {
  const f = normalizeFace(face);
  return (
    <svg className={'tileface' + (className ? ' ' + className : '')} viewBox="0 0 60 80" preserveAspectRatio="xMidYMid meet">
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
        <Dot key={i} x={x} y={y} c={DOT_COLORS[(rank === 1 ? 0 : i) % 3]} r={r} />
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

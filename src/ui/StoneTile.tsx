// Board-Stein: klassischer Mahjong-2.5D-Quader. Deckfläche (Elfenbein + flaches,
// kräftiges Symbol) + untere & rechte Seitenwand (Tiefe nach unten-rechts). Das
// Raster (Board.tsx) setzt die Steine so, dass die Elfenbein-Seitenwände die
// Zwischenräume füllen -> Tiefe an JEDEM Stein, KEIN Filz dazwischen.
import { normalizeFace } from './Tile';

// Flache, vorgerenderte Symbol-Bilder (kräftig, scharf; keine Runtime-Font nötig).
const flatAll = import.meta.glob('../assets/flat/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const F = (n: string) => flatAll[`../assets/flat/${n}.webp`];

// Geometrie in „Tile-Units" (1u ≈ 1px unskaliert; Board skaliert zum Fit).
const FW = 60, FH = 80, DX = 7, DY = 9; // Deckfläche + Tiefe nach unten-rechts
export const STONE = {
  FW, FH, DX, DY,
  CW: FW + DX,   // Spaltenschritt (Wand füllt die Lücke -> bündig, kein Filz)
  CH: FH + DY,   // Reihenschritt
  LX: -6, LY: -8, // Stapel-Versatz pro Ebene (obere Ebene nach oben-links)
};

const WIND = ['wind-e', 'wind-s', 'wind-w', 'wind-n'];
const PIN: Record<number, [number, number][]> = {
  1: [[30, 40]], 2: [[30, 23], [30, 57]], 3: [[17, 20], [30, 40], [43, 60]], 4: [[20, 24], [40, 24], [20, 56], [40, 56]],
  5: [[20, 24], [40, 24], [30, 40], [20, 56], [40, 56]], 6: [[20, 20], [40, 20], [20, 40], [40, 40], [20, 60], [40, 60]],
  7: [[17, 18], [30, 18], [43, 18], [20, 42], [40, 42], [20, 61], [40, 61]],
  8: [[20, 17], [40, 17], [20, 34], [40, 34], [20, 51], [40, 51], [20, 67], [40, 67]],
  9: [[17, 19], [30, 19], [43, 19], [17, 40], [30, 40], [43, 40], [17, 61], [30, 61], [43, 61]],
};
const SOU: Record<number, [number, number][]> = {
  1: [[30, 40]], 2: [[22, 40], [38, 40]], 3: [[30, 21], [22, 56], [38, 56]], 4: [[22, 25], [38, 25], [22, 56], [38, 56]],
  5: [[22, 25], [38, 25], [30, 40], [22, 58], [38, 58]], 6: [[20, 25], [30, 25], [40, 25], [20, 57], [30, 57], [40, 57]],
  7: [[30, 18], [20, 43], [30, 43], [40, 43], [20, 62], [30, 62], [40, 62]],
  8: [[16, 25], [27, 25], [38, 25], [49, 25], [16, 57], [27, 57], [38, 57], [49, 57]],
  9: [[18, 21], [30, 21], [42, 21], [18, 41], [30, 41], [42, 41], [18, 61], [30, 61], [42, 61]],
};

function PinDot({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#1f6fc0" />
      <circle cx={x} cy={y} r={r} fill="none" stroke="#123f6e" strokeWidth={r * 0.16} />
      <circle cx={x} cy={y} r={r * 0.42} fill="#f4ede0" />
      <circle cx={x} cy={y} r={r * 0.42} fill="none" stroke="#c0392b" strokeWidth={r * 0.16} />
    </g>
  );
}
function Bamboo({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const seg = h / 3;
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={x - w / 2} y={y - h / 2 + i * seg + 0.6} width={w} height={seg - 1.2} rx={w * 0.34}
          fill="#1e7a44" stroke="#0f5a30" strokeWidth={w * 0.14} />
      ))}
    </g>
  );
}
function SymImg({ href, x, y, w, h }: { href: string; x: number; y: number; w: number; h: number }) {
  return <image href={href} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" />;
}

function boardMotif(faceId: string): React.ReactNode {
  const { suit, rank } = normalizeFace(faceId);
  if (suit === 'man') return <SymImg href={F(`m${rank}`)} x={9} y={5} w={42} h={70} />;
  if (suit === 'wind') return <SymImg href={F(WIND[rank - 1] ?? 'wind-e')} x={12} y={13} w={36} h={54} />;
  if (suit === 'dragon') {
    if (rank === 1) return <SymImg href={F('zhong')} x={11} y={12} w={38} h={56} />;
    if (rank === 2) return <SymImg href={F('fa')} x={12} y={12} w={36} h={56} />;
    return (
      <g fill="none" stroke="#1f6fb0" strokeWidth="3">
        <rect x="12" y="12" width="36" height="56" rx="6" />
        <line x1="15" y1="15" x2="45" y2="65" />
      </g>
    );
  }
  if (suit === 'pin') { const r = rank === 1 ? 20 : rank <= 3 ? 13 : rank <= 5 ? 11.5 : 9.5; return <>{(PIN[rank] ?? []).map(([x, y], i) => <PinDot key={i} x={x} y={y} r={r} />)}</>; }
  if (suit === 'sou') { const w = rank <= 4 ? 15 : 12, h = rank <= 4 ? 30 : 25; return <>{(SOU[rank] ?? []).map(([x, y], i) => <Bamboo key={i} x={x} y={y} w={w} h={h} />)}</>; }
  if (suit === 'flower') return <SymImg href={F(['flower-plum', 'flower-orchid', 'flower-chrys', 'flower-bamboo'][rank - 1] ?? 'flower-plum')} x={13} y={13} w={34} h={54} />;
  if (suit === 'season') return <SymImg href={F(['season-spring', 'season-summer', 'season-autumn', 'season-winter'][rank - 1] ?? 'season-spring')} x={13} y={13} w={34} h={54} />;
  return <SymImg href={F('zhong')} x={11} y={12} w={38} h={56} />;
}

interface Props { faceId: string; selected?: boolean; hint?: boolean; dim?: boolean }

export function StoneTile({ faceId, selected, hint, dim }: Props) {
  const cls = 'stoneface' + (selected ? ' sel' : '') + (hint ? ' hint' : '') + (dim ? ' dim' : '');
  const R = 6;
  return (
    <svg className={cls} viewBox={`0 0 ${FW + DX} ${FH + DY}`} preserveAspectRatio="none">
      {/* untere Seitenwand (Parallelogramm nach unten-rechts) */}
      <path d={`M0 ${FH} H${FW} L${FW + DX} ${FH + DY} H${DX} Z`} fill="url(#stoneSideB)" stroke="rgba(45,34,12,.22)" strokeWidth="0.4" />
      {/* rechte Seitenwand */}
      <path d={`M${FW} 0 L${FW + DX} ${DY} V${FH + DY} L${FW} ${FH} Z`} fill="url(#stoneSideR)" stroke="rgba(45,34,12,.22)" strokeWidth="0.4" />
      {/* Deckfläche */}
      <rect x="0" y="0" width={FW} height={FH} rx={R} fill="url(#stoneFront)" />
      {boardMotif(faceId)}
      <rect x="0" y="0" width={FW} height={FH} rx={R} fill="url(#stoneGloss)" />
      <rect x="0.4" y="0.4" width={FW - 0.8} height={FH - 0.8} rx={R} fill="none" stroke="rgba(60,45,15,.18)" strokeWidth="0.6" />
    </svg>
  );
}

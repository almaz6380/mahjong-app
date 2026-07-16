// Board-Stein im Drehstein-Look: gerundeter 3D-Korpus per CSS-Schicht-Extrusion
// (wie HeroTile3D), aber STATISCH in leichter Kippung nach hinten (RX) und frontal
// (RY=0), damit die Steine sauber dicht kacheln. Front = Elfenbein-Verlauf + Motiv.
import type { CSSProperties } from 'react';
import { motif, normalizeFace } from './Tile';

// Geometrie (Board nutzt diese Maße zum Positionieren/Kacheln).
export const STONE = {
  W: 92, H: 120, DEPTH: 15, R: 13,
  RX: 8, RY: 0,        // Kippung: leicht nach hinten, keine seitliche Drehung
  CW: 92, CH: 114,      // Raster-Schritt (CH<H -> dichte vertikale Kachelung)
  DX: 0, DY: 11,        // Stapel-Versatz pro Ebene
};

const L = 8; // Ebenen für die Tiefe (Rim deckt die runde Seitenwand ab)
const SIDE = (t: number) => {
  const a = [239, 228, 201], b = [176, 158, 120];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

// Rim-Segmente entlang der runden Silhouette (einmal berechnet, für alle Steine gleich).
function buildRims(): CSSProperties[] {
  const { W, H, DEPTH: D, R } = STONE;
  const segs: { w: number; px: number; py: number; a: number }[] = [
    { w: H - 2 * R, px: -W / 2, py: 0, a: 90 }, { w: H - 2 * R, px: W / 2, py: 0, a: 90 },
    { w: W - 2 * R, px: 0, py: -H / 2, a: 0 }, { w: W - 2 * R, px: 0, py: H / 2, a: 0 },
  ];
  const CORNERS: [number, number, number][] = [
    [-W / 2 + R, -H / 2 + R, 180], [W / 2 - R, -H / 2 + R, 270], [W / 2 - R, H / 2 - R, 0], [-W / 2 + R, H / 2 - R, 90],
  ];
  const STEPS = 4, STEP = 90 / STEPS, chord = 2 * R * Math.sin((STEP * Math.PI) / 360) + 1;
  for (const [cx, cy, start] of CORNERS)
    for (let i = 0; i < STEPS; i++) {
      const phi = ((start + STEP * (i + 0.5)) * Math.PI) / 180;
      segs.push({ w: chord, px: cx + R * Math.cos(phi), py: cy + R * Math.sin(phi), a: (phi * 180) / Math.PI + 90 });
    }
  return segs.map(({ w, px, py, a }) => ({
    position: 'absolute', width: w, height: D, left: W / 2 - w / 2, top: H / 2 - D / 2,
    background: 'linear-gradient(180deg,#efe4c9,#d3c29c 55%,#b8a67e)',
    transform: `translate3d(${px}px,${py}px,0) rotateZ(${a}deg) rotateX(90deg)`,
  }));
}
const RIMS = buildRims();

function Front({ faceId }: { faceId: string }) {
  return (
    <svg viewBox="0 0 60 80" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect x="0" y="0" width="60" height="80" fill="url(#stoneFront)" />
      {motif(normalizeFace(faceId))}
    </svg>
  );
}

interface Props { faceId: string; selected?: boolean; hint?: boolean; dim?: boolean }

export function StoneTile({ faceId, selected, hint, dim }: Props) {
  const { W, H, DEPTH: D, R, RX, RY } = STONE;
  const step = D / (L - 1);
  const layers = Array.from({ length: L }, (_, i) => {
    const z = -D / 2 + i * step;
    const s: CSSProperties = { position: 'absolute', top: 0, left: 0, width: W, height: H, borderRadius: R, overflow: 'hidden', transform: `translateZ(${z}px)` };
    if (i === L - 1) return <div key={i} style={s}><Front faceId={faceId} /></div>;
    s.background = SIDE(1 - i / (L - 1));
    return <div key={i} style={s} />;
  });

  const glow = selected ? 'drop-shadow(0 0 7px #ffcf5a) drop-shadow(0 0 3px #ffcf5a)'
    : hint ? 'drop-shadow(0 0 7px #56c8ff) drop-shadow(0 0 4px #56c8ff)' : '';
  const shadow = 'drop-shadow(0 4px 4px rgba(4,20,14,0.45))';

  return (
    <div className={'stone3d' + (selected ? ' sel' : '') + (hint ? ' hint' : '')}
      style={{ width: W, height: H, perspective: 1700 }}>
      <div style={{ filter: `${shadow}${glow ? ' ' + glow : ''}${dim ? ' brightness(0.85) saturate(0.92)' : ''}` }}>
        <div style={{ transformStyle: 'preserve-3d', transform: `rotateX(${RX}deg) rotateY(${RY}deg) translateY(${selected ? -8 : 0}px)`, transition: 'transform .12s ease' }}>
          <div style={{ position: 'relative', width: W, height: H, transformStyle: 'preserve-3d' }}>{RIMS.map((st, i) => <div key={`r${i}`} style={st} />)}{layers}</div>
        </div>
      </div>
    </div>
  );
}

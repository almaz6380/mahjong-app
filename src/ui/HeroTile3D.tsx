// Startseiten-Hero: massiver 3D-Mahjongstein (中) mit runden Kanten + Tiefe,
// per Schicht-Extrusion (viele gestapelte runde Ebenen), volle Drehung um die
// Diagonale. Reines CSS-3D, kein 3D-Framework.
import { type CSSProperties, type ReactNode } from 'react';
const FRONT = (
  <svg viewBox="0 0 60 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hero3dBody" x1="0" y1="0" x2="0.28" y2="1">
        <stop offset="0" stopColor="#fefcf6" />
        <stop offset="0.55" stopColor="#f6eedb" />
        <stop offset="1" stopColor="#e7d9bf" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="60" height="80" fill="url(#hero3dBody)" />
    <rect x="8" y="7" width="44" height="8" rx="4" fill="#ffffff" opacity="0.5" />
    <g fill="#c62828">
      <rect x="18.4" y="29" width="23.2" height="24" rx="2.2" fill="none" stroke="#c62828" strokeWidth="4.3" />
      <rect x="27.5" y="19.6" width="5" height="42.8" rx="1.6" />
    </g>
  </svg>
);

const BACK = (
  <svg viewBox="0 0 60 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hero3dDk" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor="#0e3325" />
        <stop offset="1" stopColor="#05140d" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="60" height="80" fill="url(#hero3dDk)" />
    <rect x="5" y="5" width="50" height="70" rx="7" fill="none" stroke="rgba(244,236,216,0.14)" strokeWidth="1.4" />
    <circle cx="30" cy="40" r="11" fill="none" stroke="rgba(244,236,216,0.20)" strokeWidth="2.2" />
    <circle cx="30" cy="40" r="3.6" fill="rgba(244,236,216,0.22)" />
  </svg>
);

// Elfenbein-Seitenton: vorne hell -> hinten dunkler
function sideColor(t: number): string {
  const a = [239, 228, 201];
  const b = [176, 158, 120];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function HeroTile3D() {
  const D = 36; // Tiefe (px)
  const L = 28; // Ebenen
  const W = 150; // Breite  (muss zu .hero3d-layer passen)
  const H = 200; // Höhe
  const step = D / (L - 1);
  const layers = Array.from({ length: L }, (_, i) => {
    const z = -D / 2 + i * step;
    const t = 1 - i / (L - 1); // i=0 hinten
    const style: CSSProperties = { transform: `translateZ(${z}px)` };
    let content: ReactNode = null;
    if (i === L - 1) content = FRONT;
    else if (i === 0) content = BACK;
    else style.background = sideColor(t);
    return (
      <div key={i} className="hero3d-layer" style={style}>
        {content}
      </div>
    );
  });

  // Elfenbein-Wand ENTLANG DER RUNDEN SILHOUETTE (quer zu den Ebenen).
  // Die Ebenen-Extrusion verschwindet exakt im Kantenmoment der Drehung
  // (alle Ebenen stehen in Blickrichtung -> kurz „schwarz"); die Wand steht
  // senkrecht dazu und ist genau dann voll sichtbar. Damit die Kanten RUND
  // bleiben, folgt sie dem Umriss: 4 gerade Stücke + 6 Bogensegmente je Ecke.
  const R = 19; // muss zum border-radius von .hero3d-layer passen
  // Segment: Breite w, Mittelpunkt (px,py) relativ zur Box-Mitte, Drehung a in der Deckfläche.
  const segs: { w: number; px: number; py: number; a: number }[] = [
    { w: H - 2 * R, px: -W / 2, py: 0, a: 90 }, // links
    { w: H - 2 * R, px: W / 2, py: 0, a: 90 }, // rechts
    { w: W - 2 * R, px: 0, py: -H / 2, a: 0 }, // oben
    { w: W - 2 * R, px: 0, py: H / 2, a: 0 }, // unten
  ];
  const CORNERS: [number, number, number][] = [
    [-W / 2 + R, -H / 2 + R, 180], // oben links (Bogen 180°->270°)
    [W / 2 - R, -H / 2 + R, 270], // oben rechts
    [W / 2 - R, H / 2 - R, 0], // unten rechts
    [-W / 2 + R, H / 2 - R, 90], // unten links
  ];
  const STEPS = 6;
  const STEP = 90 / STEPS;
  const chord = 2 * R * Math.sin((STEP * Math.PI) / 360) + 1; // +1px gegen Haarfugen
  for (const [cx, cy, start] of CORNERS) {
    for (let i = 0; i < STEPS; i++) {
      const phi = ((start + STEP * (i + 0.5)) * Math.PI) / 180;
      segs.push({
        w: chord,
        px: cx + R * Math.cos(phi),
        py: cy + R * Math.sin(phi),
        a: (phi * 180) / Math.PI + 90,
      });
    }
  }
  const rims: CSSProperties[] = segs.map(({ w, px, py, a }) => ({
    width: w,
    height: D,
    left: W / 2 - w / 2,
    top: H / 2 - D / 2,
    transform: `translate3d(${px}px, ${py}px, 0) rotateZ(${a}deg) rotateX(90deg)`,
  }));

  return (
    <div className="hero3d-scene">
      <div className="hero3d-wrap">
        <div className="hero3d-tilt">
          <div className="hero3d-box">
            {rims.map((style, i) => (
              <div key={`rim-${i}`} className="hero3d-rim" style={style} />
            ))}
            {layers}
          </div>
        </div>
      </div>
    </div>
  );
}

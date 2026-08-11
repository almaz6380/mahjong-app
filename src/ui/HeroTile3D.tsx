// Startseiten-Hero: massiver 3D-Mahjongstein (中) mit runden Kanten + Tiefe,
// per Schicht-Extrusion (viele gestapelte runde Ebenen). Dreht sich sanft von
// selbst UND lässt sich per Finger/Maus frei drehen (mit Ausschwung). Reines
// CSS-3D, kein 3D-Framework.
import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import symbolZhong from '../assets/symbol-zhong.webp';
import emblemShield from '../assets/emblem-shield.webp';

// Vorderseite: Elfenbein-Korpus (wie gehabt) + freigestelltes Gemini-Zeichen 中.
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
    <image href={symbolZhong} x="11" y="15" width="38" height="50" preserveAspectRatio="xMidYMid meet" />
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
    <image href={emblemShield} x="9" y="11" width="42" height="58" preserveAspectRatio="xMidYMid meet" />
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

  const boxRef = useRef<HTMLDivElement>(null);
  // Rotationszustand außerhalb des React-Renders (kein Re-Render pro Frame).
  const st = useRef({
    rotX: 0, // aufrecht — die Ruhe-Drehung läuft nur um die Hochachse
    rotY: 18,
    velX: 0,
    velY: 0,
    dragging: false,
    idleResumeAt: 0,
    last: null as null | { x: number; y: number; t: number },
  });

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    let running = true;
    // Grad/Frame der Ruhe-Drehung. NEGATIV = nach links: Bei rotateY(+θ) wandert
    // die dem Betrachter zugewandte Fläche nach rechts.
    const IDLE = reduce ? 0 : -0.6;
    // Wie schnell die Neigung nach einem Wisch in die Aufrechte zurückläuft.
    const AUFRICHTEN = 0.06;

    const frame = () => {
      const s = st.current;
      const el = boxRef.current;
      if (!s.dragging) {
        // Ausschwung nach dem Loslassen …
        s.rotX += s.velX;
        s.rotY += s.velY;
        s.velX *= 0.94;
        s.velY *= 0.94;
        if (Math.abs(s.velX) < 0.01) s.velX = 0;
        if (Math.abs(s.velY) < 0.01) s.velY = 0;
        // … dann sanft zurück in die Ruhe-Drehung (nur wenn erlaubt).
        //
        // ⚠ Die Ruhe-Drehung läuft AUSSCHLIESSLICH um die Hochachse. Vorher lief
        // sie zusätzlich auf rotX (`IDLE * 0.42`); die Neigung wuchs damit Frame
        // für Frame, bis sie an der 80°-Grenze klebte — der Stein taumelte und
        // lag am Ende schräg statt aufrecht.
        const now = performance.now();
        if (IDLE !== 0 && s.velX === 0 && s.velY === 0 && now >= s.idleResumeAt) {
          s.rotY += IDLE;
          // Eine per Wisch erzeugte Neigung läuft in die Aufrechte zurück.
          if (Math.abs(s.rotX) < 0.05) s.rotX = 0;
          else s.rotX += (0 - s.rotX) * AUFRICHTEN;
        }
      }
      if (s.rotX > 80) s.rotX = 80;
      if (s.rotX < -80) s.rotX = -80;
      if (el) el.style.transform = `rotateX(${s.rotX}deg) rotateY(${s.rotY}deg)`;
      if (running) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  const onDown = (e: ReactPointerEvent) => {
    const s = st.current;
    s.dragging = true;
    s.velX = 0;
    s.velY = 0;
    s.last = { x: e.clientX, y: e.clientY, t: performance.now() };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent) => {
    const s = st.current;
    if (!s.dragging || !s.last) return;
    const dx = e.clientX - s.last.x;
    const dy = e.clientY - s.last.y;
    s.rotY += dx * 0.5;
    s.rotX -= dy * 0.5;
    // Momentum aus der letzten Bewegung (pro Frame ~ dx*0.5).
    s.velY = dx * 0.5;
    s.velX = -dy * 0.5;
    s.last = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onUp = (e: ReactPointerEvent) => {
    const s = st.current;
    s.dragging = false;
    s.last = null;
    s.idleResumeAt = performance.now() + 2500; // erst nach kurzer Ruhe weiterdrehen
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      className="hero3d-scene"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="hero3d-wrap">
        <div className="hero3d-tilt">
          <div className="hero3d-box" ref={boxRef}>
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

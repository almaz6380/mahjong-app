// Startseiten-Hero als freigestelltes Bild (Test: von Gemini erzeugter Stein).
// Sanftes Schwingen von selbst + Finger/Maus-Drehung mit Ausschwung. Da ein
// flaches Bild keine echte Rückseite hat, wird die Drehung begrenzt (kein
// Überschlag), sodass nie die Spiegelseite zu sehen ist.
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import heroTile from '../assets/hero-tile.webp';

export function HeroTileImage() {
  const cardRef = useRef<HTMLDivElement>(null);
  const st = useRef({
    rotX: 8,
    rotY: 0,
    velX: 0,
    velY: 0,
    dragging: false,
    idleResumeAt: 0,
    last: null as null | { x: number; y: number },
    t: 0,
  });

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    let running = true;
    const frame = () => {
      const s = st.current;
      const el = cardRef.current;
      s.t += 1;
      if (!s.dragging) {
        s.rotX += s.velX;
        s.rotY += s.velY;
        s.velX *= 0.93;
        s.velY *= 0.93;
        if (Math.abs(s.velX) < 0.01) s.velX = 0;
        if (Math.abs(s.velY) < 0.01) s.velY = 0;
        // sanftes Schwingen, sobald Ruhe eingekehrt ist
        if (!reduce && s.velX === 0 && s.velY === 0 && performance.now() >= s.idleResumeAt) {
          const targetY = Math.sin(s.t * 0.012) * 16;
          const targetX = 8 + Math.sin(s.t * 0.009 + 1) * 5;
          s.rotY += (targetY - s.rotY) * 0.04;
          s.rotX += (targetX - s.rotX) * 0.04;
        }
      }
      s.rotX = Math.max(-70, Math.min(70, s.rotX));
      s.rotY = Math.max(-70, Math.min(70, s.rotY));
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
    s.last = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent) => {
    const s = st.current;
    if (!s.dragging || !s.last) return;
    const dx = e.clientX - s.last.x;
    const dy = e.clientY - s.last.y;
    s.rotY += dx * 0.5;
    s.rotX -= dy * 0.5;
    s.velY = dx * 0.5;
    s.velX = -dy * 0.5;
    s.last = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: ReactPointerEvent) => {
    const s = st.current;
    s.dragging = false;
    s.last = null;
    s.idleResumeAt = performance.now() + 2500;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      className="herotile-scene"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="herotile-card" ref={cardRef}>
        <img src={heroTile} alt="Mahjong-Stein" draggable={false} />
      </div>
    </div>
  );
}

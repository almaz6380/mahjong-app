import { useLayoutEffect, useRef, useState } from 'react';
import type { FadeTile, PlacedTile } from '../game/engine';
import { Tile } from './Tile';

interface Props {
  tiles: PlacedTile[];
  fading: FadeTile[];
  freeSet: Set<number>;
  selected: number | null;
  hintPair: [number, number] | null;
  onTile: (key: number) => void;
}

const TW = 44; // Stein-Breite
const TH = 58; // Stein-Höhe
const DX = 0; // kein horizontaler Versatz -> Frontansicht, Steine sauber senkrecht gestapelt
const DY = 6; // vertikaler 3D-Versatz pro Ebene (= Korpus-Steindicke in Tile.tsx) – spürbare Tiefe

export function Board({ tiles, fading, freeSet, selected, hintPair, onTile }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const maxCol = tiles.reduce((m, t) => Math.max(m, t.col), 0);
  const maxRow = tiles.reduce((m, t) => Math.max(m, t.row), 0);
  const maxLayer = tiles.reduce((m, t) => Math.max(m, t.layer), 0);

  const boardW = (maxCol + 1) * TW + maxLayer * DX + 10;
  const boardH = (maxRow + 1) * TH + maxLayer * DY + 10;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const PAD = 8;
    const resize = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const s = Math.min((r.width - PAD) / boardW, (r.height - PAD) / boardH);
      // Deckel hoch (1.7 -> 3.2): dünne Layouts (Stern etc.) füllen den Screen,
      // Steine deutlich größer. Dichte Layouts sind ohnehin durch fit begrenzt.
      setScale(s > 0 ? Math.min(s, 3.2) : 1);
    };
    resize();
    // ResizeObserver fängt Layout-Änderungen zuverlässig ab (Timing-sicher).
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    window.addEventListener('resize', resize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [boardW, boardH]);

  return (
    <div className="board-wrap" ref={wrapRef}>
      {/* Äußere Box in Scale-Größe -> korrektes Zentrieren; innere Box wird von
          oben-links skaliert, sodass Layout und sichtbare Größe übereinstimmen. */}
      <div className="board-scale" style={{ width: boardW * scale, height: boardH * scale }}>
        <div
          className="board"
          style={{ width: boardW, height: boardH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
        {tiles
          .filter((t) => !t.removed)
          .map((t) => {
            const x = t.col * TW + t.layer * DX;
            const y = t.row * TH - t.layer * DY + maxLayer * DY;
            const free = freeSet.has(t.key);
            const isHint = hintPair && (hintPair[0] === t.key || hintPair[1] === t.key);
            const cls =
              'tile solid' +
              (free ? ' free' : ' blocked') +
              (selected === t.key ? ' selected' : '') +
              (isHint ? ' hint' : '');
            return (
              <button
                key={t.key}
                className={cls}
                style={{
                  left: x,
                  top: y,
                  width: TW,
                  height: TH,
                  zIndex: t.layer * 10000 + t.row * 100 + t.col + (selected === t.key ? 500000 : 0),
                }}
                onClick={() => onTile(t.key)}
                aria-label={t.face.id}
              >
                <Tile face={t.face.id} solid />
              </button>
            );
          })}
        {/* Verschwindende Steine (Match-Animation) */}
        {fading.map((f) => (
          <div
            key={`fade-${f.key}`}
            className="tile solid removing"
            style={{
              left: f.col * TW + f.layer * DX,
              top: f.row * TH - f.layer * DY + maxLayer * DY,
              width: TW,
              height: TH,
              zIndex: 99999,
            }}
          >
            <Tile face={f.faceId} solid />
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

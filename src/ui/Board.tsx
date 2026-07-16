import { useLayoutEffect, useRef, useState } from 'react';
import type { FadeTile, PlacedTile } from '../game/engine';
import { StoneTile, STONE } from './StoneTile';

interface Props {
  tiles: PlacedTile[];
  fading: FadeTile[];
  freeSet: Set<number>;
  selected: number | null;
  hintPair: [number, number] | null;
  onTile: (key: number) => void;
}

const { W, H, CW, CH, DX, DY } = STONE;

export function Board({ tiles, fading, freeSet, selected, hintPair, onTile }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const maxCol = tiles.reduce((m, t) => Math.max(m, t.col), 0);
  const maxRow = tiles.reduce((m, t) => Math.max(m, t.row), 0);
  const maxLayer = tiles.reduce((m, t) => Math.max(m, t.layer), 0);

  // Breite Figuren hochkant drehen (Screen ist hochkant). Reine Anzeige:
  // col/row-Logik (frei, Nachbarn) bleibt unangetastet.
  const rot = maxCol > maxRow;
  const dCol = (t: { col: number; row: number }) => (rot ? maxRow - t.row : t.col);
  const dRow = (t: { col: number; row: number }) => (rot ? t.col : t.row);
  const colsN = rot ? maxRow : maxCol;
  const rowsN = rot ? maxCol : maxRow;

  const boardW = (colsN + 1) * CW + maxLayer * DX + (W - CW) + 4;
  const boardH = (rowsN + 1) * CH + maxLayer * DY + (H - CH) + 4;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const PAD = 2;
    const resize = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const s = Math.min((r.width - PAD) / boardW, (r.height - PAD) / boardH);
      setScale(s > 0 ? Math.min(s, 2.2) : 1);
    };
    resize();
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
      <div className="board-scale" style={{ width: boardW * scale, height: boardH * scale }}>
        <div
          className="board"
          style={{ width: boardW, height: boardH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {[...tiles]
            .filter((t) => !t.removed)
            .sort((a, b) => a.layer - b.layer || dRow(a) - dRow(b) || dCol(a) - dCol(b))
            .map((t) => {
              const dc = dCol(t), dr = dRow(t);
              const x = dc * CW + t.layer * DX;
              const y = dr * CH - t.layer * DY + maxLayer * DY;
              const free = freeSet.has(t.key);
              const isHint = !!hintPair && (hintPair[0] === t.key || hintPair[1] === t.key);
              return (
                <button
                  key={t.key}
                  className={'stonebtn' + (free ? ' free' : ' blocked')}
                  style={{
                    left: x,
                    top: y,
                    width: W,
                    height: H,
                    zIndex: t.layer * 10000 + dr * 100 + dc + (selected === t.key ? 500000 : 0),
                  }}
                  onClick={() => onTile(t.key)}
                  aria-label={t.face.id}
                >
                  <StoneTile faceId={t.face.id} selected={selected === t.key} hint={isHint} dim={!free} />
                </button>
              );
            })}
          {/* Verschwindende Steine (Match-Animation) */}
          {fading.map((f) => (
            <div
              key={`fade-${f.key}`}
              className="stonebtn removing"
              style={{
                left: dCol(f) * CW + f.layer * DX,
                top: dRow(f) * CH - f.layer * DY + maxLayer * DY,
                width: W,
                height: H,
                zIndex: 99999,
              }}
            >
              <StoneTile faceId={f.faceId} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

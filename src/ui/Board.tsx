import { useLayoutEffect, useRef, useState } from 'react';
import type { FadeTile, PlacedTile } from '../game/engine';
import { Tile, TileBackSolid } from './Tile';
import { t as tr } from '../i18n';

interface Props {
  tiles: PlacedTile[];
  fading: FadeTile[];
  freeSet: Set<number>;
  /** Kurzzeitig aufgedeckte verdeckte Steine (Schluessel). */
  revealed?: Set<number>;
  selected: number | null;
  hintPair: [number, number] | null;
  onTile: (key: number) => void;
}

const TW = 44; // Stein-Breite
const TH = 58; // Stein-Höhe
// Stil S3 „klassisch schräg – bündig": Versatz je Ebene entspricht exakt den
// sichtbaren Kanten des Steins (Seitenkante 4, Unterkante 6 SVG-Einheiten).
const DX = 3.3; // = 4 × 44/54 – horizontaler Versatz je Ebene
const DY = 5; // = 6 × 58/72 – vertikaler Hub je Ebene
// Der Stein ragt über sein Feld hinaus: links die Seitenkante, unten Kante +
// Schatten (oben/rechts liegt er bündig).
const OVER_L = 3.3;
const OVER_B = 9.7;

export function Board({ tiles, fading, freeSet, revealed, selected, hintPair, onTile }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const maxLayer = tiles.reduce((m, t) => Math.max(m, t.layer), 0);

  // Maße aus den echten Steinpositionen (nicht aus maxCol/maxLayer geschätzt):
  // Bei Pyramiden ist die obere Ebene eingerückt, ihr Versatz zählt rechts also
  // nicht mit – sonst stünde das Board schief im Filz. Über ALLE Steine rechnen
  // (auch entfernte), damit die Figur beim Spielen nicht springt.
  const px = (t: { col: number; layer: number }) => t.col * TW + t.layer * DX;
  const py = (t: { row: number; layer: number }) => t.row * TH - t.layer * DY + maxLayer * DY;
  const minX = Math.min(...tiles.map(px));
  const maxX = Math.max(...tiles.map(px)) + TW;
  const minY = Math.min(...tiles.map(py));
  const maxY = Math.max(...tiles.map(py)) + TH;

  // Ausrichtung an den DECKFLÄCHEN, nicht an den Silhouetten: Die Seitenkante
  // sitzt nur links, würde man sie mitzentrieren, stünden die weißen Flächen
  // sichtbar nach rechts versetzt. Die Kante ragt darum links aus der Box –
  // der Platz dafür ist unten in der Skalierung reserviert.
  const boardW = maxX - minX;
  const boardH = maxY - minY + OVER_B;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const PAD = 12;
    const resize = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // Breite: Platz für die überstehende Seitenkante mitreservieren, sonst
      // schneidet .board-wrap (overflow:hidden) sie am linken Rand ab.
      const s = Math.min((r.width - PAD) / (boardW + OVER_L), (r.height - PAD) / boardH);
      // Deckel bremst nur die winzigsten Bretter (4×4 käme auf 2,1) – große
      // Steine sind gewollt, aber zwei Steine sollen nicht den Schirm füllen.
      setScale(s > 0 ? Math.min(s, 1.85) : 1);
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
    <div
      className="board-wrap"
      ref={wrapRef}
      // Rückfallebene für Safari ohne `overflow: clip` (< iOS 16): Dort kann der
      // Kasten trotz `overflow:hidden` gescrollt werden, und iOS holt den
      // angetippten (fokussierten) Stein in den sichtbaren Bereich — das ganze
      // Brett rutscht dabei. Wir nehmen jeden solchen Scroll sofort zurück.
      onScroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollTop !== 0) el.scrollTop = 0;
        if (el.scrollLeft !== 0) el.scrollLeft = 0;
      }}
    >
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
            const x = px(t) - minX;
            const y = py(t) - minY;
            const free = freeSet.has(t.key);
            const isHint = hintPair && (hintPair[0] === t.key || hintPair[1] === t.key);
            // Verdeckt, solange nicht gerade aufgedeckt. Der Wechsel ist ein
            // reiner Austausch des SVG-Inhalts — KEINE Umdreh-Animation:
            // `rotateY` auf `.tile` liesse unter dem gebrochenen Board-`scale`
            // das ganze Brett um ein Geraetepixel springen (siehe styles.css).
            const covered = !!t.hidden && !revealed?.has(t.key);
            const cls =
              'tile solid' +
              (free ? ' free' : ' blocked') +
              (selected === t.key ? ' selected' : '') +
              (covered ? ' covered' : '') +
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
                  // Ebene zuerst, dann Reihe (vordere über hinteren). Innerhalb der Reihe
                  // liegt der LINKE Nachbar oben und verdeckt die Seitenkante des rechten –
                  // so wirkt eine Ebene als bündige Fläche. (×2 wegen Halbschritt-Positionen)
                  zIndex: t.layer * 100000 + Math.round(t.row * 2) * 500 + (499 - Math.round(t.col * 2)),
                }}
                onClick={() => onTile(t.key)}
                // ⚠ Bei verdeckten Steinen darf hier NICHT die Motiv-ID stehen —
                // sie verriete Screenreader-Nutzern (und jedem, der den DOM
                // ansieht) genau das, was verdeckt sein soll.
                aria-label={covered ? tr('a11y.hidden') : t.face.id}
              >
                {covered ? <TileBackSolid /> : <Tile face={t.face.id} solid />}
              </button>
            );
          })}
        {/* Verschwindende Steine (Match-Animation) */}
        {fading.map((f) => (
          <div
            key={`fade-${f.key}`}
            className="tile solid removing"
            style={{
              left: px(f) - minX,
              top: py(f) - minY,
              width: TW,
              height: TH,
              zIndex: 10000000,
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

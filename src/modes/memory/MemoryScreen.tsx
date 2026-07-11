import { useCallback, useMemo, useRef, useState } from 'react';
import { buildDeck } from '../../game/tiles';
import { Tile, TileBack } from '../../ui/Tile';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { playTap, playMatch, playWin, playInvalid } from '../../audio/sound';
import { maybeShowInterstitialModes } from '../../ads/admob';
import { presentFact } from '../../ui/FactHost';
import type { ModeProps } from '../types';

type Size = 'easy' | 'normal' | 'hard';
const LAYOUT: Record<Size, { cols: number; pairs: number }> = {
  easy: { cols: 3, pairs: 6 },
  normal: { cols: 4, pairs: 8 },
  hard: { cols: 5, pairs: 15 },
};

interface Card { key: number; faceId: string; up: boolean; done: boolean }

const DISTINCT = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of buildDeck()) if (!seen.has(f.id)) { seen.add(f.id); out.push(f.id); }
  return out; // 42 verschiedene Motive
})();

function deal(pairs: number): Card[] {
  const faces = [...DISTINCT].sort(() => Math.random() - 0.5).slice(0, pairs);
  const cards = faces.flatMap((f) => [f, f]).map((faceId, i) => ({ key: i, faceId, up: false, done: false }));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.map((c, i) => ({ ...c, key: i }));
}

export function MemoryScreen({ api, onExit }: ModeProps) {
  const [size, setSize] = useState<Size>('normal');
  const [cards, setCards] = useState<Card[]>(() => deal(LAYOUT.normal.pairs));
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const flipped = useRef<number[]>([]);
  const lock = useRef(false);

  const restart = useCallback((s: Size) => {
    setSize(s);
    setCards(deal(LAYOUT[s].pairs));
    setMoves(0);
    setWon(false);
    setNewBest(false);
    flipped.current = [];
    lock.current = false;
  }, []);

  const click = useCallback(
    (idx: number) => {
      if (lock.current || won) return;
      const c = cards[idx];
      if (c.up || c.done) return;
      playTap();
      const nf = [...flipped.current, idx];
      flipped.current = nf;
      setCards((prev) => prev.map((x, i) => (i === idx ? { ...x, up: true } : x)));
      if (nf.length < 2) return;

      setMoves((m) => m + 1);
      lock.current = true;
      const [a, b] = nf;
      const match = cards[a].faceId === cards[b].faceId;
      setTimeout(() => {
        setCards((prev) => {
          const next = prev.map((x, i) =>
            i === a || i === b ? { ...x, up: match, done: match } : x,
          );
          if (match && next.every((x) => x.done)) {
            const totalMoves = moves + 1;
            playWin();
            const coins = 30 + LAYOUT[size].pairs * 4;
            api.addCoins(coins);
            const nb = api.recordModeBest(`memory-${size}`, totalMoves, false);
            setNewBest(nb);
            setWon(true);
            maybeShowInterstitialModes();
          } else if (match) {
            playMatch();
          } else {
            playInvalid();
          }
          return next;
        });
        flipped.current = [];
        lock.current = false;
      }, match ? 300 : 720);
    },
    [cards, won, moves, size, api],
  );

  const cols = LAYOUT[size].cols;
  const board = useMemo(
    () => (
      <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, width: `min(94vw, ${cols * 84}px)` }}>
        {cards.map((c, i) => (
          <button key={c.key} className={'mem-cell' + (c.up || c.done ? ' up' : '') + (c.done ? ' done' : '')} onClick={() => click(i)}>
            <span className="mem-inner">
              <span className="mem-back"><TileBack /></span>
              <span className="mem-face"><Tile face={c.faceId} /></span>
            </span>
          </button>
        ))}
      </div>
    ),
    [cards, cols, click],
  );

  return (
    <div className="mode-play">
      <header className="mode-head">
        <button className="icon-btn" onClick={onExit} aria-label="Menü"><Icon name="chevron" /></button>
        <div className="grow">
          <div className="score">{moves}<small>{t('mode.moves')}</small></div>
        </div>
        <div style={{ width: 40 }} />
      </header>

      <div className="mode-board">{board}</div>

      <div className="mode-foot">
        <div className="segment">
          {(['easy', 'normal', 'hard'] as Size[]).map((s) => (
            <button key={s} className={size === s ? 'on' : ''} onClick={() => restart(s)}>{t('set.' + s)}</button>
          ))}
        </div>
        <button onClick={() => restart(size)}>{t('game.new')}</button>
      </div>

      {won && (
        <div className="overlay">
          <div className="card">
            <div className="logo">🎉</div>
            <h2>{t('mode.won')}</h2>
            <p>{moves} {t('mode.moves')}{newBest ? ' · ' + t('mode.newBest') : ''}</p>
            <button className="big-btn" onClick={() => presentFact().then(() => restart(size))}>{t('mode.again')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

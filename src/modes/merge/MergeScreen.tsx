import { useCallback, useEffect, useRef, useState } from 'react';
import { Tile } from '../../ui/Tile';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { playTap, playMatch, playWin } from '../../audio/sound';
import { maybeShowInterstitialModes, showRewarded } from '../../ads/admob';
import { newGame, move, spawn, canMove, SIZE, type Grid, type Dir } from './logic';
import type { ModeProps } from '../types';

// Stufe -> Stein-Motiv.
function faceOf(level: number): string {
  if (level <= 9) return 'm' + level;
  if (level === 10) return 'z7'; // weißer Drache
  return 'z5'; // roter Drache (Top)
}

export function MergeScreen({ api, onExit }: ModeProps) {
  const [grid, setGrid] = useState<Grid>(() => newGame());
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const history = useRef<{ grid: Grid; score: number }[]>([]);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const best = api.bestOf('merge') ?? 0;

  const doMove = useCallback(
    (dir: Dir) => {
      if (over) return;
      setGrid((g) => {
        const r = move(g, dir);
        if (!r.moved) return g;
        history.current.push({ grid: g.slice(), score: scoreRef.current });
        if (history.current.length > 20) history.current.shift();
        spawn(r.grid);
        if (r.gained > 0) playMatch();
        else playTap();
        setScore((s) => s + r.gained);
        if (!canMove(r.grid)) {
          const finalScore = scoreRef.current + r.gained;
          playWin();
          const coins = 20 + Math.floor(finalScore / 200);
          api.addCoins(coins);
          setNewBest(api.recordModeBest('merge', finalScore, true));
          setOver(true);
          maybeShowInterstitialModes();
        }
        return r.grid;
      });
    },
    [over, api],
  );

  // Tastatur
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      const d = map[e.key];
      if (d) { e.preventDefault(); doMove(d); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doMove]);

  // Wischen
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };

  const restart = () => {
    setGrid(newGame());
    setScore(0);
    setOver(false);
    setNewBest(false);
    history.current = [];
  };

  const undo = async () => {
    if (!history.current.length) return;
    const ok = await showRewarded();
    if (!ok) return;
    const last = history.current.pop()!;
    setGrid(last.grid);
    setScore(last.score);
    setOver(false);
  };

  return (
    <div className="mode-play">
      <header className="mode-head">
        <button className="icon-btn" onClick={onExit} aria-label="Menü"><Icon name="chevron" /></button>
        <div className="grow"><div className="score">{score}<small>{t('mode.score')}</small></div></div>
        <div className="score" style={{ textAlign: 'right', minWidth: 64 }}>{Math.max(best, score)}<small>{t('mode.bestLabel')}</small></div>
      </header>

      <div className="mode-board" onTouchStart={onStart} onTouchEnd={onEnd}>
        <div className="m3-grid" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, width: 'min(92vw, 400px)', touchAction: 'none' }}>
          {grid.map((v, i) => (
            <div key={i} className="m3-cell" style={{ padding: 3 }}>
              {v > 0 ? <Tile face={faceOf(v)} /> : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,.05)', borderRadius: 8 }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="mode-foot">
        <button onClick={undo} disabled={!history.current.length}>
          <span className="btn-ico"><Icon name="video" size={14} /> {t('mode.undo')}</span>
        </button>
        <button onClick={restart}>{t('game.new')}</button>
      </div>
      <p className="hint-line" style={{ paddingBottom: 8 }}>{t('merge.swipe')}</p>

      {over && (
        <div className="overlay">
          <div className="card">
            <div className="logo">🔀</div>
            <h2>{t('mode.gameOver')}</h2>
            <p className="coins-won">{score}</p>
            {newBest && <p style={{ color: 'var(--accent)', marginTop: -8 }}>{t('mode.newBest')}</p>}
            <button className="big-btn" onClick={restart}>{t('mode.again')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

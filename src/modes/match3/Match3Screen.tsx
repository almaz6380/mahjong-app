import { useCallback, useState } from 'react';
import { Tile } from '../../ui/Tile';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { playTap, playMatch, playInvalid, playWin } from '../../audio/sound';
import { maybeShowInterstitialModes } from '../../ads/admob';
import { watchRewardedAd } from '../../ui/reward';
import { presentFact } from '../../ui/FactHost';
import { newBoard, findMatches, swapped, adjacent, resolve, anyValidMove, ROWS, COLS, MOVES, type Grid } from './logic';
import type { ModeProps } from '../types';

const FACES = ['z5', 'z6', 's1', 'p1', 'm1', 'flower1'];

export function Match3Screen({ api, onExit }: ModeProps) {
  const [grid, setGrid] = useState<Grid>(() => newBoard());
  const [sel, setSel] = useState(-1);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(MOVES);
  const [over, setOver] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const best = api.bestOf('match3') ?? 0;

  const endGame = useCallback((finalScore: number) => {
    playWin();
    api.addCoins(20 + Math.floor(finalScore / 100));
    setNewBest(api.recordModeBest('match3', finalScore, true));
    setOver(true);
    maybeShowInterstitialModes();
  }, [api]);

  const tap = useCallback(
    (i: number) => {
      if (over) return;
      if (sel === -1) { setSel(i); playTap(); return; }
      if (sel === i) { setSel(-1); return; }
      if (!adjacent(sel, i)) { setSel(i); return; }
      const sw = swapped(grid, sel, i);
      if (findMatches(sw).size === 0) { playInvalid(); setSel(-1); return; }
      // gültiger Zug
      const res = resolve(sw);
      let g2 = res.grid;
      if (!anyValidMove(g2)) g2 = newBoard(); // Sackgasse -> neu mischen
      const gained = res.cleared * 10;
      const newScore = score + gained;
      const left = moves - 1;
      playMatch();
      setGrid(g2);
      setScore(newScore);
      setMoves(left);
      setSel(-1);
      if (left <= 0) endGame(newScore);
    },
    [over, sel, grid, score, moves, endGame],
  );

  const restart = () => {
    setGrid(newBoard());
    setSel(-1);
    setScore(0);
    setMoves(MOVES);
    setOver(false);
    setNewBest(false);
  };

  const extraMoves = async () => {
    const ok = await watchRewardedAd();
    if (ok) { setMoves((m) => m + 5); setOver(false); }
  };

  return (
    <div className="mode-play">
      <header className="mode-head">
        <button className="icon-btn" onClick={onExit} aria-label="Menü"><Icon name="chevron" /></button>
        <div className="grow"><div className="score">{score}<small>{t('mode.score')}</small></div></div>
        <div className="score" style={{ textAlign: 'right', minWidth: 70 }}>{moves}<small>{t('mode.moves')}</small></div>
      </header>

      <div className="mode-board">
        <div className="m3-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, width: `min(94vw, ${COLS * 52}px)` }}>
          {grid.map((v, i) => (
            <button key={i} className={'m3-cell' + (sel === i ? ' sel' : '')} onClick={() => tap(i)}>
              <Tile face={FACES[v] ?? 'm1'} />
            </button>
          ))}
        </div>
      </div>

      <div className="mode-foot">
        <button onClick={restart}>{t('game.new')}</button>
      </div>

      {over && (
        <div className="overlay">
          <div className="card">
            <div className="logo">💎</div>
            <h2>{t('mode.gameOver')}</h2>
            <p className="coins-won">{score}</p>
            {newBest && <p style={{ color: 'var(--accent)', marginTop: -8 }}>{t('mode.newBest')}</p>}
            <button className="big-btn ghost solid" onClick={extraMoves}>
              <span className="btn-ico"><Icon name="video" size={16} /> +5 {t('mode.moves')}</span>
            </button>
            <button className="big-btn" onClick={() => presentFact().then(() => restart())}>{t('mode.again')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

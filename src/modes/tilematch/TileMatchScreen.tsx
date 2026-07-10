import { useCallback, useMemo, useState } from 'react';
import { Tile } from '../../ui/Tile';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { playTap, playMatch, playWin, playInvalid } from '../../audio/sound';
import { maybeShowInterstitialModes, showRewarded } from '../../ads/admob';
import type { ModeProps } from '../types';
import {
  makeBoard, isFree, pick as pickTile, isWon, isLost, undo as undoMove,
  removeThree, shuffleRemaining, TRAY_SIZE, type Board,
} from './logic';

const UNDO_COST = 20;
const SHUFFLE_COST = 60;

function cloneBoard(b: Board): Board {
  return { tiles: b.tiles.map((t) => ({ ...t })), tray: [...b.tray], solution: b.solution };
}

export function TileMatchScreen({ api, onExit }: ModeProps) {
  const [level, setLevel] = useState(() => (api.bestOf('tilematch') ?? 1));
  const [board, setBoard] = useState<Board>(() => makeBoard(level));
  const [result, setResult] = useState<'won' | 'lost' | null>(null);
  const [coins, setCoins] = useState(0);

  const bounds = useMemo(() => {
    let mx = 1, my = 1;
    for (const ti of board.tiles) { mx = Math.max(mx, ti.x + 1); my = Math.max(my, ti.y + 1); }
    return { mx, my };
  }, [board.tiles]);

  const check = useCallback((b: Board) => {
    if (isWon(b)) {
      const won = 30 + level * 5;
      playWin();
      api.addCoins(won);
      api.recordModeBest('tilematch', level + 1, true);
      setCoins(won);
      setResult('won');
      maybeShowInterstitialModes();
    } else if (isLost(b)) {
      setResult('lost');
    }
  }, [api, level]);

  const onTile = useCallback((id: number) => {
    if (result) return;
    if (!isFree(board, id)) { playInvalid(); return; }
    const nb = cloneBoard(board);
    pickTile(nb, id);
    playTap();
    if (nb.tray.length < board.tray.length) playMatch(); // Tripel aufgelöst
    setBoard(nb);
    check(nb);
  }, [board, result, check]);

  const doUndo = () => {
    if (result || board.tray.length === 0) return;
    if (!api.spendCoins(UNDO_COST)) return;
    const nb = cloneBoard(board); undoMove(nb); setBoard(nb);
  };
  const doShuffle = () => {
    if (result) return;
    if (!api.spendCoins(SHUFFLE_COST)) return;
    const nb = cloneBoard(board); shuffleRemaining(nb); setBoard(nb);
  };
  const doRemoveThree = async () => {
    const ok = await showRewarded();
    if (!ok) return;
    const nb = cloneBoard(board); removeThree(nb); setBoard(nb); setResult(null);
  };

  const restart = (lv: number) => {
    setLevel(lv); setBoard(makeBoard(lv)); setResult(null); setCoins(0);
  };

  const trayFaces = board.tray.map((id) => board.tiles[id].face);

  return (
    <div className="mode-play">
      <header className="mode-head">
        <button className="icon-btn" onClick={onExit} aria-label={t('common.toMenu')}><Icon name="chevron" /></button>
        <div className="grow"><div className="score">{t('tm.level', { n: level })}</div></div>
        <div style={{ width: 40 }} />
      </header>

      <div className="mode-board">
        <div className="tm-stack" style={{ width: `min(96vw, ${bounds.mx * 60}px)`, aspectRatio: `${bounds.mx} / ${bounds.my}` }}>
          {board.tiles.map((ti) => {
            if (ti.state !== 'board') return null;
            const free = isFree(board, ti.id);
            return (
              <button
                key={ti.id}
                className={'tm-tile' + (free ? ' free' : ' blocked')}
                style={{
                  left: `${(ti.x / bounds.mx) * 100}%`,
                  top: `${(ti.y / bounds.my) * 100}%`,
                  width: `${(1 / bounds.mx) * 100}%`,
                  height: `${(1 / bounds.my) * 100}%`,
                  zIndex: ti.layer + 1,
                }}
                onClick={() => onTile(ti.id)}
              >
                <Tile face={ti.face} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="tm-tray">
        {Array.from({ length: TRAY_SIZE }, (_, i) => (
          <div key={i} className={'tm-slot' + (i < trayFaces.length ? ' filled' : '')}>
            {i < trayFaces.length && <Tile face={trayFaces[i]} />}
          </div>
        ))}
      </div>

      <div className="mode-foot">
        <button onClick={doUndo} disabled={!!result || board.tray.length === 0}>
          <span className="btn-ico"><Icon name="chevron" size={15} /> {t('tm.undo')} · {UNDO_COST}</span>
        </button>
        <button onClick={doShuffle} disabled={!!result}>
          <span className="btn-ico"><Icon name="refresh" size={15} /> {t('tm.shuffle')} · {SHUFFLE_COST}</span>
        </button>
        <button onClick={() => restart(level)}>{t('game.new')}</button>
      </div>

      {result === 'won' && (
        <div className="overlay">
          <div className="card">
            <div className="logo">🎉</div>
            <h2>{t('tm.cleared')}</h2>
            <p className="coins-won"><Icon name="coin" size={24} /> +{coins}</p>
            <button className="big-btn" onClick={() => restart(level + 1)}>{t('tm.next')}</button>
            <button className="text-btn" onClick={onExit}>{t('common.toMenu')}</button>
          </div>
        </div>
      )}
      {result === 'lost' && (
        <div className="overlay">
          <div className="card">
            <div className="logo">😕</div>
            <h2>{t('tm.full')}</h2>
            <p>{t('tm.fullText')}</p>
            <button className="big-btn ghost solid" onClick={doRemoveThree}>
              <span className="btn-ico"><Icon name="video" size={16} /> {t('tm.free3')}</span>
            </button>
            <button className="big-btn" onClick={() => restart(level)}>{t('mode.again')}</button>
            <button className="text-btn" onClick={onExit}>{t('common.toMenu')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

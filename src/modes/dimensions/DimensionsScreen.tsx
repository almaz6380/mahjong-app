import { useCallback, useMemo, useState } from 'react';
import { Tile } from '../../ui/Tile';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { playTap, playMatch, playInvalid, playWin } from '../../audio/sound';
import { maybeShowInterstitialModes } from '../../ads/admob';
import { payOrWatch } from '../../ui/pay';
import { presentFact } from '../../ui/FactHost';
import type { ModeProps } from '../types';
import {
  makeBoard, isFree, canMatch, removePair, isWon, findHint, hasMoves,
  shuffleRemaining, type Board,
} from './logic';

const CW = 42;   // Zellbreite (px)
const CH = 20;   // Ebenen-Höhe (px)
const HINT_COST = 40;
const SHUFFLE_COST = 60;

function clone(b: Board): Board {
  return { tiles: b.tiles.map((t) => ({ ...t })), solution: b.solution };
}

export function DimensionsScreen({ api, onExit }: ModeProps) {
  const [level, setLevel] = useState(() => (api.bestOf('dimensions') ?? 1));
  const [board, setBoard] = useState<Board>(() => makeBoard(level));
  const [sel, setSel] = useState(-1);
  const [rot, setRot] = useState(-25);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [won, setWon] = useState(false);

  const dims = useMemo(() => {
    let mx = 0, my = 0, mz = 0;
    for (const ti of board.tiles) { mx = Math.max(mx, ti.x); my = Math.max(my, ti.y); mz = Math.max(mz, ti.z); }
    return { cx: mx / 2, cy: my / 2, mz };
  }, [board.tiles]);

  const finishCheck = useCallback((b: Board) => {
    if (isWon(b)) {
      playWin();
      const coins = 40 + level * 6;
      api.addCoins(coins);
      api.recordModeBest('dimensions', level + 1, true);
      setWon(true);
      maybeShowInterstitialModes();
    } else if (!hasMoves(b)) {
      // Sackgasse -> automatisch mischen
      setBoard((prev) => { const nb = clone(prev); shuffleRemaining(nb); return nb; });
    }
  }, [api, level]);

  const onTile = useCallback((id: number) => {
    if (won) return;
    if (!isFree(board, id)) { playInvalid(); return; }
    setHint(null);
    if (sel === -1) { setSel(id); playTap(); return; }
    if (sel === id) { setSel(-1); return; }
    if (canMatch(board, sel, id)) {
      const a = sel;
      const nb = clone(board); removePair(nb, a, id);
      playMatch(); setSel(-1); setBoard(nb); finishCheck(nb);
    } else { setSel(id); playInvalid(); }
  }, [board, sel, won, finishCheck]);

  const doHint = async () => {
    if (won) return;
    const h = findHint(board);
    if (!h) return;
    if (!(await payOrWatch({ what: t('mode.hint'), cost: HINT_COST, coins: api.coins, spendCoins: api.spendCoins }))) return;
    setHint(h);
    setTimeout(() => setHint(null), 1200);
  };
  const doShuffle = async () => {
    if (won) return;
    if (!(await payOrWatch({ what: t('game.shuffle'), cost: SHUFFLE_COST, coins: api.coins, spendCoins: api.spendCoins }))) return;
    const nb = clone(board); shuffleRemaining(nb); setBoard(nb); setSel(-1);
  };
  const restart = (lv: number) => { setLevel(lv); setBoard(makeBoard(lv)); setSel(-1); setHint(null); setWon(false); };

  return (
    <div className="mode-play">
      <header className="mode-head">
        <button className="icon-btn" onClick={onExit} aria-label={t('common.toMenu')}><Icon name="chevron" /></button>
        <div className="grow"><div className="score">{t('dim.level', { n: level })}</div></div>
        <div style={{ width: 40 }} />
      </header>

      <div className="mode-board dim-board">
        <div className="dim-scene" style={{ transform: `rotateX(58deg) rotateZ(${rot}deg)` }}>
          {board.tiles.map((ti) => {
            if (ti.removed) return null;
            const free = isFree(board, ti.id);
            const hi = hint && (hint[0] === ti.id || hint[1] === ti.id);
            return (
              <button
                key={ti.id}
                className={'dim-tile' + (free ? ' free' : ' blocked') + (sel === ti.id ? ' sel' : '') + (hi ? ' hint' : '')}
                style={{
                  transform: `translate3d(${(ti.x - dims.cx) * CW}px, ${(ti.y - dims.cy) * CW}px, ${ti.z * CH}px) rotateZ(${-rot}deg) rotateX(-58deg)`,
                  zIndex: ti.z * 100 + ti.y,
                }}
                onClick={() => onTile(ti.id)}
              >
                <Tile face={ti.face} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mode-foot">
        <button onClick={() => setRot((r) => r - 45)}><span className="btn-ico"><Icon name="refresh" size={15} /> ⟲</span></button>
        <button onClick={doHint}><span className="btn-ico"><Icon name="bulb" size={15} /> {t('dim.hint')} · {HINT_COST}</span></button>
        <button onClick={doShuffle}><span className="btn-ico"><Icon name="refresh" size={15} /> {t('dim.shuffle')} · {SHUFFLE_COST}</span></button>
        <button onClick={() => setRot((r) => r + 45)}><span className="btn-ico">⟳ <Icon name="refresh" size={15} /></span></button>
      </div>

      {won && (
        <div className="overlay">
          <div className="card">
            <div className="logo">🎉</div>
            <h2>{t('dim.cleared')}</h2>
            <button className="big-btn" onClick={() => presentFact().then(() => restart(level + 1))}>{t('tm.next')}</button>
            <button className="text-btn" onClick={onExit}>{t('common.toMenu')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

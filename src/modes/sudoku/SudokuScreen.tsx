import { useCallback, useMemo, useState } from 'react';
import { PinDigit } from '../../ui/Tile';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { playTap, playInvalid, playWin } from '../../audio/sound';
import { maybeShowInterstitialModes, showRewarded } from '../../ads/admob';
import { generate, canPlace, isComplete, type Board, type Difficulty, type Puzzle } from './logic';
import type { ModeProps } from '../types';

export function SudokuScreen({ api, onExit }: ModeProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [pz, setPz] = useState<Puzzle>(() => generate('easy'));
  const [board, setBoard] = useState<Board>(() => pz.puzzle.slice());
  const [sel, setSel] = useState<number>(-1);
  const [won, setWon] = useState(false);

  const restart = useCallback((d: Difficulty) => {
    const p = generate(d);
    setDifficulty(d);
    setPz(p);
    setBoard(p.puzzle.slice());
    setSel(-1);
    setWon(false);
  }, []);

  // Konflikt-Zellen (gleiche Zahl in Zeile/Spalte/Box)
  const bad = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < 81; i++) {
      const v = board[i];
      if (!v) continue;
      const tmp = board.slice();
      tmp[i] = 0;
      if (!canPlace(tmp, i, v)) set.add(i);
    }
    return set;
  }, [board]);

  const place = useCallback(
    (val: number) => {
      if (sel < 0 || pz.given[sel] || won) return;
      playTap();
      setBoard((b) => {
        const nb = b.slice();
        nb[sel] = nb[sel] === val ? 0 : val; // gleiche Zahl = löschen
        if (isComplete(nb) && nb.every((v, i) => v === pz.solution[i])) {
          playWin();
          const coins = { easy: 40, normal: 70, hard: 110 }[difficulty];
          api.addCoins(coins);
          api.recordModeBest('sudoku', (api.bestOf('sudoku') ?? 0) + 1, true);
          setWon(true);
          maybeShowInterstitialModes();
        } else if (nb[sel] && nb[sel] !== pz.solution[sel]) {
          playInvalid();
        }
        return nb;
      });
    },
    [sel, pz, won, difficulty, api],
  );

  const hint = useCallback(async () => {
    if (sel < 0 || pz.given[sel] || won) return;
    const ok = await showRewarded();
    if (ok) place(pz.solution[sel]);
  }, [sel, pz, won, place]);

  const selR = sel >= 0 ? (sel / 9) | 0 : -1;
  const selC = sel >= 0 ? sel % 9 : -1;

  return (
    <div className="mode-play">
      <header className="mode-head">
        <button className="icon-btn" onClick={onExit} aria-label="Menü"><Icon name="chevron" /></button>
        <div className="grow"><div className="score" style={{ fontSize: 16 }}>{t('mode.sudoku')}</div></div>
        <div style={{ width: 40 }} />
      </header>

      <div className="mode-board" style={{ flexDirection: 'column' }}>
        <div className="sudoku-grid">
          {board.map((v, i) => {
            const r = (i / 9) | 0;
            const c = i % 9;
            const cls =
              'sk-cell' +
              (pz.given[i] ? ' given' : '') +
              (i === sel ? ' sel' : selR === r || selC === c || (((r / 3) | 0) === ((selR / 3) | 0) && ((c / 3) | 0) === ((selC / 3) | 0)) ? ' peer' : '') +
              (bad.has(i) ? ' bad' : '') +
              (c % 3 === 2 && c !== 8 ? ' br' : '') +
              (r % 3 === 2 && r !== 8 ? ' bb' : '');
            return (
              <button key={i} className={cls} onClick={() => !pz.given[i] && setSel(i)}>
                {v ? <PinDigit rank={v} /> : null}
              </button>
            );
          })}
        </div>

        <div className="sk-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} onClick={() => place(n)}><PinDigit rank={n} /></button>
          ))}
        </div>
      </div>

      <div className="mode-foot">
        <div className="segment">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <button key={d} className={difficulty === d ? 'on' : ''} onClick={() => restart(d)}>{t('set.' + d)}</button>
          ))}
        </div>
        <button onClick={hint} disabled={sel < 0}>
          <span className="btn-ico"><Icon name="video" size={14} /> {t('mode.hint')}</span>
        </button>
      </div>

      {won && (
        <div className="overlay">
          <div className="card">
            <div className="logo">🎉</div>
            <h2>{t('mode.won')}</h2>
            <button className="big-btn" onClick={() => restart(difficulty)}>{t('mode.again')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

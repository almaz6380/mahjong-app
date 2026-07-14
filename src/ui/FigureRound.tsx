import { useEffect, useRef, type ReactNode } from 'react';
import { Board } from './Board';
import { Icon } from './Icon';
import { useGame } from '../game/useGame';
import { BOOSTER_COST } from '../game/progress';
import { playTap, playMatch, playInvalid, playWin, playKoto } from '../audio/sound';
import { t } from '../i18n';
import type { PlacedTile } from '../game/engine';

// Gemeinsame Solitaire-Runde für Zen, Pagoden-Aufstieg und Saison-Feste:
// Header + Board + Tipp/Mischen + Sieg-Hook. Die Sieg-Ansicht liefert der
// jeweilige Modus über renderWin (Restart via Remount mit neuem key).

interface Props {
  layoutName: string;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  freeBoosters?: boolean; // true = Tipp/Mischen gratis (Zen)
  spendCoins?: (n: number) => boolean; // nötig, wenn freeBoosters false
  onMatchPair?: (a?: PlacedTile, b?: PlacedTile) => void;
  onWin?: () => void;
  renderWin?: () => ReactNode;
  quiet?: boolean; // Zen: sanfter Sieg ohne Fanfare
  onExit: () => void;
}

export function FigureRound({
  layoutName,
  title,
  sub,
  right,
  freeBoosters = false,
  spendCoins,
  onMatchPair,
  onWin,
  renderWin,
  quiet = false,
  onExit,
}: Props) {
  const game = useGame(layoutName, {
    onSelect: playTap,
    onInvalid: playInvalid,
    onMatch: (a, b) => {
      playMatch();
      onMatchPair?.(a, b);
    },
    onWin: () => {
      if (!quiet) playWin();
      onWin?.();
    },
  });

  useEffect(() => {
    playKoto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sackgasse -> automatisch mischen (kostenlos), damit die Runde nie festhängt.
  const deadlock = !game.hasMoves && game.remaining > 0 && !game.won;
  const shuffling = useRef(false);
  useEffect(() => {
    if (deadlock && !shuffling.current) {
      shuffling.current = true;
      const id = setTimeout(() => {
        game.shuffle();
        shuffling.current = false;
      }, 500);
      return () => {
        clearTimeout(id);
        shuffling.current = false;
      };
    }
  }, [deadlock, game]);

  const boost = (kind: 'hint' | 'shuffle') => {
    if (!freeBoosters && spendCoins && !spendCoins(BOOSTER_COST[kind])) return;
    if (kind === 'hint') game.hint();
    else game.shuffle();
  };

  return (
    <div className="app">
      <header className="hud">
        <button className="icon-btn" onClick={onExit} aria-label={t('common.toMenu')}>
          <Icon name="chevron" />
        </button>
        <div className="hud-center">
          <div className="level">{title}</div>
          {sub && <div className="sub">{sub}</div>}
        </div>
        <div className="coins">{right ?? <span />}</div>
      </header>

      <Board
        tiles={game.tiles}
        fading={game.fading}
        freeSet={game.freeSet}
        selected={game.selected}
        hintPair={game.hintPair}
        onTile={game.clickTile}
      />

      <nav className="controls">
        <button className="booster" onClick={() => boost('hint')}>
          {t('game.hint')}
          {!freeBoosters && <span className="badge">{BOOSTER_COST.hint}</span>}
        </button>
        <button className="booster" onClick={() => boost('shuffle')}>
          {t('game.shuffle')}
          {!freeBoosters && <span className="badge">{BOOSTER_COST.shuffle}</span>}
        </button>
      </nav>

      {game.won && renderWin && <div className="overlay">{renderWin()}</div>}
    </div>
  );
}

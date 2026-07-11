import { useCallback, useEffect, useRef, useState } from 'react';
import { Board } from './Board';
import { CountUp } from './CountUp';
import { Icon } from './Icon';
import { useGame } from '../game/useGame';
import { starsFor, coinsFor } from '../game/scoring';
import { BOOSTER_COST, type BoosterType, type Progress } from '../game/progress';
import { DAILY_REWARD } from '../game/daily';
import { saveSession, clearSession } from '../game/session';
import { maybeShowInterstitial, showRewarded } from '../ads/admob';
import { presentFact } from './FactHost';
import { playTap, playMatch, playInvalid, playWin } from '../audio/sound';
import { t } from '../i18n';
import type { PlacedTile } from '../game/engine';

interface Api {
  useBooster: (t: BoosterType) => boolean;
  spendCoins: (n: number) => boolean;
  addCoins: (n: number) => void;
  recordWin: (level: number, stars: number, coins: number, elapsedMs?: number) => void;
  advanceLevel: () => void;
  completeDailyChallenge: (coins: number) => void;
}

interface Props {
  mode: 'level' | 'daily';
  level: number;
  layoutName: string;
  layoutLabel: string;
  initial?: { tiles: PlacedTile[]; elapsedMs: number; helpUsed: number };
  progress: Progress;
  api: Api;
  onExit: () => void;
  onNewRound: () => void;
}

const BOOSTER_LABEL: Record<BoosterType, string> = {
  hint: 'game.hint',
  shuffle: 'game.shuffle',
  undo: 'game.undo',
};

export function GameScreen({ mode, level, layoutName, layoutLabel, initial, progress, api, onExit, onNewRound }: Props) {
  const game = useGame(layoutName, {
    onSelect: playTap,
    onMatch: playMatch,
    onInvalid: playInvalid,
    onWin: playWin,
    initial,
  });

  const [purchase, setPurchase] = useState<BoosterType | null>(null);
  const [win, setWin] = useState<{ stars: number; coins: number; doubled: boolean } | null>(null);
  const winHandled = useRef(false);

  const doAction = useCallback(
    (t: BoosterType) => {
      if (t === 'hint') game.hint();
      else if (t === 'shuffle') game.shuffle();
      else game.undo();
    },
    [game],
  );

  const handleBooster = useCallback(
    (t: BoosterType) => {
      if (win) return;
      if (t === 'undo' && !game.canUndo) return;
      if (progress.boosters[t] > 0) {
        api.useBooster(t);
        doAction(t);
      } else {
        setPurchase(t);
      }
    },
    [win, game.canUndo, progress.boosters, api, doAction],
  );

  const buyWithCoins = useCallback(() => {
    if (!purchase) return;
    if (api.spendCoins(BOOSTER_COST[purchase])) doAction(purchase);
    setPurchase(null);
  }, [purchase, api, doAction]);

  const buyWithVideo = useCallback(async () => {
    if (!purchase) return;
    const t = purchase;
    setPurchase(null);
    const ok = await showRewarded();
    if (ok) doAction(t);
  }, [purchase, doAction]);

  // Laufendes Spiel sichern (nur normale Level, nicht Daily).
  useEffect(() => {
    if (mode !== 'level' || game.won) return;
    const snap = game.snapshot();
    const id = setTimeout(
      () => saveSession({ level, tiles: game.tiles, elapsedMs: snap.elapsedMs, helpUsed: snap.helpUsed }),
      300,
    );
    return () => clearTimeout(id);
  }, [game.tiles, game.won, mode, level, game]);

  // Sieg
  useEffect(() => {
    if (game.won && !winHandled.current) {
      winHandled.current = true;
      const snap = game.snapshot();
      const stars = starsFor({ tileCount: game.tileCount, elapsedMs: snap.elapsedMs, helpUsed: snap.helpUsed });
      if (mode === 'daily') {
        const coins = DAILY_REWARD + stars * 20;
        api.completeDailyChallenge(coins);
        setWin({ stars, coins, doubled: false });
      } else {
        const coins = coinsFor(stars);
        api.recordWin(level, stars, coins, snap.elapsedMs);
        clearSession();
        setWin({ stars, coins, doubled: false });
      }
    }
  }, [game.won, game, api, level, mode]);

  const doubleCoins = useCallback(async () => {
    if (!win || win.doubled) return;
    const ok = await showRewarded();
    if (ok) {
      api.addCoins(win.coins);
      setWin({ ...win, doubled: true });
    }
  }, [win, api]);

  const nextLevel = useCallback(async () => {
    await maybeShowInterstitial(level, progress.totalWins);
    await presentFact(); // kurze Infokarte vor der nächsten Runde
    api.advanceLevel(); // Parent remountet mit Level+1
  }, [level, progress.totalWins, api]);

  const deadlock = !game.hasMoves && game.remaining > 0 && !game.won;
  const title = mode === 'daily' ? t('game.daily') : t('game.level', { n: level });

  return (
    <div className="app">
      <header className="hud">
        <button className="icon-btn" onClick={onExit} aria-label="Menü">
          <Icon name="chevron" />
        </button>
        <div className="hud-center">
          <div className="level">{title}</div>
          <div className="sub">{t('game.pairs', { layout: t(layoutLabel), n: game.remaining / 2 })}</div>
        </div>
        <div className="coins"><Icon name="coin" /> {progress.coins}</div>
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
        <button onClick={onNewRound}>{t('game.new')}</button>
        <button className="booster" onClick={() => handleBooster('undo')} disabled={!game.canUndo}>
          {t('game.undo')}<span className="badge">{progress.boosters.undo}</span>
        </button>
        <button className="booster" onClick={() => handleBooster('hint')}>
          {t('game.hint')}<span className="badge">{progress.boosters.hint}</span>
        </button>
        <button className="booster" onClick={() => handleBooster('shuffle')}>
          {t('game.shuffle')}<span className="badge">{progress.boosters.shuffle}</span>
        </button>
      </nav>

      {deadlock && (
        <div className="overlay">
          <div className="card">
            <div className="logo">🔀</div>
            <h2>{t('game.noMoves')}</h2>
            <p>{t('game.noMovesText')}</p>
            <button className="big-btn" onClick={() => handleBooster('shuffle')}>
              {t('game.shuffle')}{progress.boosters.shuffle > 0 ? ` (${progress.boosters.shuffle})` : ''}
            </button>
          </div>
        </div>
      )}

      {purchase && (
        <div className="overlay" onClick={() => setPurchase(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <div className="logo">✨</div>
            <h2>{t('game.boosterEmpty', { b: t(BOOSTER_LABEL[purchase]) })}</h2>
            <p>{t('game.refill')}</p>
            <button className="big-btn" onClick={buyWithCoins} disabled={progress.coins < BOOSTER_COST[purchase]}>
              <span className="btn-ico"><Icon name="coin" /> {t('game.coinsBtn', { n: BOOSTER_COST[purchase] })}</span>
            </button>
            <button className="big-btn ghost solid" onClick={buyWithVideo}>
              <span className="btn-ico"><Icon name="video" /> {t('game.watchVideo')}</span>
            </button>
            <button className="text-btn" onClick={() => setPurchase(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {win && (
        <div className="overlay">
          <div className="card">
            <div className="stars">
              {[1, 2, 3].map((s) => (
                <span key={s} className={s <= win.stars ? 'star on' : 'star'}>
                  ★
                </span>
              ))}
            </div>
            <h2>{mode === 'daily' ? t('game.dailyDone') : t('game.levelDone', { n: level })}</h2>
            <p className="coins-won">
              <Icon name="coin" size={24} /> +<CountUp value={win.doubled ? win.coins * 2 : win.coins} />
              {win.doubled && <span className="doubled"> ×2!</span>}
            </p>
            {!win.doubled && (
              <button className="big-btn ghost solid" onClick={doubleCoins}>
                <span className="btn-ico"><Icon name="video" /> {t('game.doubleCoins')}</span>
              </button>
            )}
            {mode === 'daily' ? (
              <button className="big-btn" onClick={onExit}>
                {t('common.toMenu')}
              </button>
            ) : (
              <button className="big-btn" onClick={nextLevel}>
                {t('game.nextLevel')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

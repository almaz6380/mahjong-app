import { useCallback, useEffect, useRef, useState } from 'react';
import { Board } from '../../ui/Board';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { playMatch, playInvalid, playTap, playWin } from '../../audio/sound';
import { maybeShowInterstitialModes } from '../../ads/admob';
import { presentFact } from '../../ui/FactHost';
import { useGame } from '../../game/useGame';
import type { ModeProps } from '../types';

const START_SEC = 90;
const MATCH_BONUS = 2; // Sekunden pro Paar
const BOARD_BONUS = 12; // Sekunden für ein geleertes Brett
const LAYOUT = 'blitz';

export function BlitzScreen({ api, onExit }: ModeProps) {
  const [secLeft, setSecLeft] = useState(START_SEC);
  const [score, setScore] = useState(0);
  const [boards, setBoards] = useState(0);
  const [over, setOver] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const overRef = useRef(false);
  const best = api.bestOf('blitz') ?? 0;

  const game = useGame(LAYOUT, {
    onSelect: playTap,
    onInvalid: playInvalid,
    onMatch: () => {
      if (overRef.current) return;
      playMatch();
      setScore((s) => s + 1);
      setSecLeft((s) => s + MATCH_BONUS);
    },
  });

  // Countdown
  useEffect(() => {
    if (over) return;
    const id = setInterval(() => {
      setSecLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [over]);

  // Zeit abgelaufen -> Ende
  useEffect(() => {
    if (secLeft <= 0 && !overRef.current) {
      overRef.current = true;
      setOver(true);
      playWin();
      setNewBest(api.recordModeBest('blitz', score, true));
      const coins = 10 + Math.floor(score / 2);
      api.addCoins(coins);
      maybeShowInterstitialModes();
    }
  }, [secLeft, score, api]);

  // Brett geleert -> Bonus + neues Brett (endlos)
  useEffect(() => {
    if (game.won && !overRef.current) {
      setBoards((b) => b + 1);
      setSecLeft((s) => s + BOARD_BONUS);
      game.newGame(LAYOUT);
    }
  }, [game.won]);

  // Sackgasse -> automatisch mischen, damit der Blitz nicht stockt
  useEffect(() => {
    // Mischen kann bei manchen Resten nicht mehr helfen -> dann neues Brett,
    // damit der Blitz nicht bis zum Ablauf der Zeit stillsteht.
    if (!over && !game.hasMoves && game.remaining > 0 && !game.won && !game.shuffle()) game.newGame(LAYOUT);
  }, [game.hasMoves, game.remaining, game.won, over]);

  const restart = useCallback(() => {
    overRef.current = false;
    setOver(false);
    setSecLeft(START_SEC);
    setScore(0);
    setBoards(0);
    setNewBest(false);
    game.newGame(LAYOUT);
  }, [game]);

  const pct = Math.max(0, Math.min(100, (secLeft / START_SEC) * 100));
  const low = secLeft <= 10;

  return (
    <div className="app">
      <header className="hud">
        <button className="icon-btn" onClick={onExit} aria-label={t('common.toMenu')}><Icon name="chevron" /></button>
        <div className="hud-center">
          <div className="level">{t('blitz.title')}</div>
          <div className="sub">{t('blitz.score', { n: score })}</div>
        </div>
        <div className={'coins' + (low ? ' blitz-low' : '')}>⏱ {secLeft}s</div>
      </header>

      <div className="blitz-bar"><div className={'blitz-bar-fill' + (low ? ' low' : '')} style={{ width: pct + '%' }} /></div>

      <Board
        tiles={game.tiles}
        fading={game.fading}
        freeSet={game.freeSet}
        selected={game.selected}
        hintPair={game.hintPair}
        onTile={game.clickTile}
      />

      <nav className="controls">
        <button onClick={restart}>{t('game.new')}</button>
        <div className="blitz-stat">{t('blitz.boards', { n: boards })}</div>
      </nav>

      {over && (
        <div className="overlay">
          <div className="card">
            <div className="logo">⏱</div>
            <h2>{t('blitz.over')}</h2>
            <p className="coins-won">{t('blitz.score', { n: score })}</p>
            {newBest ? <p style={{ color: 'var(--accent)', marginTop: -6 }}>{t('mode.newBest')}</p>
              : <p style={{ color: 'var(--muted)', marginTop: -6 }}>{t('mode.best', { n: best })}</p>}
            <button className="big-btn" onClick={() => presentFact().then(() => restart())}>{t('mode.again')}</button>
            <button className="text-btn" onClick={onExit}>{t('common.toMenu')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

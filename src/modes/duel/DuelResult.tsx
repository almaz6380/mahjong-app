// Ergebniskarte nach einem Duell (Solitaire und Riichi).

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import type { DuelGame, EndReason } from '../../duel/protocol';

export interface DuelEnd {
  winner: number | null;
  reason: EndReason;
  results: { remaining: number; ms: number | null; points?: number }[];
  round: number;
}

export function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Münzen werden je Runde genau einmal gutgeschrieben — auch wenn die Karte
// nach einem Wiederverbinden neu einhängt.
const credited = new Set<string>();

export function DuelResult({
  end,
  slot,
  oppName,
  game,
  vsBot,
  want,
  oppOnline,
  onCoins,
  onRematch,
  onExit,
}: {
  end: DuelEnd;
  slot: number;
  oppName: string;
  game: DuelGame;
  vsBot: boolean;
  want: boolean[];
  oppOnline: boolean;
  onCoins: (won: boolean | null) => number;
  onRematch: () => void;
  onExit: () => void;
}) {
  const won = end.winner === null ? null : end.winner === slot;
  const [coins, setCoins] = useState(0);
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const id = `${game}-${end.round}-${end.results.map((r) => `${r.remaining}/${r.ms}/${r.points}`).join('|')}`;
    if (credited.has(id)) return;
    credited.add(id);
    setCoins(onCoins(won));
  }, [end, game, won, onCoins]);

  const me = end.results[slot];
  const other = end.results[1 - slot];
  const line = (r: { remaining: number; ms: number | null; points?: number }) =>
    game === 'riichi'
      ? t('duel.points', { n: (r.points ?? 0).toLocaleString() })
      : r.ms !== null
        ? fmtTime(r.ms)
        : t('duel.tilesLeft', { n: r.remaining });

  const iWant = want[slot];
  const theyWant = want[1 - slot];

  return (
    <div className="overlay">
      <div className="card duel-result">
        <div className="logo">{won === true ? '🏆' : won === false ? '🥈' : '🤝'}</div>
        <h2>{won === true ? t('duel.won') : won === false ? t('duel.lost') : t('duel.draw')}</h2>
        <p className="duel-reason">{t(`duel.reason.${end.reason}`)}</p>
        <div className="duel-score">
          <div className={won === true ? 'win' : ''}>
            <span>{t('duel.you')}</span>
            <b>{line(me)}</b>
          </div>
          <div className={won === false ? 'win' : ''}>
            <span>{vsBot ? '🤖 ' : ''}{oppName}</span>
            <b>{line(other)}</b>
          </div>
        </div>
        {coins > 0 && (
          <p className="coins-won">
            <Icon name="coin" size={22} /> +{coins}
          </p>
        )}
        {oppOnline ? (
          <button className="big-btn" onClick={onRematch} disabled={iWant}>
            {iWant ? t('duel.rematchWaiting') : theyWant ? t('duel.rematchAccept') : t('duel.rematch')}
          </button>
        ) : (
          <p className="duel-reason">{t('duel.oppLeft')}</p>
        )}
        <button className="text-btn" onClick={onExit}>{t('common.toMenu')}</button>
      </div>
    </div>
  );
}

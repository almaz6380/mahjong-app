// Riichi 1 gegen 1: Der Gegner sitzt oben, die KI links und rechts.
// Der Tisch ist der aus RiichiTable — nur dass der Zustand vom Server kommt.

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';
import { Tile } from '../../ui/Tile';
import { t } from '../../i18n';
import { playMatch, playTap, playWin } from '../../audio/sound';
import { Back, Pond, RTile, yakuLabel } from '../../mahjong4/ui/RiichiTable';
import type { TileCode } from '../../mahjong4/tiles4';
import type { RiichiView, ServerMsg } from '../../duel/protocol';
import type { DuelSession } from '../../duel/session';
import { DuelResult, type DuelEnd } from './DuelResult';

const WINDS = ['東', '南', '西', '北'];
const WIND_KEYS = ['m4.east', 'm4.south', 'm4.west', 'm4.north'];

interface Props {
  session: DuelSession;
  oppName: string;
  oppOnline: boolean;
  onCoins: (won: boolean | null) => number;
  onExit: () => void;
}

export function DuelRiichi({ session, oppName, oppOnline, onCoins, onExit }: Props) {
  const [view, setView] = useState<RiichiView | null>(null);
  const [end, setEnd] = useState<DuelEnd | null>(null);
  const [want, setWant] = useState([false, false]);
  const [now, setNow] = useState(() => session.serverNow());
  const round = useRef(1);
  const lastLen = useRef(-1);

  useEffect(
    () =>
      session.subscribe((m: ServerMsg) => {
        if (m.t === 'rstate') {
          const v = m.view;
          // Neue Partie (Revanche): Ergebnis zurücksetzen.
          setView((prev) => {
            if (prev && v.handNo === 1 && prev.handNo !== 1) {
              round.current++;
              setEnd(null);
              setWant([false, false]);
            }
            return v;
          });
          const n = v.discards.reduce((a, d) => a + d.length, 0);
          if (lastLen.current >= 0 && n > lastLen.current) playTap(false);
          lastLen.current = n;
        } else if (m.t === 'end') {
          setEnd((prev) => prev ?? { winner: m.winner, reason: m.reason, results: m.results, round: round.current });
          playWin();
        } else if (m.t === 'rematch') {
          setWant(m.want);
        }
      }),
    [session],
  );

  useEffect(() => {
    const id = setInterval(() => setNow(session.serverNow()), 250);
    return () => clearInterval(id);
  }, [session]);

  if (!view) {
    return (
      <div className="app">
        <div className="duel-wait">
          <div className="logo spin">🀄</div>
        </div>
      </div>
    );
  }

  const me = view.mySeat;
  const rel = (k: number) => (me + k) % 4; // 1 rechts, 2 oben (Gegner), 3 links
  const seatWind = (p: number) => (p - view.dealer + 4) % 4;
  const windName = (p: number) => t(WIND_KEYS[seatWind(p)]);
  const isTurn = (p: number) => view.turn === p && !view.result;
  const my = view.my;
  const secs = view.acting ? Math.max(0, Math.ceil((view.acting.deadline - now) / 1000)) : 0;
  const nameOf = (p: number) => (view.humans.includes(p) ? (p === me ? t('duel.you') : oppName) : t('duel.ai'));
  const tag = (p: number) =>
    `${WINDS[seatWind(p)]} ${nameOf(p)}${view.dealer === p ? ` · ${t('m4.dealer')}` : ''}${view.riichi[p] ? ' · Riichi' : ''}`;

  const seat = (p: number, cls: string, vertical: boolean) => (
    <div className={`seat ${cls}` + (isTurn(p) ? ' active' : '')}>
      <div className="seat-tag">
        {tag(p)} <span className="duel-pts">{view.points[p].toLocaleString()}</span>
        {view.acting?.seat === p && view.humans.includes(p) && p !== me && <span className="duel-timer"> ⏱ {secs}</span>}
      </div>
      <Back n={view.handCounts[p]} vertical={vertical} />
      <Pond tiles={view.discards[p] as TileCode[]} />
    </div>
  );

  const r = view.result;
  return (
    <div className="m4 riichi duel">
      <header className="hud">
        <button className="icon-btn" onClick={onExit} aria-label={t('common.toMenu')}><Icon name="chevron" /></button>
        <div className="hud-center">
          <div className="level">{t('duel.riichiTitle')}</div>
          <div className="sub">
            {t('duel.hand', { n: view.handNo, of: view.totalHands })} · {t('m4.wall', { n: view.wall })}
          </div>
        </div>
        <div className="coins">{view.points[me].toLocaleString()}</div>
      </header>

      {seat(rel(2), 'top', false)}
      <div className="m4-mid">
        {seat(rel(3), 'left', true)}
        <div className="center">
          <div className="winds">{t('m4.roundYou', { r: t(WIND_KEYS[view.roundWind]), s: windName(me) })}</div>
          <div className="dora-chip">
            <span className="dora-lbl">Dora</span>
            <span className="mtile small"><Tile face={view.dora} /></span>
          </div>
          {view.lastDiscard ? (
            <div className="last">
              <div className="last-lbl">{t('m4.discard')}</div>
              <RTile code={view.lastDiscard.tile as TileCode} highlight />
            </div>
          ) : (
            <div className="turn-ind">{isTurn(me) ? t('m4.yourTurn') : t('m4.draws', { w: windName(view.turn) })}</div>
          )}
        </div>
        {seat(rel(1), 'right', true)}
      </div>

      <div className={'seat bottom' + (isTurn(me) ? ' active' : '')}>
        <div className="hand">
          {view.hand.map((c, i) => (
            <RTile
              key={i}
              code={c as TileCode}
              highlight={c === view.lastDrawn && i === view.hand.lastIndexOf(c)}
              onClick={my?.kind === 'discard' ? () => session.send({ t: 'discard', tile: c }) : undefined}
            />
          ))}
        </div>
        <div className="m4-actions">
          {my?.kind === 'discard' && (
            <div className={'hint-line' + (view.riichi[me] ? ' tenpai' : '')}>
              {view.riichi[me] ? t('riichi.riichiHint') : t('riichi.discardHint')} · ⏱ {secs}
            </div>
          )}
          {!my && !r && !oppOnline && <div className="hint-line">{t('duel.oppAway')}</div>}
        </div>
      </div>

      {my?.kind === 'discard' && (my.canTsumo || my.canRiichi) && (
        <div className="claim-bar">
          {my.canTsumo && <button className="claim win" onClick={() => session.send({ t: 'tsumo' })}>Tsumo</button>}
          {my.canRiichi && (
            <button
              className="claim"
              onClick={() => {
                playMatch();
                session.send({ t: 'riichi' });
              }}
            >
              Riichi
            </button>
          )}
        </div>
      )}
      {my?.kind === 'ron' && (
        <div className="claim-bar">
          <button className="claim win" onClick={() => session.send({ t: 'ron' })}>Ron · {secs}</button>
          <button className="claim pass" onClick={() => session.send({ t: 'pass' })}>{t('m4.pass')}</button>
        </div>
      )}

      {r && !end && (
        <div className="overlay">
          <div className="card">
            <div className="logo">{r.winner === me ? '🎉' : r.winner === null ? '🀫' : view.humans.includes(r.winner) ? '😮' : '🤖'}</div>
            <h2>
              {r.winner === null
                ? t('m4.wallEmpty')
                : r.winner === me
                  ? r.tsumo
                    ? t('riichi.winTsumo')
                    : t('riichi.winRon')
                  : t('duel.handWonBy', { name: nameOf(r.winner) })}
            </h2>
            {r.hand && (
              <div className="duel-winhand">
                {r.hand.map((c, i) => (
                  <span key={i} className="mtile small"><Tile face={c} /></span>
                ))}
              </div>
            )}
            {r.scored && r.scored.points > 0 && (
              <>
                <p className="coins-won">
                  {r.scored.yakuman ? 'Yakuman' : `${r.scored.han} Han / ${r.scored.fu} Fu`} · {t('riichi.points', { n: r.scored.points })}
                </p>
                <div className="faan-list">
                  {r.scored.yaku.map((y, i) => (
                    <div key={i}><span>{yakuLabel(y.name)}</span><span>+{y.han}</span></div>
                  ))}
                </div>
              </>
            )}
            <div className="duel-score">
              {view.humans.map((p) => (
                <div key={p}>
                  <span>{nameOf(p)}</span>
                  <b>
                    {view.points[p].toLocaleString()}
                    {r.delta[p] !== 0 && <small> ({r.delta[p] > 0 ? '+' : ''}{r.delta[p].toLocaleString()})</small>}
                  </b>
                </div>
              ))}
            </div>
            <button className="big-btn" onClick={() => session.send({ t: 'next' })} disabled={view.ready[me]}>
              {view.ready[me] ? t('duel.waitingOpp') : view.handNo >= view.totalHands ? t('duel.toResult') : t('duel.nextHand')}
            </button>
          </div>
        </div>
      )}

      {end && (
        <DuelResult
          end={end}
          slot={session.slot}
          oppName={oppName}
          game="riichi"
          vsBot={false}
          want={want}
          oppOnline={oppOnline}
          onCoins={onCoins}
          onRematch={() => session.send({ t: 'rematch' })}
          onExit={onExit}
        />
      )}
    </div>
  );
}

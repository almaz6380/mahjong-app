// Solitaire-Wettrennen: beide spielen dasselbe Brett, wer zuerst fertig ist, gewinnt.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../../ui/Board';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { playInvalid, playMatch, playTap, playWin } from '../../audio/sound';
import { useGame } from '../../game/useGame';
import type { PlacedTile } from '../../game/engine';
import {
  DUEL_PENALTY_MS,
  DUEL_STUCK_PENALTY_MS,
  DUEL_TIME_CAP_MS,
  duelShuffleRand,
  SoloBoard,
} from '../../duel/solitaire';
import type { ServerMsg, SoloOp } from '../../duel/protocol';
import type { DuelSession } from '../../duel/session';
import { DuelResult, fmtTime, type DuelEnd } from './DuelResult';

interface StartInfo {
  seed: number;
  layout: string;
  startAt: number;
  round: number;
}

interface Props {
  session: DuelSession;
  oppName: string;
  oppOnline: boolean;
  onCoins: (won: boolean | null) => number;
  onExit: () => void;
}

export function DuelSolitaire({ session, oppName, oppOnline, onCoins, onExit }: Props) {
  const [start, setStart] = useState<StartInfo | null>(null);
  const [replay, setReplay] = useState<{ round: number; log: SoloOp[] } | null>(null);
  const [opp, setOpp] = useState<{ remaining: number; total: number; stuck: boolean } | null>(null);
  const [mine, setMine] = useState<{ stuck: boolean } | null>(null);
  const [end, setEnd] = useState<DuelEnd | null>(null);
  const [want, setWant] = useState([false, false]);
  const startRef = useRef<StartInfo | null>(null);

  useEffect(
    () =>
      session.subscribe((m: ServerMsg) => {
        if (m.t === 'start') {
          // Dieselbe Runde noch einmal (Wiederverbinden): laufendes Brett behalten.
          if (startRef.current?.round === m.round && startRef.current.seed === m.seed) return;
          const s = { seed: m.seed, layout: m.layout, startAt: m.startAt, round: m.round };
          startRef.current = s;
          setStart(s);
          setReplay(null);
          setOpp(null);
          setMine(null);
          setEnd(null);
          setWant([false, false]);
        } else if (m.t === 'replay') {
          if (m.round === startRef.current?.round) setReplay(m);
        } else if (m.t === 'progress') {
          if (m.slot === session.slot) setMine({ stuck: m.stuck });
          else setOpp({ remaining: m.remaining, total: m.total, stuck: m.stuck });
        } else if (m.t === 'end') {
          setEnd((prev) => prev ?? { winner: m.winner, reason: m.reason, results: m.results, round: startRef.current?.round ?? 0 });
        } else if (m.t === 'rematch') {
          setWant(m.want);
        }
      }),
    [session],
  );

  if (!start) {
    return (
      <div className="app">
        <div className="duel-wait">
          <div className="logo spin">🀄</div>
        </div>
      </div>
    );
  }

  // Nach einem App-Neustart: eigenes Brett aus dem Zugprotokoll des Servers
  // nachbauen und von dort weiterspielen.
  const key = `${start.round}-${replay ? 'r' : 'n'}`;
  return (
    <SoloRace
      key={key}
      session={session}
      start={start}
      replay={replay?.log ?? null}
      opp={opp}
      oppName={oppName}
      oppOnline={oppOnline}
      stuckConfirmed={!!mine?.stuck}
      end={end}
      want={want}
      onCoins={onCoins}
      onExit={onExit}
    />
  );
}

function rebuild(start: StartInfo, slot: number, log: SoloOp[] | null): { tiles: PlacedTile[]; shuffles: number } | null {
  if (!log) return null;
  const b = new SoloBoard(start.seed, start.layout, slot);
  for (const op of log) {
    if (op[0] === 'm') b.match(op[1], op[2]);
    else if (op[0] === 'u') b.undo();
    else b.shuffle();
  }
  return { tiles: b.tiles, shuffles: b.shuffles };
}

function SoloRace({
  session,
  start,
  replay,
  opp,
  oppName,
  oppOnline,
  stuckConfirmed,
  end,
  want,
  onCoins,
  onExit,
}: {
  session: DuelSession;
  start: StartInfo;
  replay: SoloOp[] | null;
  opp: { remaining: number; total: number; stuck: boolean } | null;
  oppName: string;
  oppOnline: boolean;
  stuckConfirmed: boolean;
  end: DuelEnd | null;
  want: boolean[];
  onCoins: (won: boolean | null) => number;
  onExit: () => void;
}) {
  const slot = session.slot;
  const initial = useMemo(() => {
    const r = rebuild(start, slot, replay);
    return { tiles: r?.tiles ?? new SoloBoard(start.seed, start.layout, slot).tiles, shuffles: r?.shuffles ?? 0 };
  }, [start, slot, replay]);
  const shuffles = useRef(initial.shuffles);

  const [now, setNow] = useState(() => session.serverNow());
  const [lockUntil, setLockUntil] = useState(0);
  const [stuckSent, setStuckSent] = useState(false);
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => {
    const id = setInterval(() => setNow(session.serverNow()), 250);
    return () => clearInterval(id);
  }, [session]);

  const game = useGame(start.layout, {
    initial: { tiles: initial.tiles, elapsedMs: 0, helpUsed: 0 },
    shuffleRand: () => duelShuffleRand(start.seed, slot, shuffles.current),
    onSelect: playTap,
    onInvalid: playInvalid,
    onMatch: (a, b) => {
      if (!a || !b) return;
      playMatch();
      session.send({ t: 'match', a: a.key, b: b.key });
    },
    onWin: playWin,
  });

  const countdown = Math.ceil((start.startAt - now) / 1000);
  const running = countdown <= 0 && !end;
  const locked = lockUntil > now;
  const elapsed = Math.max(0, now - start.startAt);
  const left = Math.max(0, DUEL_TIME_CAP_MS - elapsed);

  const tap = useCallback(
    (k: number) => {
      if (!running || locked || stuckSent) return;
      game.clickTile(k);
    },
    [running, locked, stuckSent, game],
  );

  const doShuffle = useCallback(
    (penalty: boolean): boolean => {
      if (!game.shuffle()) return false;
      shuffles.current++;
      session.send({ t: 'shuffle' });
      if (penalty) setLockUntil(session.serverNow() + DUEL_PENALTY_MS);
      return true;
    },
    [game, session],
  );

  // Sackgasse: automatisch mischen (ohne Strafe). Geht gar nichts mehr, wird der
  // Rest gegen Strafzeit abgeräumt.
  //
  // ⚠ `doShuffle` über eine Ref aufrufen und NICHT in die Abhängigkeiten
  // nehmen: Es ist bei jedem Rendern neu, und die Uhr rendert alle 250 ms —
  // der 400-ms-Timer würde so immer wieder abgebrochen und nie auslösen.
  const shuffleRef = useRef(doShuffle);
  shuffleRef.current = doShuffle;
  const deadEnd = running && !stuckSent && !game.won && !game.hasMoves && game.remaining > 0;
  useEffect(() => {
    if (!deadEnd) return;
    const id = setTimeout(() => {
      if (!shuffleRef.current(false)) {
        setStuckSent(true);
        session.send({ t: 'stuck' });
      }
    }, 400);
    return () => clearTimeout(id);
  }, [deadEnd, game.tiles, session]);

  const pct = (r: number, total: number) => Math.round(100 * (1 - r / Math.max(1, total)));
  const myPct = stuckConfirmed ? 100 : pct(game.remaining, game.tileCount);
  const oppPct = opp ? (opp.stuck ? 100 : pct(opp.remaining, opp.total)) : 0;

  return (
    <div className="app duel">
      <header className="hud">
        <button className="icon-btn" onClick={onExit} aria-label={t('common.toMenu')}><Icon name="chevron" /></button>
        <div className="hud-center">
          <div className="level">{t('duel.title')}</div>
          <div className="sub">{session.vsBot ? t('duel.vsAi') : t('duel.vs', { name: oppName })}</div>
        </div>
        <div className={'coins' + (left < 30000 && running ? ' blitz-low' : '')}>⏱ {fmtTime(elapsed)}</div>
      </header>

      <div className="duel-bars">
        <div className="duel-bar-row">
          <span className="duel-bar-name">{t('duel.you')}</span>
          <div className="duel-bar"><div className="duel-bar-fill me" style={{ width: myPct + '%' }} /></div>
          <span className="duel-bar-n">{stuckConfirmed ? '+20s' : game.remaining}</span>
        </div>
        <div className="duel-bar-row">
          <span className="duel-bar-name">
            {session.vsBot ? '🤖 ' : ''}
            {oppName}
            {!oppOnline && !session.vsBot && <em> · {t('duel.offline')}</em>}
          </span>
          <div className="duel-bar"><div className="duel-bar-fill opp" style={{ width: oppPct + '%' }} /></div>
          <span className="duel-bar-n">{opp ? (opp.stuck ? '+20s' : opp.remaining) : '–'}</span>
        </div>
      </div>

      <div className="duel-board">
        <Board
          tiles={game.tiles}
          fading={game.fading}
          freeSet={game.freeSet}
          revealed={game.revealed}
          selected={game.selected}
          hintPair={game.hintPair}
          onTile={tap}
        />
        {countdown > 0 && (
          <div className="duel-countdown">
            <span key={countdown}>{countdown > 3 ? '…' : countdown}</span>
          </div>
        )}
        {locked && running && (
          <div className="duel-lock">🔒 {Math.ceil((lockUntil - now) / 1000)}</div>
        )}
        {stuckSent && !end && (
          <div className="duel-lock wide">
            {t('duel.stuck', { n: DUEL_STUCK_PENALTY_MS / 1000 })}
          </div>
        )}
      </div>

      <nav className="controls">
        <button
          onClick={() => {
            if (!running || locked || !game.canUndo) return;
            game.undo();
            session.send({ t: 'undo' });
          }}
          disabled={!running || locked || !game.canUndo}
        >
          {t('game.undo')}
        </button>
        <button
          onClick={() => {
            if (!running || locked) return;
            game.hint();
            setLockUntil(session.serverNow() + DUEL_PENALTY_MS);
          }}
          disabled={!running || locked}
        >
          {t('game.hint')} <small className="duel-pen">+5s</small>
        </button>
        <button onClick={() => running && !locked && doShuffle(true)} disabled={!running || locked}>
          {t('game.shuffle')} <small className="duel-pen">+5s</small>
        </button>
      </nav>

      {end && (
        <DuelResult
          end={end}
          slot={slot}
          oppName={oppName}
          game="solitaire"
          vsBot={session.vsBot}
          want={want}
          oppOnline={oppOnline || session.vsBot}
          onCoins={onCoins}
          onRematch={() => session.send({ t: 'rematch' })}
          onExit={onExit}
        />
      )}
    </div>
  );
}

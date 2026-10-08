// Duell: Menü (Spiel wählen, Freund einladen, Code eingeben, zufälliger
// Gegner), Warteraum und Übergabe an das jeweilige Spiel.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { ScreenHeader } from '../../ui/Screens';
import { showToast } from '../../ui/ToastHost';
import { t } from '../../i18n';
import { normalizeCode, CODE_LEN, type DuelGame } from '../../duel/protocol';
import { createRoom, inviteLink, joinQueue, roomInfo, type ConnStatus } from '../../duel/net';
import { getIdentity, rerollName, type DuelIdentity } from '../../duel/identity';
import { DuelSession } from '../../duel/session';
import { DuelSolitaire } from './DuelSolitaire';
import { DuelRiichi } from './DuelRiichi';

/** Ohne Gegner nach so langer Zeit die Ausweichmöglichkeit anbieten. */
const QUEUE_FALLBACK_MS = 30000;

/** Münzen: Sieg / Unentschieden / Niederlage. Gegen die KI die Hälfte. */
const COINS = {
  solitaire: { win: 20, draw: 10, loss: 5 },
  riichi: { win: 30, draw: 15, loss: 10 },
};

type View =
  | { k: 'hub' }
  | { k: 'busy' }
  | { k: 'enter' }
  | { k: 'queue'; since: number }
  | { k: 'room'; code: string }; // verbunden (wartet oder spielt)

interface Props {
  addCoins: (n: number) => void;
  /** Aus einem Einladungslink: direkt diesem Raum beitreten. */
  initialCode?: string | null;
  onOpenRiichi: () => void;
  onExit: () => void;
}

export function DuelScreen({ addCoins, initialCode, onOpenRiichi, onExit }: Props) {
  const [game, setGame] = useState<DuelGame>('solitaire');
  const [view, setView] = useState<View>({ k: 'hub' });
  const [me, setMe] = useState<DuelIdentity | null>(null);
  const [session, setSession] = useState<DuelSession | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [players, setPlayers] = useState<{ name: string; online: boolean }[]>([]);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const cancelQueue = useRef<(() => void) | null>(null);
  const sessionRef = useRef<DuelSession | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    getIdentity().then(setMe);
  }, []);

  // Beim Verlassen: Verbindung und Warteschlange sauber schließen.
  useEffect(
    () => () => {
      cancelQueue.current?.();
      sessionRef.current?.close();
    },
    [],
  );

  const openSession = useCallback((s: DuelSession, roomCode: string) => {
    sessionRef.current?.close();
    setStarted(false);
    setPlayers([]);
    setSession(s);
    setView({ k: 'room', code: roomCode });
    s.onStatus(setStatus);
    s.subscribe((m) => {
      if (m.t === 'joined') setGame(m.game);
      if (m.t === 'players') setPlayers(m.players);
      if (m.t === 'start' || (m.t === 'rstate' && m.view.handNo === 1 && !m.view.result)) setEnded(false);
      if (m.t === 'start' || m.t === 'rstate') setStarted(true);
      if (m.t === 'end') setEnded(true);
      if (m.t === 'error') {
        showToast(t(`duel.err.${m.code}`));
        s.close();
        setSession(null);
        setView({ k: 'hub' });
      }
    });
  }, []);

  const join = useCallback(
    async (raw: string) => {
      const c = normalizeCode(raw);
      if (!c) return showToast(t('duel.err.notfound'));
      setView({ k: 'busy' });
      try {
        const info = await roomInfo(c);
        if (!info) {
          showToast(t('duel.err.notfound'));
          return setView({ k: 'enter' });
        }
        setGame(info.game);
        openSession(DuelSession.online(c), c);
      } catch {
        showToast(t('duel.err.net'));
        setView({ k: 'hub' });
      }
    },
    [openSession],
  );

  // Einladungslink: sofort beitreten.
  const linkUsed = useRef(false);
  useEffect(() => {
    if (initialCode && !linkUsed.current) {
      linkUsed.current = true;
      join(initialCode);
    }
  }, [initialCode, join]);

  const invite = async () => {
    setView({ k: 'busy' });
    try {
      const c = await createRoom(game);
      openSession(DuelSession.online(c), c);
    } catch {
      showToast(t('duel.err.net'));
      setView({ k: 'hub' });
    }
  };

  const random = () => {
    setView({ k: 'queue', since: Date.now() });
    cancelQueue.current = joinQueue(
      game,
      (c) => {
        cancelQueue.current = null;
        openSession(DuelSession.online(c), c);
      },
      () => {
        cancelQueue.current = null;
        showToast(t('duel.err.net'));
        setView({ k: 'hub' });
      },
    );
  };

  const vsAi = () => {
    cancelQueue.current?.();
    cancelQueue.current = null;
    if (!me) return;
    setGame('solitaire');
    openSession(DuelSession.vsComputer(me.pid, me.name), 'KI');
  };

  const share = async (c: string) => {
    const url = inviteLink(c);
    const text = t('duel.shareText', { game: t(game === 'riichi' ? 'duel.gameRiichi' : 'duel.gameSolitaire'), code: c });
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'Mahjong Royale', text, url });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'Mahjong Royale', text, url });
        return;
      }
    } catch {
      return; // abgebrochen
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      showToast(t('duel.copied'));
    } catch {
      showToast(url);
    }
  };

  // Uhr für die Warteschlange
  useEffect(() => {
    if (view.k !== 'queue') return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [view.k]);

  const leave = () => {
    cancelQueue.current?.();
    cancelQueue.current = null;
    if (session) {
      // Läuft ein Duell, gilt Verlassen als Aufgabe — vorher fragen.
      const running = started && !ended;
      if (running && !confirm(t('duel.confirmLeave'))) return;
      session.close(running);
      setSession(null);
      setStarted(false);
      setView({ k: 'hub' });
      return;
    }
    if (view.k !== 'hub') return setView({ k: 'hub' });
    onExit();
  };

  const onCoins = useCallback(
    (won: boolean | null): number => {
      const tab = COINS[game];
      let n = won === true ? tab.win : won === null ? tab.draw : tab.loss;
      if (sessionRef.current?.vsBot) n = Math.floor(n / 2);
      addCoins(n);
      return n;
    },
    [game, addCoins],
  );

  // ---- Spiel läuft --------------------------------------------------------
  if (session && view.k === 'room' && started) {
    const opp = players[1 - session.slot];
    const props = {
      session,
      oppName: opp?.name || '…',
      oppOnline: !!opp?.online,
      onCoins,
      onExit: leave,
    };
    return (
      <>
        {game === 'riichi' ? <DuelRiichi {...props} /> : <DuelSolitaire {...props} />}
        {status === 'reconnecting' && <div className="duel-conn">{t('duel.reconnecting')}</div>}
      </>
    );
  }

  // ---- Warteraum ----------------------------------------------------------
  if (view.k === 'room') {
    return (
      <div className="app screen">
        <ScreenHeader title={t('duel.title')} onBack={leave} />
        <div className="screen-body duel-hub">
          <div className="duel-card">
            <p className="duel-label">{t(game === 'riichi' ? 'duel.gameRiichi' : 'duel.gameSolitaire')}</p>
            <p className="duel-label">{t('duel.codeLabel')}</p>
            <div className="duel-code">{view.code}</div>
            <button className="big-btn" onClick={() => share(view.code)}>{t('duel.share')}</button>
            <p className="duel-note">
              {status === 'open' ? t('duel.waitingFriend') : t('duel.connecting')}
            </p>
            <div className="duel-players">
              {players.map((p, i) => (
                <span key={i} className={p.online ? 'on' : ''}>
                  {p.online ? '●' : '○'} {p.name || '…'}
                  {session && i === session.slot ? ` (${t('duel.you')})` : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Code eingeben ------------------------------------------------------
  if (view.k === 'enter') {
    return (
      <div className="app screen">
        <ScreenHeader title={t('duel.enterCode')} onBack={leave} />
        <div className="screen-body duel-hub">
          <div className="duel-card">
            <p className="duel-label">{t('duel.enterCodeHint')}</p>
            <input
              className="duel-input"
              value={code}
              maxLength={CODE_LEN + 2}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              placeholder="ABC23"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && join(code)}
            />
            <button className="big-btn" onClick={() => join(code)} disabled={!normalizeCode(code)}>
              {t('duel.join')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Warteschlange ------------------------------------------------------
  if (view.k === 'queue') {
    const waited = now - view.since;
    return (
      <div className="app screen">
        <ScreenHeader title={t('duel.random')} onBack={leave} />
        <div className="screen-body duel-hub">
          <div className="duel-card">
            <div className="logo spin">🀄</div>
            <p className="duel-label">{t('duel.searching')}</p>
            <p className="duel-note">{Math.floor(waited / 1000)} s</p>
            {waited >= QUEUE_FALLBACK_MS && (
              <>
                <p className="duel-note">{t('duel.nobody')}</p>
                {game === 'solitaire' ? (
                  <button className="big-btn" onClick={vsAi}>🤖 {t('duel.playAi')}</button>
                ) : (
                  <button
                    className="big-btn"
                    onClick={() => {
                      cancelQueue.current?.();
                      onOpenRiichi();
                    }}
                  >
                    {t('duel.playRiichiAi')}
                  </button>
                )}
                <p className="duel-note">{t('duel.keepWaiting')}</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Menü ----------------------------------------------------------------
  return (
    <div className="app screen">
      <ScreenHeader title={t('duel.title')} onBack={leave} />
      <div className="screen-body duel-hub">
        <div className="segment duel-games">
          <button className={game === 'solitaire' ? 'on' : ''} onClick={() => setGame('solitaire')}>
            {t('duel.gameSolitaire')}
          </button>
          <button className={game === 'riichi' ? 'on' : ''} onClick={() => setGame('riichi')}>
            {t('duel.gameRiichi')}
          </button>
        </div>
        <p className="duel-rules">{t(game === 'riichi' ? 'duel.rulesRiichi' : 'duel.rulesSolitaire')}</p>

        <button className="big-btn" onClick={invite} disabled={view.k === 'busy'}>{t('duel.invite')}</button>
        <button className="big-btn ghost" onClick={() => setView({ k: 'enter' })} disabled={view.k === 'busy'}>
          {t('duel.enterCode')}
        </button>
        <button className="big-btn ghost" onClick={random} disabled={view.k === 'busy'}>{t('duel.random')}</button>
        {game === 'solitaire' && (
          <button className="text-btn" onClick={vsAi} disabled={view.k === 'busy' || !me}>🤖 {t('duel.playAi')}</button>
        )}

        {me && (
          <div className="row duel-name">
            <span>
              <small>{t('duel.yourName')}</small>
              <b>{me.name}</b>
            </span>
            <button className="small-btn" onClick={() => rerollName().then(setMe)}>🎲</button>
          </div>
        )}
      </div>
    </div>
  );
}

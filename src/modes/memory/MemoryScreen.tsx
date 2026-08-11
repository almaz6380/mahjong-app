import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { baueLevel, bedeckt, CH, CW, DXL, DYL, KH, KW } from './board';
import { Tile, TileBack } from '../../ui/Tile';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { playTap, playMatch, playWin, playInvalid } from '../../audio/sound';
import { maybeShowInterstitialModes } from '../../ads/admob';
import { presentFact } from '../../ui/FactHost';
import { showToast } from '../../ui/ToastHost';
import type { ModeProps } from '../types';

// Bildschirm zum Memory-Brett aus `board.ts` (dort steht die Mechanik und
// warum das Raster eine Lücke hat).
export function MemoryScreen({ api, onExit }: ModeProps) {
  // Bestwert = höchstes GESCHAFFTES Level. Der Schlüssel heißt schlicht
  // 'memory' — vorher stand dort `memory-<size>`, während ModesScreen
  // `best('memory')` las; der Bestwert war deshalb dort nie zu sehen.
  const [level, setLevel] = useState(() => (api.bestOf('memory') ?? 0) + 1);
  const [{ cards, shape }, setBoard] = useState(() => baueLevel(level));
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const flipped = useRef<number[]>([]);
  const lock = useRef(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const maxLayer = cards.reduce((m, c) => Math.max(m, c.layer), 0);
  // Maße aus den ECHTEN Kartenpositionen, nicht aus maxCol/maxRow: Bei einer
  // Pyramide ist die obere Ebene eingerückt, ihr Versatz zählt rechts nicht mit.
  // (Dieselbe Falle wie in Board.tsx.)
  const bw = cards.reduce((m, c) => Math.max(m, c.col * CW + c.layer * DXL + KW), 0);
  const bh = cards.reduce((m, c) => Math.max(m, c.row * CH - c.layer * DYL + maxLayer * DYL + KH), 0);

  // Wie im Solitaire-Brett: einpassen statt fester Kartengröße.
  useLayoutEffect(() => {
    const mess = () => {
      const el = wrapRef.current;
      if (!el) return;
      // clientWidth/Height enthalten die Polsterung von `.mode-board` — die
      // gehört nicht zur nutzbaren Fläche, sonst stößt die Figur an den Rand.
      const w = el.clientWidth - 24;
      const h = el.clientHeight - 16;
      setScale(Math.min(1.6, Math.max(0.35, Math.min(w / bw, h / bh))));
    };
    mess();
    window.addEventListener('resize', mess);
    return () => window.removeEventListener('resize', mess);
  }, [bw, bh]);

  const neuesLevel = useCallback((lvl: number) => {
    setLevel(lvl);
    setBoard(baueLevel(lvl));
    setMoves(0);
    setWon(false);
    flipped.current = [];
    lock.current = false;
  }, []);

  const click = useCallback(
    (idx: number) => {
      if (lock.current || won) return;
      const c = cards[idx];
      if (c.up || c.done) return;
      if (bedeckt(c, cards)) return; // liegt etwas drauf
      playTap();
      const nf = [...flipped.current, idx];
      flipped.current = nf;
      setBoard((b) => ({ ...b, cards: b.cards.map((x, i) => (i === idx ? { ...x, up: true } : x)) }));
      if (nf.length < 2) return;

      setMoves((m) => m + 1);
      lock.current = true;
      const [a, b2] = nf;
      // Gepaart wird über die Motiv-ID, NICHT über matchKey: „alle Blumen
      // passen zueinander" wäre in einem Gedächtnisspiel unfair, weil man sich
      // ein bestimmtes Bild merkt.
      const match = cards[a].faceId === cards[b2].faceId;
      setTimeout(() => {
        setBoard((prev) => {
          const next = prev.cards.map((x, i) => (i === a || i === b2 ? { ...x, up: match, done: match } : x));
          if (match && next.every((x) => x.done)) {
            playWin();
            api.addCoins(30 + next.length * 2);
            api.recordModeBest('memory', level, true);
            setWon(true);
            maybeShowInterstitialModes();
          } else if (match) {
            playMatch();
          } else {
            playInvalid();
          }
          return { ...prev, cards: next };
        });
        flipped.current = [];
        lock.current = false;
      }, match ? 300 : 720);
    },
    [cards, won, level, api],
  );

  // Rettungs-Mischen: Liegt unter den ERREICHBAREN Karten kein Paar mehr, ist
  // die Stufe 2 sonst hart festgefahren — anders als im Solitaire gibt es hier
  // keinen Mischen-Knopf.
  const mischen = useCallback(() => {
    setBoard((prev) => {
      const offen = prev.cards.filter((c) => !c.done);
      const ids = offen.map((c) => c.faceId);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      let n = 0;
      const cards = prev.cards.map((c) => (c.done ? c : { ...c, faceId: ids[n++], up: false }));
      return { ...prev, cards };
    });
    flipped.current = [];
    showToast(t('special.shuffle'));
  }, []);

  const frei = useMemo(() => cards.filter((c) => !c.done && !bedeckt(c, cards)), [cards]);
  const steckt = useMemo(() => {
    const gesehen = new Set<string>();
    for (const c of frei) {
      if (gesehen.has(c.faceId)) return false;
      gesehen.add(c.faceId);
    }
    return frei.length > 0;
  }, [frei]);

  return (
    <div className="mode-play">
      <header className="mode-head">
        <button className="icon-btn" onClick={onExit} aria-label="Menü"><Icon name="chevron" /></button>
        <div className="grow">
          <div className="score">{moves}<small>{t('mode.moves')}</small></div>
        </div>
        <div className="score" style={{ textAlign: 'right' }}>
          {t('home.level', { n: level })}<small>{t(`fig.${shape}`)}</small>
        </div>
      </header>

      <div className="mode-board mem-wrap" ref={wrapRef}>
        <div className="mem-figure" style={{ width: bw, height: bh, transform: `scale(${scale})` }}>
          {cards.map((c, i) => {
            const zu = bedeckt(c, cards);
            return (
              <button
                key={c.key}
                className={'mem-cell' + (c.up || c.done ? ' up' : '') + (c.done ? ' done' : '') + (zu ? ' blockiert' : '')}
                style={{
                  left: c.col * CW + c.layer * DXL,
                  top: c.row * CH - c.layer * DYL + maxLayer * DYL,
                  zIndex: c.layer * 1000 + Math.round(c.row * 2) * 10,
                }}
                onClick={() => click(i)}
                aria-label={c.up || c.done ? c.faceId : t('a11y.hidden')}
              >
                <span className="mem-inner">
                  <span className="mem-back"><TileBack /></span>
                  <span className="mem-face"><Tile face={c.faceId} /></span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mode-foot">
        {steckt && <button onClick={mischen}>{t('game.shuffle')}</button>}
        <button onClick={() => neuesLevel(level)}>{t('game.new')}</button>
      </div>

      {won && (
        <div className="overlay">
          <div className="card">
            <div className="logo">🎉</div>
            <h2>{t('mode.won')}</h2>
            <p>{moves} {t('mode.moves')}</p>
            <button className="big-btn" onClick={() => presentFact().then(() => neuesLevel(level + 1))}>
              {t('game.nextLevel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

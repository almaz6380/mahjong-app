// Lawine (Schiebe-Mahjong) — Hub-Spiel wie Connect: eigener Level-Zähler
// (progress.lawineLevel), Booster über payOrWatch (nie stumm Münzen abziehen).
//
// Die Fall-Animation ist eine CSS-Transition auf left/top (Vorbild .merge-cell):
// Steine sind absolut positionierte Buttons mit key = tile.id, nach einem Schlag
// ändert sich nur ihre top-Koordinate. Das Brett steht in GANZZAHLIGEN Pixeln
// und ohne transform:scale()-Elternteil — die iOS-Regel „keine transform-
// Animationen auf Steinen" gilt dem Solitaire-Brett unter gebrochenem Scale
// (CLAUDE.md), genau diese Lage wird hier konstruktiv vermieden.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Tile } from '../../ui/Tile';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { playTap, playMatch, playInvalid, playWin } from '../../audio/sound';
import { maybeShowInterstitialModes } from '../../ads/admob';
import { payOrWatch } from '../../ui/pay';
import { presentFact } from '../../ui/FactHost';
import { makeLevel, canMatch, findAnyPair, removePair, applyGravity, isCleared, shuffleRemaining, clone, type LawineBoard } from './logic';

export interface LawineProps {
  lawineLevel: number;
  coins: number;
  addCoins: (n: number) => void;
  spendCoins: (n: number) => boolean;
  recordLawine: (level: number) => void;
  onExit: () => void;
}

const HINT_COST = 150;
const SHUFFLE_COST = 250;
const POP_MS = 150; // Dauer der Abräum-Animation (muss zu `lawinepop` in styles.css passen)

export function LawineScreen(props: LawineProps) {
  const [level, setLevel] = useState(Math.max(1, props.lawineLevel));
  const [board, setBoard] = useState<LawineBoard>(() => makeLevel(level));
  const [sel, setSel] = useState(-1); // Tile-ID, nicht Zellindex
  const [removing, setRemoving] = useState<[number, number] | null>(null);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<{ stars: number; coins: number } | null>(null);
  const busy = useRef(false);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1400);
  }, []);

  // Zellgröße aus dem verfügbaren Platz, ganzzahlig (Steinformat 3:4).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(40);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const messen = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setCw(Math.max(24, Math.min(56, Math.floor(Math.min(w / board.cols, (h * 3) / (4 * board.rows))))));
    };
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [board.rows, board.cols]);
  const ch = Math.round((cw * 4) / 3);

  // Sieg / Sackgasse nach jeder Brettänderung prüfen (Muster ConnectScreen).
  useEffect(() => {
    if (result) return;
    if (isCleared(board)) {
      const stars = hintsUsed === 0 ? 3 : hintsUsed <= 2 ? 2 : 1;
      const coins = 30 + stars * 15 + level * 4;
      playWin();
      props.addCoins(coins);
      props.recordLawine(level + 1);
      setResult({ stars, coins });
      maybeShowInterstitialModes();
    } else if (!findAnyPair(board)) {
      // Kostenlos: Nur die Motive werden neu verteilt, die Positionen bleiben.
      setBoard((prev) => { const nb = clone(prev); shuffleRemaining(nb); return nb; });
      showToast(t('connect.reshuffled'));
    }
  }, [board]);

  const tap = useCallback(
    (id: number) => {
      if (busy.current || result) return;
      if (sel === -1) { setSel(id); playTap(); return; }
      if (sel === id) { setSel(-1); return; }
      if (!canMatch(board, sel, id)) { playInvalid(); setSel(id); return; }
      // Gültiges Paar: kurz aufploppen lassen, dann entfernen + fallen lassen.
      busy.current = true;
      const a = sel;
      setRemoving([a, id]);
      setSel(-1);
      setHint(null);
      playMatch();
      setTimeout(() => {
        setBoard((prev) => { const nb = clone(prev); removePair(nb, a, id); applyGravity(nb); return nb; });
        setRemoving(null);
        busy.current = false;
      }, POP_MS);
    },
    [board, sel, result],
  );

  const doHint = useCallback(async () => {
    if (busy.current || result) return;
    const pair = findAnyPair(board);
    if (!pair) return;
    const paid = await payOrWatch({ what: t('connect.hint'), cost: HINT_COST, coins: props.coins, spendCoins: props.spendCoins });
    if (!paid) return;
    setHint(pair);
    setHintsUsed((n) => n + 1);
    setTimeout(() => setHint(null), 1100);
  }, [board, result, props]);

  const doShuffle = useCallback(async () => {
    if (busy.current || result) return;
    const paid = await payOrWatch({ what: t('connect.shuffle'), cost: SHUFFLE_COST, coins: props.coins, spendCoins: props.spendCoins });
    if (!paid) return;
    setBoard((prev) => { const nb = clone(prev); shuffleRemaining(nb); return nb; });
    setSel(-1);
  }, [result, props]);

  // „Neu" liefert bewusst dasselbe Brett — die Level sind deterministisch.
  const restart = useCallback((lv: number) => {
    setLevel(lv);
    setBoard(makeLevel(lv));
    setSel(-1);
    setRemoving(null);
    setHint(null);
    setHintsUsed(0);
    setResult(null);
    busy.current = false;
  }, []);

  const { rows, cols, tiles, faceIds } = board;
  const markiert = (id: number, paar: [number, number] | null) => !!paar && (paar[0] === id || paar[1] === id);
  const bg: number[] = Array.from({ length: rows * cols }, (_, i) => i);

  return (
    <div className="mode-play">
      <header className="mode-head">
        <button className="icon-btn" onClick={props.onExit} aria-label={t('common.toMenu')}><Icon name="chevron" /></button>
        <div className="grow"><div className="score">{t('connect.level', { n: level })}</div></div>
        <div className="score" style={{ textAlign: 'right', minWidth: 70 }}>
          <span className="btn-ico" style={{ justifyContent: 'flex-end' }}><Icon name="coin" size={16} /> {props.coins}</span>
        </div>
      </header>

      <div className="mode-board">
        <div className="lawine-wrap" ref={wrapRef}>
          <div className="lawine-grid" style={{ width: cols * cw, height: rows * ch }}>
            {bg.map((i) => (
              <div key={i} className="lawine-bg" style={{ left: (i % cols) * cw, top: ((i / cols) | 0) * ch, width: cw, height: ch }} />
            ))}
            {tiles.map((tl) => (
              <button
                key={tl.id}
                className={
                  'lawine-tile' +
                  (sel === tl.id ? ' sel' : '') +
                  (markiert(tl.id, hint) ? ' hint' : '') +
                  (markiert(tl.id, removing) ? ' removing' : '')
                }
                style={{ left: tl.c * cw, top: tl.r * ch, width: cw, height: ch }}
                onClick={() => tap(tl.id)}
              >
                <Tile face={faceIds[tl.face]} />
              </button>
            ))}
            {toast && <div className="lawine-toast">{toast}</div>}
          </div>
        </div>
      </div>

      <div className="mode-foot">
        <button onClick={doHint} disabled={!!result}>
          <span className="btn-ico"><Icon name="bulb" size={15} /> {t('connect.hint')} · {HINT_COST}</span>
        </button>
        <button onClick={doShuffle} disabled={!!result}>
          <span className="btn-ico"><Icon name="refresh" size={15} /> {t('connect.shuffle')} · {SHUFFLE_COST}</span>
        </button>
        <button onClick={() => restart(level)}>{t('game.new')}</button>
      </div>

      {result && (
        <div className="overlay">
          <div className="card">
            <div className="stars">
              {[1, 2, 3].map((s) => (
                <span key={s} className={s <= result.stars ? 'star on' : 'star'}>★</span>
              ))}
            </div>
            <h2>{t('connect.cleared')}</h2>
            <p className="coins-won"><Icon name="coin" size={24} /> +{result.coins}</p>
            {/* Fakten-Karte VOR dem Levelaufbau — sonst blitzt die alte Sieg-Karte auf (CLAUDE.md, FactHost). */}
            <button className="big-btn" onClick={() => presentFact().then(() => restart(level + 1))}>{t('connect.next')}</button>
            <button className="text-btn" onClick={props.onExit}>{t('common.toMenu')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Tile } from '../../ui/Tile';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { playTap, playMatch, playInvalid, playWin } from '../../audio/sound';
import { maybeShowInterstitialModes } from '../../ads/admob';
import { payOrWatch } from '../../ui/pay';
import { presentFact } from '../../ui/FactHost';
import { buildDeck } from '../../game/tiles';
import { connectConfig } from './levels';
import { makeBoard, canConnect, findAnyPair, removePair, isCleared, shuffleRemaining, EMPTY, type Board } from './connect';

// Steinsorten für Connect – nach Gruppen im Wechsel (visuell vielfältig, bunte
// Sorten zuerst), damit kleine Bretter nicht nur aus fast gleichen „Kronen" bestehen.
const DISTINCT: string[] = (() => {
  const groups = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const f of buildDeck()) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    (groups.get(f.group) ?? groups.set(f.group, []).get(f.group)!).push(f.id);
  }
  const order = ['cir', 'bam', 'dragon', 'wind', 'flower', 'char', 'season'];
  const lists = order.filter((g) => groups.has(g)).map((g) => groups.get(g)!);
  const out: string[] = [];
  for (let i = 0; out.length < seen.size; i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
})();

export interface ConnectProps {
  connectLevel: number;
  coins: number;
  addCoins: (n: number) => void;
  spendCoins: (n: number) => boolean;
  recordConnect: (level: number) => void;
  onExit: () => void;
}

const HINT_COST = 40;
const SHUFFLE_COST = 60;

function build(level: number): Board {
  const cfg = connectConfig(level);
  return makeBoard(cfg.rows, cfg.cols, DISTINCT.slice(0, cfg.faces));
}

export function ConnectScreen(props: ConnectProps) {
  const [level, setLevel] = useState(Math.max(1, props.connectLevel));
  const [board, setBoard] = useState<Board>(() => build(level));
  const [sel, setSel] = useState(-1);
  const [path, setPath] = useState<number[] | null>(null);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<{ stars: number; coins: number } | null>(null);
  const busy = useRef(false);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1400);
  }, []);

  // Sieg / Deadlock nach jeder Brettänderung prüfen.
  useEffect(() => {
    if (result) return;
    if (isCleared(board)) {
      const stars = hintsUsed === 0 ? 3 : hintsUsed <= 2 ? 2 : 1;
      const coins = 30 + stars * 15 + level * 4;
      playWin();
      props.addCoins(coins);
      props.recordConnect(level + 1);
      setResult({ stars, coins });
      maybeShowInterstitialModes();
    } else if (!findAnyPair(board)) {
      setBoard((prev) => { const nb = { ...prev, g: prev.g.slice() }; shuffleRemaining(nb); return nb; });
      showToast(t('connect.reshuffled'));
    }
  }, [board]);

  const tap = useCallback(
    (i: number) => {
      if (busy.current || result) return;
      if (board.g[i] === EMPTY) return;
      if (sel === -1) { setSel(i); playTap(); return; }
      if (sel === i) { setSel(-1); return; }
      const p = canConnect(board, sel, i);
      if (!p) { playInvalid(); setSel(i); return; }
      // Gültige Verbindung: Pfad animieren, dann Paar entfernen.
      busy.current = true;
      const a = sel;
      setPath(p);
      setSel(-1);
      setHint(null);
      playMatch();
      setTimeout(() => {
        setBoard((prev) => { const nb = { ...prev, g: prev.g.slice() }; removePair(nb, a, i); return nb; });
        setPath(null);
        busy.current = false;
      }, 260);
    },
    [board, sel, result],
  );

  const doHint = useCallback(async () => {
    if (busy.current || result) return;
    const pair = findAnyPair(board);
    if (!pair) return;
    const paid = await payOrWatch({ what: t('mode.hint'), cost: HINT_COST, coins: props.coins, spendCoins: props.spendCoins });
    if (!paid) return;
    setHint(pair);
    setHintsUsed((n) => n + 1);
    setTimeout(() => setHint(null), 1100);
  }, [board, result, props]);

  const doShuffle = useCallback(async () => {
    if (busy.current || result) return;
    const paid = await payOrWatch({ what: t('game.shuffle'), cost: SHUFFLE_COST, coins: props.coins, spendCoins: props.spendCoins });
    if (!paid) return;
    setBoard((prev) => { const nb = { ...prev, g: prev.g.slice() }; shuffleRemaining(nb); return nb; });
    setSel(-1);
  }, [result, props]);

  const restart = useCallback((lv: number) => {
    setLevel(lv);
    setBoard(build(lv));
    setSel(-1);
    setPath(null);
    setHint(null);
    setHintsUsed(0);
    setResult(null);
    busy.current = false;
  }, []);

  const { W, H, g, faceIds } = board;
  // SVG-Pfadpunkte (Zellenmitten in gepolsterten Koordinaten).
  const pts = path
    ? path.map((idx) => `${(idx % W) + 0.5},${((idx / W) | 0) + 0.5}`).join(' ')
    : '';

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
        <div className="connect-wrap" style={{ width: `min(96vw, ${W * 46}px)` }}>
          <div className="connect-grid" style={{ gridTemplateColumns: `repeat(${W}, 1fr)` }}>
            {g.map((v, i) => (
              <div key={i} className="connect-cell">
                {v !== EMPTY && (
                  <button
                    className={'connect-tile' + (sel === i ? ' sel' : '') + (hint && (hint[0] === i || hint[1] === i) ? ' hint' : '')}
                    onClick={() => tap(i)}
                  >
                    <Tile face={faceIds[v]} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {path && (
            <svg className="connect-path" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
              <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          {toast && <div className="connect-toast">{toast}</div>}
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
            <button className="big-btn" onClick={() => presentFact().then(() => restart(level + 1))}>{t('connect.next')}</button>
            <button className="text-btn" onClick={props.onExit}>{t('common.toMenu')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

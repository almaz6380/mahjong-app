import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';
import { t } from '../../i18n';
import { playTap, playMatch, playInvalid, playWin } from '../../audio/sound';
import { maybeShowInterstitialModes, showRewarded } from '../../ads/admob';
import { COLS } from './logic';
import { LEVELS, levelDef, type Goal } from './levels';
import {
  makeLevel, applyMove, shuffleBoard, validSwap, goalProgress, starsFor,
  DRAGON, BLOCKED, LINE, type CrushState,
} from './crush';

// Farbige Match-3-Gems: je Sorte eigene Form + Farbe + Glanz (statt Mahjong-Stein).
const GEM_COLORS = ['#e6392f', '#22c55e', '#2f7ff2', '#a855f7', '#f5a623', '#ec4899'];

function gemShape(v: number): React.ReactNode {
  switch (v) {
    case 0: // Raute (rot)
      return <polygon points="30,5 55,30 30,55 5,30" />;
    case 1: { // Sechseck (grün)
      const p = [0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a - 90) * Math.PI / 180;
        return `${30 + Math.cos(r) * 25},${30 + Math.sin(r) * 25}`;
      }).join(' ');
      return <polygon points={p} />;
    }
    case 2: // Kreis (blau)
      return <circle cx="30" cy="30" r="24" />;
    case 3: // Drachen/Kite (violett)
      return <polygon points="30,4 52,26 30,56 8,26" />;
    case 4: // Achteck (amber)
      return <polygon points="19,6 41,6 54,19 54,41 41,54 19,54 6,41 6,19" />;
    default: { // Blüte (pink)
      const petals = [0, 72, 144, 216, 288].map((a) => {
        const r = a * Math.PI / 180;
        return `${30 + Math.cos(r) * 24},${30 + Math.sin(r) * 24}`;
      }).join(' ');
      return <polygon points={petals} />;
    }
  }
}

function CrushGem({ v }: { v: number }) {
  const c = GEM_COLORS[v] ?? GEM_COLORS[0];
  return (
    <svg className="tileface crush-gem" viewBox="0 0 60 60" preserveAspectRatio="xMidYMid meet" style={{ filter: `drop-shadow(0 1px 2px ${c}aa)` }}>
      <g fill={c} stroke="rgba(0,0,0,.35)" strokeWidth="1.4" strokeLinejoin="round">
        {gemShape(v)}
      </g>
      <g fill="#fff" stroke="none">
        <ellipse cx="23" cy="20" rx="7" ry="4" opacity="0.55" transform="rotate(-30 23 20)" />
        <circle cx="38" cy="38" r="2.2" opacity="0.5" />
      </g>
    </svg>
  );
}

export interface CrushProps {
  crush: Record<number, number>; // Level -> Sterne
  addCoins: (n: number) => void;
  spendCoins: (n: number) => boolean;
  coins: number;
  recordCrush: (levelId: number, stars: number, coins: number) => void;
  onExit: () => void;
}

const SHUFFLE_COST = 60;

function goalLabel(g: Goal): string {
  if (g.kind === 'score') return t('crush.goalScore', { n: g.target });
  if (g.kind === 'collect') return t('crush.goalCollect', { n: g.target, tile: t('crush.tileWord') });
  return t('crush.goalBlocks');
}

// --- Ein einzelnes Feld ------------------------------------------------------
function Cell({ v, spec, armor, sel, onClick }: { v: number; spec: number; armor: number; sel: boolean; onClick: () => void }) {
  let inner;
  if (armor > 0 || v === BLOCKED) {
    inner = <span className={'crush-block' + (armor >= 2 ? ' armor2' : '')}>❖</span>;
  } else if (v === DRAGON) {
    inner = <span className="crush-dragon">🐉</span>;
  } else {
    inner = <CrushGem v={v} />;
  }
  return (
    <button
      className={'m3-cell' + (sel ? ' sel' : '') + (spec === LINE ? ' crush-line' : '')}
      onClick={onClick}
      disabled={armor > 0}
    >
      {inner}
      {spec === LINE && <span className="crush-spark">✦</span>}
    </button>
  );
}

// --- Spielbildschirm für ein Level -------------------------------------------
function CrushPlay({ levelId, props, onDone }: { levelId: number; props: CrushProps; onDone: () => void }) {
  const def = useMemo(() => levelDef(levelId), [levelId]);
  const [st, setSt] = useState<CrushState>(() => makeLevel(def));
  const [sel, setSel] = useState(-1);
  const [result, setResult] = useState<{ win: boolean; stars: number; coins: number } | null>(null);

  const finish = useCallback(
    (state: CrushState) => {
      if (state.status === 'win') {
        const stars = starsFor(def, state.movesLeft);
        const coins = 30 + stars * 15 + Math.floor(state.score / 200);
        playWin();
        props.recordCrush(levelId, stars, coins);
        setResult({ win: true, stars, coins });
      } else {
        setResult({ win: false, stars: 0, coins: 0 });
      }
      maybeShowInterstitialModes();
    },
    [def, levelId, props],
  );

  const tap = useCallback(
    (i: number) => {
      if (st.status !== 'play' || result) return;
      if (sel === -1) { setSel(i); playTap(); return; }
      if (sel === i) { setSel(-1); return; }
      if (!validSwap(st, sel, i)) { playInvalid(); setSel(i); return; }
      const { st: next } = applyMove(st, sel, i);
      playMatch();
      setSel(-1);
      setSt(next);
      if (next.status !== 'play') finish(next);
    },
    [st, sel, result, finish],
  );

  const shuffle = () => {
    if (st.status !== 'play') return;
    if (!props.spendCoins(SHUFFLE_COST)) return;
    setSt(shuffleBoard(st));
    setSel(-1);
  };

  const extraMoves = async () => {
    const ok = await showRewarded();
    if (ok) { setSt({ ...st, movesLeft: st.movesLeft + 5, status: 'play' }); setResult(null); }
  };

  const restart = () => { setSt(makeLevel(def)); setSel(-1); setResult(null); };

  return (
    <div className="mode-play">
      <header className="mode-head">
        <button className="icon-btn" onClick={onDone} aria-label={t('common.toMenu')}><Icon name="chevron" /></button>
        <div className="grow"><div className="score">{t('crush.level', { n: levelId })}</div></div>
        <div className="score" style={{ textAlign: 'right', minWidth: 64 }}>{st.movesLeft}<small>{t('mode.moves')}</small></div>
      </header>

      <div className="crush-goals">
        {def.goals.map((g, i) => {
          const p = goalProgress(st, g);
          const done = p.have >= p.target;
          return (
            <span key={i} className={'crush-goal' + (done ? ' done' : '')}>
              {done ? '✓ ' : ''}{goalLabel(g)} <b>{p.have}/{p.target}</b>
            </span>
          );
        })}
      </div>

      <div className="mode-board">
        <div className="m3-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, width: `min(94vw, ${COLS * 52}px)` }}>
          {st.g.map((v, i) => (
            <Cell key={i} v={v} spec={st.spec[i]} armor={st.armor[i]} sel={sel === i} onClick={() => tap(i)} />
          ))}
        </div>
      </div>

      <div className="mode-foot">
        <button onClick={shuffle} disabled={props.coins < SHUFFLE_COST}>
          <span className="btn-ico"><Icon name="coin" size={15} /> {t('crush.shuffle')} · {SHUFFLE_COST}</span>
        </button>
        <button onClick={restart}>{t('game.new')}</button>
      </div>

      {result && (
        <div className="overlay">
          <div className="card">
            {result.win ? (
              <>
                <div className="stars">
                  {[1, 2, 3].map((s) => (
                    <span key={s} className={s <= result.stars ? 'star on' : 'star'}>★</span>
                  ))}
                </div>
                <h2>{t('crush.cleared')}</h2>
                <p className="coins-won"><Icon name="coin" size={24} /> +{result.coins}</p>
                {levelId < LEVELS.length ? (
                  <button className="big-btn" onClick={onDone}>{t('crush.next')}</button>
                ) : (
                  <button className="big-btn" onClick={onDone}>{t('common.toMenu')}</button>
                )}
                <button className="text-btn" onClick={restart}>{t('mode.again')}</button>
              </>
            ) : (
              <>
                <div className="logo">💔</div>
                <h2>{t('crush.failed')}</h2>
                <p>{t('crush.outOfMoves')}</p>
                <button className="big-btn ghost solid" onClick={extraMoves}>
                  <span className="btn-ico"><Icon name="video" size={16} /> +5 {t('mode.moves')}</span>
                </button>
                <button className="big-btn" onClick={restart}>{t('mode.again')}</button>
                <button className="text-btn" onClick={onDone}>{t('common.toMenu')}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Level-Karte (geschwungener Pfad) ----------------------------------------
// Knoten liegen auf einer Serpentine; eine gepunktete Linie verbindet sie.
// Positionen und Linie werden aus demselben Lane-Muster berechnet.
const LANES = [50, 22, 50, 78]; // horizontale Prozent-Spuren, zyklisch
const ROW_H = 118; // vertikaler Abstand pro Level in px
const TOP_PAD = 40;

function laneX(id: number): number {
  return LANES[(id - 1) % LANES.length];
}
function nodeY(id: number, total: number): number {
  // Level 1 unten, höchstes oben.
  return TOP_PAD + (total - id) * ROW_H;
}

function CrushMap({ props, onPick }: { props: CrushProps; onPick: (id: number) => void }) {
  const stars = props.crush;
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
  let unlocked = 1;
  while (unlocked <= LEVELS.length && (stars[unlocked] ?? 0) > 0) unlocked++;

  const total = LEVELS.length;
  const mapH = TOP_PAD * 2 + total * ROW_H;
  // Pfadpunkte (in %-x, px-y) von Level 1 (unten) nach oben.
  const pts = LEVELS.map((lv) => `${laneX(lv.id)},${nodeY(lv.id, total)}`).join(' ');

  // Beim Öffnen zum aktuellen Level scrollen.
  const currentRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <div className="app screen">
      <header className="hud">
        <button className="icon-btn" onClick={props.onExit} aria-label={t('common.toMenu')}><Icon name="chevron" /></button>
        <div className="hud-center"><div className="level">{t('crush.title')}</div></div>
        <div className="menu-stats" style={{ margin: 0 }}><span className="crush-star-count">★ {totalStars}</span></div>
      </header>
      <div className="screen-body crush-map-scroll">
        <div className="crush-map" style={{ height: mapH }}>
          <svg className="crush-path" width="100%" height={mapH} viewBox={`0 0 100 ${mapH}`} preserveAspectRatio="none" aria-hidden>
            <polyline points={pts} fill="none" stroke="rgba(245,179,1,0.5)" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 9" vectorEffect="non-scaling-stroke" />
          </svg>
          {LEVELS.map((lv) => {
            const s = stars[lv.id] ?? 0;
            const locked = lv.id > unlocked;
            const isCurrent = lv.id === unlocked;
            return (
              <button
                key={lv.id}
                ref={isCurrent ? currentRef : undefined}
                className={'crush-node' + (locked ? ' locked' : isCurrent ? ' current' : ' cleared')}
                onClick={() => !locked && onPick(lv.id)}
                disabled={locked}
                style={{ left: `${laneX(lv.id)}%`, top: nodeY(lv.id, total) }}
              >
                <span className="crush-num">{locked ? '🔒' : lv.id}</span>
                {!locked && (
                  <span className="crush-node-stars">
                    {[1, 2, 3].map((n) => (
                      <span key={n} className={n <= s ? 'on' : ''}>★</span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Container ---------------------------------------------------------------
export function CrushScreen(props: CrushProps) {
  const [playing, setPlaying] = useState<number | null>(null);
  if (playing === null) return <CrushMap props={props} onPick={setPlaying} />;
  return (
    <CrushPlay
      key={playing}
      levelId={playing}
      props={props}
      onDone={() => setPlaying(null)}
    />
  );
}

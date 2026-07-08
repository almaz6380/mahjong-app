import { useCallback, useMemo, useState } from 'react';
import { Tile } from '../../ui/Tile';
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

const FACES = ['z5', 'z6', 's1', 'p1', 'm1', 'flower1'];

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
    inner = <Tile face={FACES[v] ?? 'm1'} />;
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

// --- Level-Karte -------------------------------------------------------------
function CrushMap({ props, onPick }: { props: CrushProps; onPick: (id: number) => void }) {
  const stars = props.crush;
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
  // Höchstes freigeschaltetes Level = erstes ungelöstes (alle vorher bestanden).
  let unlocked = 1;
  while (unlocked <= LEVELS.length && (stars[unlocked] ?? 0) > 0) unlocked++;

  return (
    <div className="app screen">
      <header className="hud">
        <button className="icon-btn" onClick={props.onExit} aria-label={t('common.toMenu')}><Icon name="chevron" /></button>
        <div className="hud-center"><div className="level">{t('crush.title')}</div></div>
        <div className="menu-stats" style={{ margin: 0 }}><span className="crush-star-count">★ {totalStars}</span></div>
      </header>
      <div className="screen-body">
        <div className="crush-map">
          {LEVELS.map((lv) => {
            const s = stars[lv.id] ?? 0;
            const locked = lv.id > unlocked;
            return (
              <button
                key={lv.id}
                className={'crush-node' + (locked ? ' locked' : s > 0 ? ' cleared' : ' current')}
                onClick={() => !locked && onPick(lv.id)}
                disabled={locked}
                style={{ alignSelf: lv.id % 4 < 2 ? 'flex-start' : 'flex-end' }}
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

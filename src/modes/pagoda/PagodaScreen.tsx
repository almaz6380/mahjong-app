import { useEffect, useMemo, useRef, useState } from 'react';
import { FigureRound } from '../../ui/FigureRound';
import { WinCeremony } from '../../ui/WinCeremony';
import { Icon } from '../../ui/Icon';
import { allFigures } from '../../game/figures';
import { t } from '../../i18n';

// Pagoden-Aufstieg: 100 Etagen, jede Etage eine Generator-Figur (unten klein,
// oben groß). Alle 10 Etagen wartet ein Meilenstein-Bonus, Etage 100 die Krone.

export const PAGODA_FLOORS = 100;
export const FLOOR_COINS = 30;
export const MILESTONE_COINS = 100;
export const TOP_COINS = 1000;

export function pagodaFigure(floor: number) {
  const figs = allFigures();
  const idx = Math.round(((floor - 1) / (PAGODA_FLOORS - 1)) * (figs.length - 1));
  return figs[Math.min(figs.length - 1, Math.max(0, idx))];
}

export const isMilestone = (floor: number) => floor % 10 === 0;

interface Props {
  floor: number; // aktuelle (höchste offene) Etage aus progress.pagodaFloor
  addCoins: (n: number) => void;
  spendCoins: (n: number) => boolean;
  recordPagoda: (floor: number) => void;
  onExit: () => void;
}

export function PagodaScreen({ floor, addCoins, spendCoins, recordPagoda, onExit }: Props) {
  const [playing, setPlaying] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [reward, setReward] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const done = floor > PAGODA_FLOORS;

  // Turm-Karte: Etage 100 oben, 1 unten; automatisch zur aktuellen scrollen.
  const floors = useMemo(() => Array.from({ length: PAGODA_FLOORS }, (_, i) => PAGODA_FLOORS - i), []);
  useEffect(() => {
    if (playing !== null) return;
    const el = listRef.current?.querySelector('.pagoda-floor.current');
    el?.scrollIntoView({ block: 'center' });
  }, [playing]);

  if (playing !== null) {
    const fig = pagodaFigure(playing);
    const flr = playing;
    return (
      <FigureRound
        key={`${flr}-${round}`}
        layoutName={fig.name}
        title={
          <>
            <span className="hanko-chip">{flr}</span>
            {t('pagoda.floor')}
          </>
        }
        sub={t(fig.label)}
        spendCoins={spendCoins}
        onWin={() => {
          // Volle Belohnung nur beim ERSTEN Abschluss der Etage (kein Farmen).
          const first = flr >= floor;
          const coins = first
            ? FLOOR_COINS + (flr === PAGODA_FLOORS ? TOP_COINS : isMilestone(flr) ? MILESTONE_COINS : 0)
            : 10;
          setReward(coins);
          addCoins(coins);
          recordPagoda(flr + 1);
        }}
        renderWin={() => (
          <div className="card">
            <WinCeremony level={flr} />
            <h2>{flr === PAGODA_FLOORS ? t('pagoda.top') : t('pagoda.cleared', { n: flr })}</h2>
            <p className="coins-won">
              <Icon name="coin" size={24} /> +{reward}
            </p>
            {flr < PAGODA_FLOORS ? (
              <button
                className="big-btn"
                onClick={() => {
                  setPlaying(flr + 1);
                  setRound((r) => r + 1);
                }}
              >
                {t('pagoda.nextFloor')}
              </button>
            ) : null}
            <button className="text-btn" onClick={() => setPlaying(null)}>
              {t('pagoda.toTower')}
            </button>
          </div>
        )}
        onExit={() => setPlaying(null)}
      />
    );
  }

  return (
    <div className="app screen">
      <header className="hud">
        <button className="icon-btn" onClick={onExit} aria-label={t('common.toMenu')}>
          <Icon name="chevron" />
        </button>
        <div className="hud-center">
          <div className="level">{t('pagoda.title')}</div>
          <div className="sub">{done ? t('pagoda.allDone') : t('pagoda.progress', { n: Math.min(floor, PAGODA_FLOORS) })}</div>
        </div>
        <div style={{ width: 40 }} />
      </header>
      <div className="screen-body pagoda-body" ref={listRef}>
        <div className="pagoda-roof" aria-hidden>
          <svg viewBox="0 0 200 56">
            <path d="M100 4 Q160 18 196 50 Q148 34 100 34 Q52 34 4 50 Q40 18 100 4 Z" fill="#a52a1d" stroke="rgba(0,0,0,.3)" />
            <circle cx="100" cy="8" r="5" fill="#e6b74a" />
          </svg>
        </div>
        <div className="pagoda-tower">
          {floors.map((f) => {
            const state = f < floor ? 'done' : f === floor && !done ? 'current' : 'locked';
            return (
              <button
                key={f}
                className={`pagoda-floor ${state}${isMilestone(f) ? ' milestone' : ''}`}
                disabled={state === 'locked'}
                onClick={() => state !== 'locked' && setPlaying(f)}
              >
                <span className="pf-num">{f}</span>
                <span className="pf-label">
                  {state === 'done' ? '✓' : t(pagodaFigure(f).label)}
                  {isMilestone(f) && (
                    <span className="pf-bonus">
                      <Icon name="coin" size={13} /> {f === PAGODA_FLOORS ? TOP_COINS : MILESTONE_COINS}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

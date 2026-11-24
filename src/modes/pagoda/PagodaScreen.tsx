import { useEffect, useMemo, useRef, useState } from 'react';
import { FigureRound } from '../../ui/FigureRound';
import { WinCeremony } from '../../ui/WinCeremony';
import { Icon } from '../../ui/Icon';
import { allFigures } from '../../game/figures';
import { t } from '../../i18n';

// Pagoden-Aufstieg: 300 Etagen (bis 1.6: 100), jede Etage eine Generator-Figur.
// Alle 10 Etagen wartet ein Meilenstein-Bonus, auf 100, 200 und 300 eine Krone.
//
// Etage 1–100 bleiben EXAKT wie bis 1.6 (Rampe über alle Figuren, leicht → schwer),
// damit kein laufender Aufstieg sein Brett wechselt. Etage 101–300 sind ein
// zweiter Abschnitt: Er beginnt bei 60 % der Figuren-Rampe und steigt wieder bis
// zur schwersten Figur — schwerer geht es ohne Generator-Änderung nicht (die
// Bretter sind auf 8×9 gedeckelt, damit die Steine groß bleiben). Figuren aus
// Etage 1–100 werden dabei übersprungen, damit sich kein Brett wiederholt.
// Münzen laufen weiter über bonusCoins (Tagesdeckel) im Aufrufer.

export const LEGACY_FLOORS = 100;
export const PAGODA_FLOORS = 300;
export const FLOOR_COINS = 30;
export const MILESTONE_COINS = 100;
export const TOP_COINS = 1000;
const SECOND_START = 0.6;

let legacyIdx: Set<number> | null = null;
const legacyIndex = (floor: number, len: number) =>
  Math.min(len - 1, Math.max(0, Math.round(((floor - 1) / (LEGACY_FLOORS - 1)) * (len - 1))));

export function pagodaFigure(floor: number) {
  const figs = allFigures();
  const len = figs.length;
  if (floor <= LEGACY_FLOORS) return figs[legacyIndex(floor, len)];
  if (!legacyIdx) legacyIdx = new Set(Array.from({ length: LEGACY_FLOORS }, (_, i) => legacyIndex(i + 1, len)));
  const start = Math.floor(len * SECOND_START);
  const span = PAGODA_FLOORS - LEGACY_FLOORS - 1;
  let idx = Math.round(start + ((Math.min(floor, PAGODA_FLOORS) - LEGACY_FLOORS - 1) / span) * (len - 1 - start));
  // Bereits benutzte Figur überspringen: erst nach unten, an der Spitze nach oben ausweichen.
  for (let d = 0; d < len && legacyIdx.has(idx); d++) idx = idx > start ? idx - 1 : idx + 1;
  return figs[Math.min(len - 1, Math.max(0, idx))];
}

export const isMilestone = (floor: number) => floor % 10 === 0;
export const isCrown = (floor: number) => floor % 100 === 0;

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

  // Turm-Karte: Etage 300 oben, 1 unten; automatisch zur aktuellen scrollen.
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
            ? FLOOR_COINS + (isCrown(flr) ? TOP_COINS : isMilestone(flr) ? MILESTONE_COINS : 0)
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
          <div className="sub">{done ? t('pagoda.allDone') : t('pagoda.progress', { n: Math.min(floor, PAGODA_FLOORS), max: PAGODA_FLOORS })}</div>
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
                      <Icon name="coin" size={13} /> {isCrown(f) ? TOP_COINS : MILESTONE_COINS}
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

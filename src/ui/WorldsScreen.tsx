import { useMemo } from 'react';
import { Icon } from './Icon';
import { showToast } from './ToastHost';
import { t } from '../i18n';
import type { Progress } from '../game/progress';
import { allWorlds, worldChests, worldIndexOf, type ChestInfo } from '../game/worlds';
import { MEISTER_AB } from '../game/meister';

// Welten-Übersicht (seit 1.7.0): 20 Welten à 50 Level + Meister-Bereich.
// Reine Anzeige plus Sterne-Truhen; gespielt wird weiter über „Spielen“.
// Bewusst keine Bewegung auf den Karten — nur Farbe/Rahmen (iOS-Regeln).

interface Props {
  progress: Progress;
  claimWorldChest: (id: string) => number;
  onBack: () => void;
}

const CHEST_LABEL: Record<ChestInfo['tier'], string> = {
  half: 'worlds.chest.stars',
  clear: 'worlds.chest.clear',
  most: 'worlds.chest.stars',
};

export function WorldsScreen({ progress, claimWorldChest, onBack }: Props) {
  const worlds = useMemo(() => allWorlds(progress.bestStars, progress.level), [progress.bestStars, progress.level]);
  const current = worldIndexOf(progress.level);
  const meisterDone = Object.keys(progress.bestStars).filter((k) => Number(k) >= MEISTER_AB).length;

  const open = (c: ChestInfo) => {
    const coins = claimWorldChest(c.id);
    if (coins > 0) showToast(t('worlds.opened', { n: coins }));
  };

  return (
    <div className="app screen">
      <header className="hud">
        <button className="icon-btn" onClick={onBack} aria-label={t('common.toMenu')}>
          <Icon name="chevron" />
        </button>
        <div className="hud-center">
          <div className="level">{t('worlds.title')}</div>
          <div className="sub">{t('worlds.sub', { n: worlds.filter((w) => w.complete).length, max: worlds.length })}</div>
        </div>
        <div style={{ width: 40 }} />
      </header>
      <div className="screen-body">
        <div className="world-list">
          {worlds.map((w) => {
            const chests = worldChests(w, progress.worldChests);
            const pct = Math.round((w.stars / w.maxStars) * 100);
            return (
              <div
                key={w.id}
                className={'world-card' + (w.unlocked ? '' : ' locked') + (w.index === current ? ' current' : '') + (w.complete ? ' complete' : '')}
              >
                <div className="world-head">
                  <span className="hanko-chip">{w.index + 1}</span>
                  <span className="world-name">
                    {w.unlocked ? t(`world.${w.id}`) : '🔒 ' + t(`world.${w.id}`)}
                    <small>{t('worlds.levels', { from: w.from, to: w.to })}</small>
                  </span>
                  <span className="world-stars">★ {w.stars}/{w.maxStars}</span>
                </div>
                <div className="album-meter">
                  <div className="album-meter-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="world-chests">
                  {chests.map((c) => (
                    <button
                      key={c.id}
                      className={'world-chest' + (c.claimed ? ' claimed' : c.reached ? ' ready' : '')}
                      disabled={!c.reached || c.claimed}
                      onClick={() => open(c)}
                    >
                      <span className="wc-ico">{c.claimed ? '✓' : c.reached ? '🎁' : '🧰'}</span>
                      <span className="wc-tx">
                        {t(CHEST_LABEL[c.tier], { n: c.need })}
                        <small>
                          <Icon name="coin" size={12} /> {c.coins}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div className={'world-card meister' + (current === null ? ' current' : '') + (progress.level >= MEISTER_AB ? '' : ' locked')}>
            <div className="world-head">
              <span className="hanko-chip">👑</span>
              <span className="world-name">
                {t('world.meister')}
                <small>{t('worlds.meisterSub', { n: MEISTER_AB })}</small>
              </span>
              <span className="world-stars">{t('worlds.meisterDone', { n: meisterDone })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

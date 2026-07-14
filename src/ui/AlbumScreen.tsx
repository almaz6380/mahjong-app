import { Icon } from './Icon';
import { Tile } from './Tile';
import { t } from '../i18n';
import type { Progress } from '../game/progress';

// Mythen-Album: gesammelte Mythen- & Schätze-Paare mit kleinen Texten zur
// asiatischen Symbolik. Ein Eintrag ist komplett, sobald GOAL Paare des
// Steins entfernt wurden; dann wartet eine einmalige Belohnung.

export const ALBUM_GOAL = 4; // Paare pro Eintrag bis „komplett"
export const ALBUM_REWARD = 150;

export const ALBUM_IDS = [
  'myth1', 'myth2', 'myth3', 'myth4',
  'treasure1', 'treasure2', 'treasure3', 'treasure4',
] as const;

interface Props {
  progress: Progress;
  claimAlbum: (id: string, reward: number) => boolean;
  onBack: () => void;
}

export function AlbumScreen({ progress, claimAlbum, onBack }: Props) {
  const doneCount = ALBUM_IDS.filter((id) => (progress.album[id] ?? 0) >= ALBUM_GOAL).length;
  return (
    <div className="app screen">
      <header className="hud">
        <button className="icon-btn" onClick={onBack} aria-label={t('common.toMenu')}>
          <Icon name="chevron" />
        </button>
        <div className="hud-center">
          <div className="level">{t('album.title')}</div>
          <div className="sub">{t('album.progress', { n: doneCount, max: ALBUM_IDS.length })}</div>
        </div>
        <div style={{ width: 40 }} />
      </header>
      <div className="screen-body">
        <p className="album-hint">{t('album.hint')}</p>
        <div className="album-grid">
          {ALBUM_IDS.map((id) => {
            const n = Math.min(progress.album[id] ?? 0, ALBUM_GOAL);
            const complete = n >= ALBUM_GOAL;
            const claimed = progress.albumClaimed.includes(id);
            const discovered = n > 0;
            return (
              <div key={id} className={'album-card' + (complete ? ' complete' : '')}>
                <div className={'album-tile' + (discovered ? '' : ' unknown')}>
                  <Tile face={id} />
                </div>
                <div className="album-info">
                  <div className="album-name">{t(`album.${id}`)}</div>
                  <div className="album-text">{discovered ? t(`album.${id}.text`) : t('album.locked')}</div>
                  <div className="album-meter">
                    <div className="album-meter-fill" style={{ width: `${(n / ALBUM_GOAL) * 100}%` }} />
                  </div>
                  <div className="album-count">
                    {t('album.pairs', { n, max: ALBUM_GOAL })}
                    {complete && !claimed && (
                      <button className="album-claim" onClick={() => claimAlbum(id, ALBUM_REWARD)}>
                        <Icon name="coin" size={14} /> +{ALBUM_REWARD}
                      </button>
                    )}
                    {claimed && <span className="album-claimed">✓</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

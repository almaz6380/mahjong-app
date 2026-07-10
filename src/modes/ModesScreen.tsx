import { Icon } from '../ui/Icon';
import { t } from '../i18n';
import type { ModeId } from './types';

interface Card {
  id: ModeId;
  emoji: string;
  titleKey: string;
  subKey: string;
}

const CARDS: Card[] = [
  { id: 'tilematch', emoji: '🧩', titleKey: 'mode.tilematch', subKey: 'mode.tilematch.sub' },
  { id: 'blitz', emoji: '⏱️', titleKey: 'mode.blitz', subKey: 'mode.blitz.sub' },
  { id: 'merge', emoji: '🔀', titleKey: 'mode.merge', subKey: 'mode.merge.sub' },
  { id: 'match3', emoji: '💎', titleKey: 'mode.match3', subKey: 'mode.match3.sub' },
  { id: 'memory', emoji: '🧠', titleKey: 'mode.memory', subKey: 'mode.memory.sub' },
  { id: 'sudoku', emoji: '🔢', titleKey: 'mode.sudoku', subKey: 'mode.sudoku.sub' },
];

export function ModesScreen({ onPick, onBack, best }: { onPick: (id: ModeId) => void; onBack: () => void; best: (k: string) => number | undefined }) {
  return (
    <div className="app screen">
      <header className="hud">
        <button className="icon-btn" onClick={onBack} aria-label="Zurück">
          <Icon name="chevron" />
        </button>
        <div className="hud-center">
          <div className="level">{t('mode.title')}</div>
        </div>
        <div style={{ width: 40 }} />
      </header>
      <div className="screen-body">
        <div className="mode-grid">
          {CARDS.map((c) => {
            const b = best(c.id);
            return (
              <button key={c.id} className="mode-card" onClick={() => onPick(c.id)}>
                <span className="mode-emoji">{c.emoji}</span>
                <span className="mode-name">{t(c.titleKey)}</span>
                <span className="mode-sub">{t(c.subKey)}</span>
                {b !== undefined && <span className="mode-best">{t('mode.best', { n: b })}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

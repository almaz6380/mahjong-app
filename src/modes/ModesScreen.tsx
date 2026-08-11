import { Icon } from '../ui/Icon';
import { t } from '../i18n';
import type { ModeId } from './types';
// Freigestellte Gemini-Motive statt Emoji — dieselbe Familie wie die Icons der
// „Alle Spiele"-Liste (Elfenbein/Jade/Gold). Quelle und Freistell-Rezept siehe
// CLAUDE.md, Abschnitt „Bild-Extraktions-Pipeline".
import icoTilematch from '../assets/mode-tilematch.webp';
import icoBlitz from '../assets/mode-blitz.webp';
import icoDimensions from '../assets/mode-dimensions.webp';
import icoMerge from '../assets/mode-merge.webp';
import icoMatch3 from '../assets/mode-match3.webp';
import icoMemory from '../assets/mode-memory.webp';
import icoSudoku from '../assets/mode-sudoku.webp';

interface Card {
  id: ModeId;
  ico: string;
  titleKey: string;
  subKey: string;
}

const CARDS: Card[] = [
  { id: 'tilematch', ico: icoTilematch, titleKey: 'mode.tilematch', subKey: 'mode.tilematch.sub' },
  { id: 'blitz', ico: icoBlitz, titleKey: 'mode.blitz', subKey: 'mode.blitz.sub' },
  { id: 'dimensions', ico: icoDimensions, titleKey: 'mode.dimensions', subKey: 'mode.dimensions.sub' },
  { id: 'merge', ico: icoMerge, titleKey: 'mode.merge', subKey: 'mode.merge.sub' },
  { id: 'match3', ico: icoMatch3, titleKey: 'mode.match3', subKey: 'mode.match3.sub' },
  { id: 'memory', ico: icoMemory, titleKey: 'mode.memory', subKey: 'mode.memory.sub' },
  { id: 'sudoku', ico: icoSudoku, titleKey: 'mode.sudoku', subKey: 'mode.sudoku.sub' },
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
                <img className="mode-ico" src={c.ico} alt="" />
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

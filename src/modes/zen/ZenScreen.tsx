import { useMemo, useState } from 'react';
import { FigureRound } from '../../ui/FigureRound';
import { WinCeremony } from '../../ui/WinCeremony';
import { allFigures } from '../../game/figures';
import { t } from '../../i18n';

// Zen-Modus: endloses, ruhiges Solitaire ohne Zeit, Wertung oder Kosten.
// Sanfte mittlere Figuren aus dem Generator; Tipp & Mischen sind gratis.

export function ZenScreen({ onExit }: { onExit: () => void }) {
  // Sanfte Boards: mittlere Größe, max. 3 Ebenen – und kompakt, damit die Steine
  // groß bleiben (ohne die Maß-Filter zeigt Zen ausgerechnet die größten Bretter).
  const figures = useMemo(
    () => allFigures().filter(
      (f) => f.cells.length >= 30 && f.cells.length <= 64 && f.layerCount <= 3 && f.cols <= 7 && f.rows <= 8,
    ),
    [],
  );
  // Startpunkt streut über den Tag, danach der Reihe nach.
  const [idx, setIdx] = useState(() => new Date().getDate() * 7 % figures.length);
  const fig = figures[idx % figures.length];

  return (
    <FigureRound
      key={idx}
      layoutName={fig.name}
      title={t('zen.title')}
      sub={t(fig.label)}
      freeBoosters
      quiet
      onExit={onExit}
      renderWin={() => (
        <div className="card zen-card">
          <WinCeremony />
          <h2>{t('zen.done')}</h2>
          <p className="zen-quote">{t('zen.quote')}</p>
          <button className="big-btn" onClick={() => setIdx((i) => i + 1)}>
            {t('zen.next')}
          </button>
          <button className="text-btn" onClick={onExit}>
            {t('common.toMenu')}
          </button>
        </div>
      )}
    />
  );
}

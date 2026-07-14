import { useMemo, useState } from 'react';
import { FigureRound } from '../../ui/FigureRound';
import { WinCeremony } from '../../ui/WinCeremony';
import { Icon } from '../../ui/Icon';
import { festivalFigure, type Festival } from '../../game/festivals';
import { t } from '../../i18n';

// Saison-Fest: ein Fest-Board (Figur passend zum Fest), erster Sieg des Tages
// bringt den Bonus. Danach kann beliebig weitergespielt werden (ohne Bonus).

interface Props {
  fest: Festival;
  claimFestival: (bonus: number) => boolean;
  spendCoins: (n: number) => boolean;
  onExit: () => void;
}

export function FestivalScreen({ fest, claimFestival, spendCoins, onExit }: Props) {
  const fig = useMemo(() => festivalFigure(fest), [fest]);
  const [round, setRound] = useState(0);
  const [gotBonus, setGotBonus] = useState(false);

  return (
    <FigureRound
      key={round}
      layoutName={fig.name}
      title={`${fest.emoji} ${t(fest.titleKey)}`}
      sub={t(fig.label)}
      spendCoins={spendCoins}
      onWin={() => setGotBonus(claimFestival(fest.bonus))}
      renderWin={() => (
        <div className="card">
          <WinCeremony />
          <h2>{t('fest.done', { fest: t(fest.titleKey) })}</h2>
          {gotBonus ? (
            <p className="coins-won">
              <Icon name="coin" size={24} /> +{fest.bonus}
            </p>
          ) : (
            <p className="zen-quote">{t('fest.bonusUsed')}</p>
          )}
          <button className="big-btn" onClick={() => setRound((r) => r + 1)}>
            {t('mode.again')}
          </button>
          <button className="text-btn" onClick={onExit}>
            {t('common.toMenu')}
          </button>
        </div>
      )}
      onExit={onExit}
    />
  );
}

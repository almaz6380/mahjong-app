import { type ReactNode } from 'react';
import { t } from '../i18n';

export interface GameItem {
  id: string;
  icon: ReactNode; // <Tile/> oder Emoji
  name: string;
  sub: string;
  badge?: string;
  onClick: () => void;
}

// Bottom-Sheet mit allen Spielmodi (einheitlich, ohne Regenbogen).
export function GamesSheet({ items, onClose }: { items: GameItem[]; onClose: () => void }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="games-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <h3>{t('home.allGames')}</h3>
        <div className="games-list">
          {items.map((it) => (
            <button key={it.id} className="game-row" onClick={it.onClick}>
              <span className="game-ico">{it.icon}</span>
              <span className="game-tx">
                <b>{it.name}</b>
                <span>{it.sub}</span>
              </span>
              {it.badge && <span className="game-badge">{it.badge}</span>}
              <span className="game-chev">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { Progress } from '../game/progress';
import { THEMES } from '../game/themes';
import { ACHIEVEMENTS } from '../game/achievements';
import { PRODUCTS, purchase, type Product } from '../store/iap';
import { setAdsRemoved } from '../ads/admob';
import { Icon } from './Icon';

function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="hud">
      <button className="icon-btn" onClick={onBack} aria-label="Zurück">
        <Icon name="chevron" />
      </button>
      <div className="hud-center">
        <div className="level">{title}</div>
      </div>
      <div style={{ width: 38 }} />
    </header>
  );
}

// --- Einstellungen ---------------------------------------------------------
export function SettingsScreen({
  progress,
  setSoundOn,
  setAiLevel,
  resetProgress,
  onBack,
}: {
  progress: Progress;
  setSoundOn: (on: boolean) => void;
  setAiLevel: (l: 'easy' | 'normal' | 'hard') => void;
  resetProgress: () => void;
  onBack: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const levels: [('easy' | 'normal' | 'hard'), string][] = [
    ['easy', 'Leicht'],
    ['normal', 'Mittel'],
    ['hard', 'Schwer'],
  ];
  return (
    <div className="app screen">
      <ScreenHeader title="Einstellungen" onBack={onBack} />
      <div className="screen-body">
        <div className="row">
          <span>Sound & Haptik</span>
          <button
            className={'toggle' + (progress.soundOn ? ' on' : '')}
            onClick={() => setSoundOn(!progress.soundOn)}
            aria-label="Sound umschalten"
          >
            <span className="knob" />
          </button>
        </div>
        <div className="row">
          <span>KI-Stärke (4 Spieler)</span>
          <div className="segment">
            {levels.map(([id, label]) => (
              <button key={id} className={progress.aiLevel === id ? 'on' : ''} onClick={() => setAiLevel(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <span>🗑️ Fortschritt zurücksetzen</span>
          <button className="small-btn danger" onClick={() => setConfirm(true)}>
            Reset
          </button>
        </div>
        <div className="credit">v0.3 · Mahjong</div>
      </div>

      {confirm && (
        <div className="overlay" onClick={() => setConfirm(false)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <div className="logo">⚠️</div>
            <h2>Wirklich zurücksetzen?</h2>
            <p>Level, Münzen und alle Erfolge gehen verloren.</p>
            <button
              className="big-btn"
              onClick={() => {
                resetProgress();
                setConfirm(false);
                onBack();
              }}
            >
              Ja, zurücksetzen
            </button>
            <button className="text-btn" onClick={() => setConfirm(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Kurzanleitung ---------------------------------------------------------
export function HowToScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="app screen">
      <ScreenHeader title="So geht's" onBack={onBack} />
      <div className="screen-body howto">
        <p>🎯 <b>Ziel:</b> Räume alle Steine vom Board, indem du gleiche Paare entfernst.</p>
        <p>✅ <b>Frei</b> ist ein Stein, wenn <b>nichts darauf liegt</b> und links <b>oder</b> rechts frei ist. Nur freie Steine (hell) sind anklickbar.</p>
        <p>🀱 <b>Paare:</b> Zwei gleiche Steine. <b>Blumen</b> passen zu allen Blumen, <b>Jahreszeiten</b> zu allen Jahreszeiten.</p>
        <p>💡 <b>Tipp/Mischen/Zurück</b> sind begrenzte Booster – nachfüllbar mit Münzen oder Video.</p>
        <p>⭐ Schnell und ohne Hilfen = <b>3 Sterne</b> und mehr Münzen.</p>
        <p>🎁 Jeden Tag: <b>Tages-Belohnung</b> + eigene <b>Tages-Challenge</b>.</p>
      </div>
    </div>
  );
}

// --- Themes ----------------------------------------------------------------
export function ThemesScreen({
  progress,
  purchaseTheme,
  selectTheme,
  onBack,
}: {
  progress: Progress;
  purchaseTheme: (id: string, cost: number) => boolean;
  selectTheme: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="app screen">
      <ScreenHeader title="Designs" onBack={onBack} />
      <div className="screen-body">
        <div className="menu-stats" style={{ justifyContent: 'center' }}>
          <span><Icon name="coin" /> {progress.coins}</span>
        </div>
        {THEMES.map((t) => {
          const owned = progress.ownedThemes.includes(t.id);
          const active = progress.theme === t.id;
          return (
            <div className="row" key={t.id}>
              <span>
                <span className="swatch" style={{ background: t.swatch }} /> {t.label}
              </span>
              {active ? (
                <span className="tag">Aktiv</span>
              ) : owned ? (
                <button className="small-btn" onClick={() => selectTheme(t.id)}>
                  Wählen
                </button>
              ) : (
                <button
                  className="small-btn gold"
                  disabled={progress.coins < t.cost}
                  onClick={() => purchaseTheme(t.id, t.cost)}
                >
                  <span className="btn-ico"><Icon name="coin" size={16} /> {t.cost}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Erfolge ---------------------------------------------------------------
export function AchievementsScreen({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const done = progress.achievements.length;
  return (
    <div className="app screen">
      <ScreenHeader title={`Erfolge (${done}/${ACHIEVEMENTS.length})`} onBack={onBack} />
      <div className="screen-body">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = progress.achievements.includes(a.id);
          return (
            <div className={'ach' + (unlocked ? ' unlocked' : '')} key={a.id}>
              <span className="ach-icon">{unlocked ? a.icon : '🔒'}</span>
              <span className="ach-text">
                <b>{a.label}</b>
                <small>{a.desc}</small>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Shop (IAP) ------------------------------------------------------------
export function ShopScreen({
  progress,
  addCoins,
  setRemoveAds,
  onBack,
}: {
  progress: Progress;
  addCoins: (n: number) => void;
  setRemoveAds: () => void;
  onBack: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);

  const buy = async (p: Product) => {
    const res = await purchase(p.id);
    if (res.ok) {
      if (p.coins) addCoins(p.coins);
      if (p.removesAds) {
        setRemoveAds();
        setAdsRemoved(true);
      }
      setMsg('Danke für deinen Kauf! ✅');
    } else {
      setMsg(res.error ?? 'Kauf fehlgeschlagen.');
    }
  };

  return (
    <div className="app screen">
      <ScreenHeader title="Shop" onBack={onBack} />
      <div className="screen-body">
        <div className="menu-stats" style={{ justifyContent: 'center' }}>
          <span><Icon name="coin" /> {progress.coins}</span>
        </div>
        {PRODUCTS.map((p) => {
          const already = p.removesAds && progress.removeAds;
          return (
            <div className="row" key={p.id}>
              <span>
                {p.icon} {p.label}
              </span>
              {already ? (
                <span className="tag">Aktiv</span>
              ) : (
                <button className="small-btn gold" onClick={() => buy(p)}>
                  {p.price}
                </button>
              )}
            </div>
          );
        })}
        <p className="credit">Käufe unterstützen die Weiterentwicklung 💚</p>
      </div>

      {msg && (
        <div className="overlay" onClick={() => setMsg(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '8px 0 16px' }}>{msg}</p>
            <button className="big-btn" onClick={() => setMsg(null)}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

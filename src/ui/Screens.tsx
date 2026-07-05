import { useState } from 'react';
import type { Progress } from '../game/progress';
import { THEMES } from '../game/themes';
import { ACHIEVEMENTS } from '../game/achievements';
import { PRODUCTS, purchase, displayPrice, canRestore, restorePurchases, type Product } from '../store/iap';
import { setAdsRemoved, canChangeAdConsent, changeAdConsent } from '../ads/admob';
import { Icon } from './Icon';
import { t } from '../i18n';

function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="hud">
      <button className="icon-btn" onClick={onBack} aria-label="Zurück">
        <Icon name="chevron" />
      </button>
      <div className="hud-center">
        <div className="level">{title}</div>
      </div>
      <div style={{ width: 40 }} />
    </header>
  );
}

// --- Einstellungen ---------------------------------------------------------
export function SettingsScreen({
  progress,
  setSoundOn,
  setAiLevel,
  setLang,
  resetProgress,
  onBack,
}: {
  progress: Progress;
  setSoundOn: (on: boolean) => void;
  setAiLevel: (l: 'easy' | 'normal' | 'hard') => void;
  setLang: (l: 'de' | 'en' | '') => void;
  resetProgress: () => void;
  onBack: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const levels: [('easy' | 'normal' | 'hard'), string][] = [
    ['easy', t('set.easy')],
    ['normal', t('set.normal')],
    ['hard', t('set.hard')],
  ];
  const langs: [('de' | 'en' | ''), string][] = [
    ['', t('set.langAuto')],
    ['de', 'DE'],
    ['en', 'EN'],
  ];
  return (
    <div className="app screen">
      <ScreenHeader title={t('set.title')} onBack={onBack} />
      <div className="screen-body">
        <div className="row">
          <span>{t('set.sound')}</span>
          <button
            className={'toggle' + (progress.soundOn ? ' on' : '')}
            onClick={() => setSoundOn(!progress.soundOn)}
            aria-label="Sound umschalten"
          >
            <span className="knob" />
          </button>
        </div>
        <div className="row">
          <span>{t('set.lang')}</span>
          <div className="segment">
            {langs.map(([id, label]) => (
              <button key={id || 'auto'} className={progress.lang === id ? 'on' : ''} onClick={() => setLang(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <span>{t('set.ai')}</span>
          <div className="segment">
            {levels.map(([id, label]) => (
              <button key={id} className={progress.aiLevel === id ? 'on' : ''} onClick={() => setAiLevel(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {canChangeAdConsent() && (
          <div className="row">
            <span>{t('set.adConsent')}</span>
            <button className="small-btn" onClick={() => changeAdConsent()}>
              {t('set.adConsentBtn')}
            </button>
          </div>
        )}
        <div className="row">
          <span>{t('set.reset')}</span>
          <button className="small-btn danger" onClick={() => setConfirm(true)}>
            {t('set.resetBtn')}
          </button>
        </div>
        <div className="credit">v1.0 · Mahjong Royale</div>
      </div>

      {confirm && (
        <div className="overlay" onClick={() => setConfirm(false)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <div className="logo">⚠️</div>
            <h2>{t('set.resetQ')}</h2>
            <p>{t('set.resetText')}</p>
            <button
              className="big-btn"
              onClick={() => {
                resetProgress();
                setConfirm(false);
                onBack();
              }}
            >
              {t('set.resetYes')}
            </button>
            <button className="text-btn" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
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
      <ScreenHeader title={t('howto.title')} onBack={onBack} />
      <div className="screen-body howto">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <p key={i}>{t(`howto.${i}`)}</p>
        ))}
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
      <ScreenHeader title={t('menu.themes')} onBack={onBack} />
      <div className="screen-body">
        <div className="menu-stats" style={{ justifyContent: 'center' }}>
          <span><Icon name="coin" /> {progress.coins}</span>
        </div>
        {THEMES.map((th) => {
          const owned = progress.ownedThemes.includes(th.id);
          const active = progress.theme === th.id;
          return (
            <div className="row" key={th.id}>
              <span>
                <span className="swatch" style={{ background: th.swatch }} /> {t(th.label)}
              </span>
              {active ? (
                <span className="tag">{t('common.active')}</span>
              ) : owned ? (
                <button className="small-btn" onClick={() => selectTheme(th.id)}>
                  {t('common.choose')}
                </button>
              ) : (
                <button
                  className="small-btn gold"
                  disabled={progress.coins < th.cost}
                  onClick={() => purchaseTheme(th.id, th.cost)}
                >
                  <span className="btn-ico"><Icon name="coin" size={16} /> {th.cost}</span>
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
      <ScreenHeader title={`${t('ach.title')} (${done}/${ACHIEVEMENTS.length})`} onBack={onBack} />
      <div className="screen-body">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = progress.achievements.includes(a.id);
          return (
            <div className={'ach' + (unlocked ? ' unlocked' : '')} key={a.id}>
              <span className="ach-icon">{unlocked ? a.icon : '🔒'}</span>
              <span className="ach-text">
                <b>{t(a.label)}</b>
                <small>{t(a.desc)}</small>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Statistik --------------------------------------------------------------
function fmtTime(ms: number): string {
  if (!ms) return '–';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function StatsScreen({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const threeStars = Object.values(progress.bestStars).filter((s) => s >= 3).length;
  const st = progress.stats;
  const rate = st.m4Hands > 0 ? Math.round((st.m4Wins / st.m4Hands) * 100) + ' %' : '–';
  const rows: [string, string | number][] = [
    [t('stats.level'), progress.level],
    [t('stats.wins'), progress.totalWins],
    [t('stats.threeStars'), threeStars],
    [t('stats.bestTime'), fmtTime(st.bestTimeMs)],
    [t('stats.dailies'), st.dailies],
    [t('stats.streak'), t('stats.days', { n: progress.streak })],
    [t('stats.coins'), progress.coins],
  ];
  const rowsM4: [string, string | number][] = [
    [t('stats.m4Hands'), st.m4Hands],
    [t('stats.m4Wins'), st.m4Wins],
    [t('stats.m4Rate'), rate],
    [t('stats.m4Faan'), st.m4BestFaan > 0 ? t('stats.faanN', { n: st.m4BestFaan }) : '–'],
  ];
  return (
    <div className="app screen">
      <ScreenHeader title={t('stats.title')} onBack={onBack} />
      <div className="screen-body">
        <div className="stats-section">{t('stats.solitaire')}</div>
        {rows.map(([k, v]) => (
          <div className="row" key={k}>
            <span>{k}</span>
            <span className="stat-val">{v}</span>
          </div>
        ))}
        <div className="stats-section">{t('stats.m4')}</div>
        {rowsM4.map(([k, v]) => (
          <div className="row" key={k}>
            <span>{k}</span>
            <span className="stat-val">{v}</span>
          </div>
        ))}
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
      setMsg(t('shop.thanks'));
    } else {
      setMsg(res.error ?? t('shop.failed'));
    }
  };

  return (
    <div className="app screen">
      <ScreenHeader title={t('shop.title')} onBack={onBack} />
      <div className="screen-body">
        <div className="menu-stats" style={{ justifyContent: 'center' }}>
          <span><Icon name="coin" /> {progress.coins}</span>
        </div>
        {PRODUCTS.map((p) => {
          const already = p.removesAds && progress.removeAds;
          return (
            <div className="row" key={p.id}>
              <span>
                {p.icon} {t(p.label)}
              </span>
              {already ? (
                <span className="tag">{t('common.active')}</span>
              ) : (
                <button className="small-btn gold" onClick={() => buy(p)}>
                  {displayPrice(p)}
                </button>
              )}
            </div>
          );
        })}
        {canRestore() && (
          <div className="row">
            <span>{t('shop.restore')}</span>
            <button
              className="small-btn"
              onClick={async () => {
                const ownsRemoveAds = await restorePurchases();
                if (ownsRemoveAds) {
                  setRemoveAds();
                  setAdsRemoved(true);
                  setMsg(t('shop.restored'));
                } else {
                  setMsg(t('shop.restoreNone'));
                }
              }}
            >
              {t('shop.restoreBtn')}
            </button>
          </div>
        )}
        <p className="credit">{t('shop.support')}</p>
      </div>

      {msg && (
        <div className="overlay" onClick={() => setMsg(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '8px 0 16px' }}>{msg}</p>
            <button className="big-btn" onClick={() => setMsg(null)}>
              {t('common.ok')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

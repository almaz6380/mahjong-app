import { useEffect, useState } from 'react';
import type { Progress } from '../game/progress';
import { THEMES, TILE_SKINS, SKIN_FILTER } from '../game/themes';
import { Tile } from './Tile';
import { ACHIEVEMENTS } from '../game/achievements';
import { PRODUCTS, purchase, displayPrice, canRestore, restorePurchases, type Product } from '../store/iap';
import { setAdsRemoved, canChangeAdConsent, changeAdConsent } from '../ads/admob';
import { Icon } from './Icon';
import { t, LANGS, type Lang } from '../i18n';
import { appVersionLabel } from '../appVersion';

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
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

// Rechtstexte liegen auf GitHub Pages (Repo almaz6380.github.io), damit sie
// ohne App und ohne Konto erreichbar sind — Apple, Google und das ECG wollen
// das so. Kein Browser-Plugin installiert: window.open mit _blank öffnet in
// Capacitor den System-Browser, im Web einen neuen Tab.
const LEGAL_LINKS: [string, string][] = [
  ['set.privacy', 'https://almaz6380.github.io/mahjong/datenschutz.html'],
  ['set.imprint', 'https://almaz6380.github.io/mahjong/impressum.html'],
  ['set.terms', 'https://almaz6380.github.io/mahjong/nutzungsbedingungen.html'],
];

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener');
}

// --- Einstellungen ---------------------------------------------------------
export function SettingsScreen({
  progress,
  setSoundOn,
  setVibrate,
  setNotify,
  setShowFacts,
  setAiLevel,
  setLang,
  resetProgress,
  go,
  onBack,
}: {
  progress: Progress;
  setSoundOn: (on: boolean) => void;
  setVibrate: (on: boolean) => void;
  setNotify: (on: boolean) => void;
  setShowFacts: (on: boolean) => void;
  setAiLevel: (l: 'easy' | 'normal' | 'hard') => void;
  setLang: (l: Lang | '') => void;
  resetProgress: () => void;
  go: (screen: string) => void;
  onBack: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [version, setVersion] = useState('');
  useEffect(() => {
    let live = true;
    appVersionLabel().then((v) => live && setVersion(v));
    return () => {
      live = false;
    };
  }, []);
  const levels: [('easy' | 'normal' | 'hard'), string][] = [
    ['easy', t('set.easy')],
    ['normal', t('set.normal')],
    ['hard', t('set.hard')],
  ];
  const langs: [(Lang | ''), string][] = [
    ['', t('set.langAuto')],
    ...LANGS.map((l): [Lang, string] => [l, l.toUpperCase()]),
  ];
  return (
    <div className="app screen">
      <ScreenHeader title={t('set.title')} onBack={onBack} />
      <div className="screen-body">
        <div className="set-nav">
          <button onClick={() => go('stats')}><Icon name="chart" size={20} /><span>{t('menu.stats')}</span><i className="chev">›</i></button>
          <button onClick={() => go('achievements')}><Icon name="trophy" size={20} /><span>{t('menu.achievements')}</span><i className="chev">›</i></button>
          <button onClick={() => go('shop')}><Icon name="cart" size={20} /><span>{t('menu.shop')}</span><i className="chev">›</i></button>
          <button onClick={() => go('howto')}><Icon name="help" size={20} /><span>{t('menu.help')}</span><i className="chev">›</i></button>
        </div>
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
          <span>{t('set.vibrate')}</span>
          <button
            className={'toggle' + (progress.vibrate ? ' on' : '')}
            onClick={() => setVibrate(!progress.vibrate)}
            aria-label={t('set.vibrate')}
          >
            <span className="knob" />
          </button>
        </div>
        <div className="row">
          <span>{t('set.notify')}</span>
          <button
            className={'toggle' + (progress.notify ? ' on' : '')}
            onClick={() => setNotify(!progress.notify)}
            aria-label={t('set.notify')}
          >
            <span className="knob" />
          </button>
        </div>
        <div className="row">
          <span>{t('set.facts')}</span>
          <button
            className={'toggle' + (progress.showFacts ? ' on' : '')}
            onClick={() => setShowFacts(!progress.showFacts)}
            aria-label={t('set.facts')}
          >
            <span className="knob" />
          </button>
        </div>
        <div className="row row-stack">
          <span>{t('set.lang')}</span>
          <div className="segment segment-lang">
            {langs.map(([id, label]) => (
              <button key={id || 'auto'} className={progress.lang === id ? 'on' : ''} onClick={() => setLang(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="row row-stack">
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
        <div className="stats-section">{t('set.legal')}</div>
        <div className="set-nav">
          {LEGAL_LINKS.map(([key, url]) => (
            <button key={key} onClick={() => openExternal(url)}>
              <Icon name="help" size={20} /><span>{t(key)}</span><i className="chev">↗</i>
            </button>
          ))}
        </div>
        <div className="credit">{version ? `${version} · ` : ''}Mahjong Royale</div>
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

// --- Design (Hintergrund-Welten + Stein-Designs) ---------------------------
export function ThemesScreen({
  progress,
  purchaseTheme,
  selectTheme,
  purchaseSkin,
  selectSkin,
  onBack,
}: {
  progress: Progress;
  purchaseTheme: (id: string, cost: number) => boolean;
  selectTheme: (id: string) => void;
  purchaseSkin: (id: string, cost: number) => boolean;
  selectSkin: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="app screen">
      <ScreenHeader title={t('design.title')} onBack={onBack} />
      <div className="screen-body">
        <div className="menu-stats" style={{ justifyContent: 'center' }}>
          <span><Icon name="coin" /> {progress.coins}</span>
        </div>

        <div className="stats-section">{t('design.tiles')}</div>
        {TILE_SKINS.map((sk) => {
          const owned = progress.ownedSkins.includes(sk.id);
          const active = progress.tileSkin === sk.id;
          return (
            <div className="row" key={sk.id}>
              <span className="skin-row">
                <span
                  className="skin-preview"
                  style={{ filter: SKIN_FILTER[sk.id] ?? 'none', background: sk.id === 'neon' ? '#12203a' : undefined }}
                >
                  <Tile face="s1" />
                </span>{' '}
                {t(sk.label)}
              </span>
              {active ? (
                <span className="tag">{t('common.active')}</span>
              ) : owned ? (
                <button className="small-btn" onClick={() => selectSkin(sk.id)}>
                  {t('common.choose')}
                </button>
              ) : (
                <button
                  className="small-btn gold"
                  disabled={progress.coins < sk.cost}
                  onClick={() => purchaseSkin(sk.id, sk.cost)}
                >
                  <span className="btn-ico"><Icon name="coin" size={16} /> {sk.cost}</span>
                </button>
              )}
            </div>
          );
        })}

        <div className="stats-section">{t('design.bg')}</div>
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
  // Lokale Bestenliste: Bestwerte je Modus.
  const mb = st.modeBest;
  const dash = (v: number | undefined) => (v === undefined ? '–' : v);
  const rowsBest: [string, string | number][] = [
    [t('menu.connect'), progress.connectLevel > 1 ? t('home.level', { n: progress.connectLevel }) : '–'],
    [t('mode.tilematch'), mb['tilematch'] ? t('home.level', { n: mb['tilematch'] }) : '–'],
    [t('mode.blitz'), mb['blitz'] ? t('blitz.score', { n: mb['blitz'] }) : '–'],
    [t('mode.match3'), dash(mb['match3'])],
    [t('mode.merge'), dash(mb['merge'])],
    // Memory zählt seit 11.08.2026 GESCHAFFTE LEVEL, nicht mehr Züge — die alten
    // Schlüssel `memory-easy/normal/hard` gab es hier zwar, nur schrieb sie
    // niemand mehr, und ein Zug-Bestwert wäre neben einem Level auch nicht
    // vergleichbar. Alte Werte bleiben im Speicher liegen und stören nicht.
    [t('mode.memory'), mb['memory'] ? t('home.level', { n: mb['memory'] }) : '–'],
    [t('mode.sudoku'), dash(mb['sudoku'])],
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
        <div className="stats-section">{t('stats.best')}</div>
        {rowsBest.map(([k, v]) => (
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
  setRemoveAds,
  onBack,
}: {
  progress: Progress;
  setRemoveAds: () => void;
  onBack: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);

  const buy = async (p: Product) => {
    const res = await purchase(p.id);
    if (res.ok) {
      // Münzen schreibt NICHT mehr die Oberfläche gut, sondern die
      // IAP-Warteschlange (store/iap.ts → useProgress) — auch für Käufe, die
      // erst in einer späteren Sitzung bestätigt werden.
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

import { useEffect, useState } from 'react';
import { GameScreen } from './ui/GameScreen';
import { Icon } from './ui/Icon';
import { Tile } from './ui/Tile';
import { Table4 } from './mahjong4/ui/Table4';
import { SettingsScreen, HowToScreen, ThemesScreen, AchievementsScreen, ShopScreen, StatsScreen } from './ui/Screens';
import { ModesScreen } from './modes/ModesScreen';
import { MemoryScreen } from './modes/memory/MemoryScreen';
import { MergeScreen } from './modes/merge/MergeScreen';
import { SudokuScreen } from './modes/sudoku/SudokuScreen';
import { Match3Screen } from './modes/match3/Match3Screen';
import { CrushScreen } from './modes/match3/CrushScreen';
import { useProgress } from './game/progress';
import { layoutForLevel } from './game/layouts';
import { applyTheme, applySkin } from './game/themes';
import { satisfiedAchievements, getAchievement, type Achievement } from './game/achievements';
import { loadSession, clearSession, type SavedGame } from './game/session';
import { makeDailyBoard, dailyLayoutName, dailyDoneToday } from './game/daily';
import { setSoundEnabled } from './audio/sound';
import { setLanguage, detectLang, t } from './i18n';
import { setAdsRemoved } from './ads/admob';
import type { PlacedTile } from './game/engine';

type Screen = 'menu' | 'play' | 'daily' | 'mahjong4' | 'settings' | 'howto' | 'themes' | 'achievements' | 'stats' | 'shop' | 'modes' | 'memory' | 'merge' | 'sudoku' | 'match3' | 'crush';

export default function App() {
  const p = useProgress();
  const { progress, pendingDaily, claimDaily } = p;

  const [screen, setScreen] = useState<Screen>('menu');
  const [round, setRound] = useState(0);
  const [playInitial, setPlayInitial] = useState<SavedGame | undefined>(undefined);
  const [resume, setResume] = useState<SavedGame | null>(null);
  const [achToast, setAchToast] = useState<Achievement | null>(null);
  const [dailyBoard, setDailyBoard] = useState<PlacedTile[] | null>(null);

  // Laufendes Spiel laden (für „Fortsetzen").
  useEffect(() => {
    loadSession().then(setResume);
  }, []);

  // Theme / Sound / Ads anwenden, wenn sich der Fortschritt ändert.
  useEffect(() => {
    if (progress) applyTheme(progress.theme);
  }, [progress?.theme]);
  useEffect(() => {
    if (progress) applySkin(progress.tileSkin);
  }, [progress?.tileSkin]);
  useEffect(() => {
    if (progress) setSoundEnabled(progress.soundOn);
  }, [progress?.soundOn]);
  useEffect(() => {
    if (progress) setAdsRemoved(progress.removeAds);
  }, [progress?.removeAds]);

  // Erfolge automatisch freischalten.
  useEffect(() => {
    if (!progress) return;
    const fresh = satisfiedAchievements(progress).filter((id) => !progress.achievements.includes(id));
    if (fresh.length) {
      p.unlockAchievements(fresh);
      setAchToast(getAchievement(fresh[0]) ?? null);
    }
  }, [progress]);
  useEffect(() => {
    if (!achToast) return;
    const t = setTimeout(() => setAchToast(null), 2600);
    return () => clearTimeout(t);
  }, [achToast]);

  // --- Ladebildschirm ---
  if (!progress) {
    return (
      <div className="menu">
        <div className="logo spin">🀄</div>
      </div>
    );
  }

  // Sprache synchron setzen, bevor Kinder rendern (t() liest modulglobal).
  setLanguage(progress.lang === 'de' || progress.lang === 'en' ? progress.lang : detectLang());

  // --- Tägliche Belohnung (Vorrang) ---
  if (pendingDaily) {
    return (
      <div className="menu">
        <div className="overlay">
          <div className="card">
            <div className="logo">🎁</div>
            <h2>{t('daily.title')}</h2>
            <p>
              {t('daily.streak', { n: pendingDaily.streak })}{pendingDaily.streak > 1 && ' 🔥'}
            </p>
            <p className="coins-won"><Icon name="coin" size={24} /> +{pendingDaily.coins}</p>
            <button className="big-btn" onClick={claimDaily}>
              {t('daily.claim')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const api = {
    useBooster: p.useBooster,
    spendCoins: p.spendCoins,
    addCoins: p.addCoins,
    recordWin: p.recordWin,
    advanceLevel: p.advanceLevel,
    completeDailyChallenge: p.completeDailyChallenge,
  };

  const exitToMenu = () => {
    setScreen('menu');
    loadSession().then(setResume);
  };

  const startFresh = () => {
    clearSession();
    setResume(null);
    setPlayInitial(undefined);
    setRound((r) => r + 1);
    setScreen('play');
  };
  const startResume = () => {
    setPlayInitial(resume ?? undefined);
    setScreen('play');
  };
  const startDaily = () => {
    setDailyBoard(makeDailyBoard());
    setRound((r) => r + 1);
    setScreen('daily');
  };

  // --- Spiel (normales Level) ---
  if (screen === 'play') {
    const lay = layoutForLevel(progress.level);
    return (
      <>
        <GameScreen
          key={`lvl-${progress.level}-${round}`}
          mode="level"
          level={progress.level}
          layoutName={lay.name}
          layoutLabel={lay.label}
          initial={playInitial}
          progress={progress}
          api={api}
          onExit={exitToMenu}
          onNewRound={() => {
            clearSession();
            setPlayInitial(undefined);
            setRound((r) => r + 1);
          }}
        />
        {achToast && <AchToast a={achToast} />}
      </>
    );
  }

  // --- Tages-Challenge ---
  if (screen === 'daily' && dailyBoard) {
    return (
      <>
        <GameScreen
          key={`daily-${round}`}
          mode="daily"
          level={0}
          layoutName={dailyLayoutName()}
          layoutLabel="layout.daily"
          initial={{ tiles: dailyBoard, elapsedMs: 0, helpUsed: 0 }}
          progress={progress}
          api={api}
          onExit={exitToMenu}
          onNewRound={startDaily}
        />
        {achToast && <AchToast a={achToast} />}
      </>
    );
  }

  if (screen === 'mahjong4')
    return (
      <Table4
        onExit={() => setScreen('menu')}
        addCoins={p.addCoins}
        difficulty={progress.aiLevel}
        showTutorial={!progress.seenM4Tutorial}
        onTutorialDone={p.markM4TutorialSeen}
        onHandResult={p.recordM4Hand}
      />
    );
  if (screen === 'settings')
    return <SettingsScreen progress={progress} setSoundOn={p.setSoundOn} setAiLevel={p.setAiLevel} setLang={p.setLang} resetProgress={p.resetProgress} onBack={() => setScreen('menu')} />;
  if (screen === 'stats') return <StatsScreen progress={progress} onBack={() => setScreen('menu')} />;

  // Spezialmodi
  const modeApi = {
    addCoins: p.addCoins,
    spendCoins: p.spendCoins,
    recordModeBest: p.recordModeBest,
    bestOf: (k: string) => progress.stats.modeBest[k],
  };
  if (screen === 'modes')
    return <ModesScreen onPick={(id) => setScreen(id)} onBack={() => setScreen('menu')} best={(k) => progress.stats.modeBest[k]} />;
  if (screen === 'memory') return <MemoryScreen api={modeApi} onExit={() => setScreen('modes')} />;
  if (screen === 'merge') return <MergeScreen api={modeApi} onExit={() => setScreen('modes')} />;
  if (screen === 'sudoku') return <SudokuScreen api={modeApi} onExit={() => setScreen('modes')} />;
  if (screen === 'match3') return <Match3Screen api={modeApi} onExit={() => setScreen('modes')} />;
  if (screen === 'crush')
    return (
      <CrushScreen
        crush={progress.crush}
        addCoins={p.addCoins}
        spendCoins={p.spendCoins}
        coins={progress.coins}
        recordCrush={p.recordCrush}
        onExit={() => setScreen('menu')}
      />
    );
  if (screen === 'howto') return <HowToScreen onBack={() => setScreen('menu')} />;
  if (screen === 'themes')
    return <ThemesScreen progress={progress} purchaseTheme={p.purchaseTheme} selectTheme={p.selectTheme} purchaseSkin={p.purchaseSkin} selectSkin={p.selectSkin} onBack={() => setScreen('menu')} />;
  if (screen === 'achievements') return <AchievementsScreen progress={progress} onBack={() => setScreen('menu')} />;
  if (screen === 'shop')
    return <ShopScreen progress={progress} addCoins={p.addCoins} setRemoveAds={p.setRemoveAds} onBack={() => setScreen('menu')} />;

  // --- Menü (Spiele-Hub) ---
  const canResume = !!resume && resume.level === progress.level;
  const dailyDone = dailyDoneToday(progress.lastDailyChallenge);
  const crushDone = Object.keys(progress.crush).length;
  return (
    <div className="menu hub">
      <div className="hub-title">
        <div className="logo sm"><Tile face="dragonR" /></div>
        <h1>Mahjong Royale</h1>
      </div>

      <div className="menu-stats">
        <span><Icon name="coin" /> {progress.coins}</span>
        {progress.streak > 0 && <span><Icon name="flame" /> {progress.streak}</span>}
        <span><Icon name="trophy" /> {progress.achievements.length}</span>
      </div>

      <div className="hub-grid">
        <button className="hub-card feature" onClick={canResume ? startResume : startFresh}>
          <span className="hub-face"><Tile face="char1" /></span>
          <span className="hub-name">{t('hub.solitaire')}</span>
          <span className="hub-sub">{canResume ? t('hub.resume', { n: resume!.level }) : t('hub.solitaire.sub', { n: progress.level })}</span>
        </button>
        <button className="hub-card" onClick={() => setScreen('crush')}>
          <span className="hub-emoji">💎</span>
          <span className="hub-name">{t('menu.crush')}</span>
          <span className="hub-sub">{t('hub.crush.sub')}</span>
          {crushDone > 0 && <span className="hub-badge">{crushDone}/50</span>}
        </button>
        <button className="hub-card" onClick={() => setScreen('mahjong4')}>
          <span className="hub-emoji">🀄</span>
          <span className="hub-name">{t('menu.m4')}</span>
          <span className="hub-sub">{t('hub.m4.sub')}</span>
        </button>
        <button className="hub-card" onClick={startDaily} disabled={dailyDone}>
          <span className="hub-emoji">🎁</span>
          <span className="hub-name">{t('hub.daily')}</span>
          <span className="hub-sub">{dailyDone ? '✓ ' + t('common.active') : t('hub.daily.sub')}</span>
        </button>
        <button className="hub-card wide" onClick={() => setScreen('modes')}>
          <span className="hub-emoji">🎲</span>
          <span className="hub-name">{t('hub.more')}</span>
          <span className="hub-sub">{t('hub.more.sub')}</span>
        </button>
      </div>

      <div className="menu-icons">
        <button onClick={() => setScreen('shop')}><Icon name="cart" size={22} /><span>{t('menu.shop')}</span></button>
        <button onClick={() => setScreen('themes')}><Icon name="palette" size={22} /><span>{t('menu.design')}</span></button>
        <button onClick={() => setScreen('achievements')}><Icon name="trophy" size={22} /><span>{t('menu.achievements')}</span></button>
        <button onClick={() => setScreen('stats')}><Icon name="chart" size={22} /><span>{t('menu.stats')}</span></button>
        <button onClick={() => setScreen('settings')}><Icon name="gear" size={22} /><span>{t('menu.settings')}</span></button>
        <button onClick={() => setScreen('howto')}><Icon name="help" size={22} /><span>{t('menu.help')}</span></button>
      </div>

      <div className="credit">v1.0 · Mahjong Royale</div>
      {achToast && <AchToast a={achToast} />}
    </div>
  );
}

function AchToast({ a }: { a: Achievement }) {
  return (
    <div className="ach-toast">
      <span className="ach-icon">{a.icon}</span>
      <span>
        <b>{t('ach.unlocked')}</b>
        <small>{t(a.label)}</small>
      </span>
    </div>
  );
}

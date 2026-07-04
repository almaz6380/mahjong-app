import { useEffect, useState } from 'react';
import { GameScreen } from './ui/GameScreen';
import { Icon } from './ui/Icon';
import { Tile } from './ui/Tile';
import { Table4 } from './mahjong4/ui/Table4';
import { SettingsScreen, HowToScreen, ThemesScreen, AchievementsScreen, ShopScreen } from './ui/Screens';
import { useProgress } from './game/progress';
import { layoutForLevel } from './game/layouts';
import { applyTheme } from './game/themes';
import { satisfiedAchievements, getAchievement, type Achievement } from './game/achievements';
import { loadSession, clearSession, type SavedGame } from './game/session';
import { makeDailyBoard, dailyLayoutName, dailyDoneToday } from './game/daily';
import { setSoundEnabled } from './audio/sound';
import { setAdsRemoved } from './ads/admob';
import type { PlacedTile } from './game/engine';

type Screen = 'menu' | 'play' | 'daily' | 'mahjong4' | 'settings' | 'howto' | 'themes' | 'achievements' | 'shop';

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

  // --- Tägliche Belohnung (Vorrang) ---
  if (pendingDaily) {
    return (
      <div className="menu">
        <div className="overlay">
          <div className="card">
            <div className="logo">🎁</div>
            <h2>Tägliche Belohnung</h2>
            <p>
              Tag {pendingDaily.streak} in Folge!{pendingDaily.streak > 1 && ' 🔥'}
            </p>
            <p className="coins-won">🪙 +{pendingDaily.coins}</p>
            <button className="big-btn" onClick={claimDaily}>
              Abholen
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
          layoutLabel="Tages-Board"
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

  if (screen === 'mahjong4') return <Table4 onExit={() => setScreen('menu')} addCoins={p.addCoins} difficulty={progress.aiLevel} />;
  if (screen === 'settings')
    return <SettingsScreen progress={progress} setSoundOn={p.setSoundOn} setAiLevel={p.setAiLevel} resetProgress={p.resetProgress} onBack={() => setScreen('menu')} />;
  if (screen === 'howto') return <HowToScreen onBack={() => setScreen('menu')} />;
  if (screen === 'themes')
    return <ThemesScreen progress={progress} purchaseTheme={p.purchaseTheme} selectTheme={p.selectTheme} onBack={() => setScreen('menu')} />;
  if (screen === 'achievements') return <AchievementsScreen progress={progress} onBack={() => setScreen('menu')} />;
  if (screen === 'shop')
    return <ShopScreen progress={progress} addCoins={p.addCoins} setRemoveAds={p.setRemoveAds} onBack={() => setScreen('menu')} />;

  // --- Menü ---
  const canResume = !!resume && resume.level === progress.level;
  const dailyDone = dailyDoneToday(progress.lastDailyChallenge);
  return (
    <div className="menu">
      <div className="logo"><Tile face="dragonR" /></div>
      <h1>Mahjong</h1>

      <div className="menu-stats">
        <span><Icon name="coin" /> {progress.coins}</span>
        {progress.streak > 0 && <span><Icon name="flame" /> {progress.streak}</span>}
        <span><Icon name="trophy" /> {progress.achievements.length}</span>
      </div>

      {canResume ? (
        <>
          <button className="big-btn" onClick={startResume}>
            Fortsetzen · Level {resume!.level}
          </button>
          <button className="big-btn ghost solid" onClick={startFresh}>
            Neu starten
          </button>
        </>
      ) : (
        <button className="big-btn" onClick={startFresh}>
          Level {progress.level} spielen
        </button>
      )}

      <button className="big-btn ghost solid" onClick={startDaily} disabled={dailyDone}>
        Tages-Challenge{dailyDone ? ' ✓' : ''}
      </button>
      <button className="big-btn ghost solid" onClick={() => setScreen('mahjong4')}>
        4 Spieler · Ostrunde
      </button>

      <div className="menu-icons">
        <button onClick={() => setScreen('shop')}><Icon name="cart" size={22} /><span>Shop</span></button>
        <button onClick={() => setScreen('themes')}><Icon name="palette" size={22} /><span>Designs</span></button>
        <button onClick={() => setScreen('achievements')}><Icon name="trophy" size={22} /><span>Erfolge</span></button>
        <button onClick={() => setScreen('settings')}><Icon name="gear" size={22} /><span>Optionen</span></button>
        <button onClick={() => setScreen('howto')}><Icon name="help" size={22} /><span>Hilfe</span></button>
      </div>

      <div className="credit">v0.3 · Endless · Mahjong</div>
      {achToast && <AchToast a={achToast} />}
    </div>
  );
}

function AchToast({ a }: { a: Achievement }) {
  return (
    <div className="ach-toast">
      <span className="ach-icon">{a.icon}</span>
      <span>
        <b>Erfolg freigeschaltet</b>
        <small>{a.label}</small>
      </span>
    </div>
  );
}

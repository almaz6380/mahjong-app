import { useEffect, useState } from 'react';
import { GameScreen } from './ui/GameScreen';
import { Icon } from './ui/Icon';
import { Tile } from './ui/Tile';
import { Table4 } from './mahjong4/ui/Table4';
import { RiichiTable } from './mahjong4/ui/RiichiTable';
import { GamesSheet, type GameItem } from './ui/GamesSheet';
import { DailyIcon } from './ui/DailyIcon';
import { EventIcon } from './ui/EventIcon';
import { RewardIcon } from './ui/RewardIcon';
import { HeroTile3D } from './ui/HeroTile3D';
import { SettingsScreen, HowToScreen, ThemesScreen, AchievementsScreen, ShopScreen, StatsScreen } from './ui/Screens';
import { ModesScreen } from './modes/ModesScreen';
import { MemoryScreen } from './modes/memory/MemoryScreen';
import { MergeScreen } from './modes/merge/MergeScreen';
import { SudokuScreen } from './modes/sudoku/SudokuScreen';
import { Match3Screen } from './modes/match3/Match3Screen';
import { TileMatchScreen } from './modes/tilematch/TileMatchScreen';
import { BlitzScreen } from './modes/blitz/BlitzScreen';
import { DimensionsScreen } from './modes/dimensions/DimensionsScreen';
import { ConnectScreen } from './modes/connect/ConnectScreen';
import { ZenScreen } from './modes/zen/ZenScreen';
import { PagodaScreen, PAGODA_FLOORS } from './modes/pagoda/PagodaScreen';
import { FestivalScreen } from './modes/festival/FestivalScreen';
import { AlbumScreen } from './ui/AlbumScreen';
import { activeFestival } from './game/festivals';
import { useProgress } from './game/progress';
import { layoutForLevel } from './game/layouts';
import { applyTheme, applySkin } from './game/themes';
import { satisfiedAchievements, getAchievement, type Achievement } from './game/achievements';
import { loadSession, clearSession, type SavedGame } from './game/session';
import { makeDailyBoard, dailyLayoutName, dailyDoneToday } from './game/daily';
import { todayEvent } from './game/events';
import { todayStr } from './game/progress';
import { setSoundEnabled } from './audio/sound';
import { setLanguage, detectLang, t } from './i18n';
import { setAdsRemoved } from './ads/admob';
import { setupDailyReminder } from './notify';
import { setFactsEnabled } from './ui/FactHost';
import { Sakura } from './ui/Sakura';
import { setAmbientLevel } from './ui/SumiE';
import type { PlacedTile } from './game/engine';

type Screen = 'menu' | 'play' | 'daily' | 'mahjong4' | 'settings' | 'howto' | 'themes' | 'achievements' | 'stats' | 'shop' | 'modes' | 'memory' | 'merge' | 'sudoku' | 'match3' | 'tilematch' | 'blitz' | 'dimensions' | 'connect' | 'riichi' | 'zen' | 'pagoda' | 'album' | 'festival';

export default function App() {
  const p = useProgress();
  const { progress, pendingDaily, claimDaily } = p;

  const [screen, setScreen] = useState<Screen>('menu');
  const [round, setRound] = useState(0);
  const [playInitial, setPlayInitial] = useState<SavedGame | undefined>(undefined);
  const [resume, setResume] = useState<SavedGame | null>(null);
  const [achToast, setAchToast] = useState<Achievement | null>(null);
  const [dailyBoard, setDailyBoard] = useState<PlacedTile[] | null>(null);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [showDailyReward, setShowDailyReward] = useState(false);

  // Laufendes Spiel laden (für „Fortsetzen").
  useEffect(() => {
    loadSession().then(setResume);
  }, []);

  // Theme / Sound / Ads anwenden, wenn sich der Fortschritt ändert.
  useEffect(() => {
    if (progress) applyTheme(progress.theme);
  }, [progress?.theme]);

  // Startseiten-Klasse an <html> setzen: steuert den Tempel-Hintergrund und die
  // dazu passende Safe-Area-Farbe zuverlässig (ohne :has()).
  useEffect(() => {
    document.documentElement.classList.toggle('on-home', screen === 'menu');
  }, [screen]);

  // Sumi-e-Hintergrundmotiv an den Level-Fortschritt koppeln.
  useEffect(() => {
    if (progress) setAmbientLevel(progress.level);
  }, [progress?.level]);
  useEffect(() => {
    if (progress) applySkin(progress.tileSkin);
  }, [progress?.tileSkin]);
  useEffect(() => {
    if (progress) setSoundEnabled(progress.soundOn);
  }, [progress?.soundOn]);
  useEffect(() => {
    if (progress) setAdsRemoved(progress.removeAds);
  }, [progress?.removeAds]);
  useEffect(() => {
    if (progress) setupDailyReminder(progress.notify, progress.lang === 'en' ? 'en' : 'de');
  }, [progress?.notify]);
  useEffect(() => {
    if (progress) setFactsEnabled(progress.showFacts);
  }, [progress?.showFacts]);

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

  const api = {
    useBooster: p.useBooster,
    spendCoins: p.spendCoins,
    addCoins: p.addCoins,
    recordWin: p.recordWin,
    advanceLevel: p.advanceLevel,
    completeDailyChallenge: p.completeDailyChallenge,
    bumpAlbum: p.bumpAlbum,
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
  if (screen === 'riichi')
    return (
      <RiichiTable
        onExit={() => setScreen('menu')}
        addCoins={p.addCoins}
        onHandResult={(won) => p.recordM4Hand(won, 0)}
      />
    );
  if (screen === 'settings')
    return <SettingsScreen progress={progress} setSoundOn={p.setSoundOn} setNotify={p.setNotify} setShowFacts={p.setShowFacts} setAiLevel={p.setAiLevel} setLang={p.setLang} resetProgress={p.resetProgress} go={(s) => setScreen(s as Screen)} onBack={() => setScreen('menu')} />;
  if (screen === 'stats') return <StatsScreen progress={progress} onBack={() => setScreen('menu')} />;

  // Spezialmodi. recordModeBest ist zugleich der Hook fürs Tages-Event:
  // schließt man den Event-Modus ab, gibt es einmal täglich einen Bonus.
  const event = todayEvent();
  const modeApi = {
    addCoins: p.addCoins,
    spendCoins: p.spendCoins,
    recordModeBest: (key: string, value: number, higher?: boolean) => {
      const better = p.recordModeBest(key, value, higher);
      if (key === event.mode) p.claimEvent(event.bonus);
      return better;
    },
    bestOf: (k: string) => progress.stats.modeBest[k],
  };
  if (screen === 'modes')
    return <ModesScreen onPick={(id) => setScreen(id)} onBack={() => setScreen('menu')} best={(k) => progress.stats.modeBest[k]} />;
  if (screen === 'memory') return <MemoryScreen api={modeApi} onExit={() => setScreen('modes')} />;
  if (screen === 'merge') return <MergeScreen api={modeApi} onExit={() => setScreen('modes')} />;
  if (screen === 'sudoku') return <SudokuScreen api={modeApi} onExit={() => setScreen('modes')} />;
  if (screen === 'match3') return <Match3Screen api={modeApi} onExit={() => setScreen('modes')} />;
  if (screen === 'tilematch') return <TileMatchScreen api={modeApi} onExit={() => setScreen('modes')} />;
  if (screen === 'blitz') return <BlitzScreen api={modeApi} onExit={() => setScreen('modes')} />;
  if (screen === 'dimensions') return <DimensionsScreen api={modeApi} onExit={() => setScreen('modes')} />;
  if (screen === 'connect')
    return (
      <ConnectScreen
        connectLevel={progress.connectLevel}
        coins={progress.coins}
        addCoins={p.addCoins}
        spendCoins={p.spendCoins}
        recordConnect={p.recordConnect}
        onExit={() => setScreen('menu')}
      />
    );
  if (screen === 'zen') return <ZenScreen onExit={() => setScreen('menu')} />;
  if (screen === 'pagoda')
    return (
      <PagodaScreen
        floor={progress.pagodaFloor}
        addCoins={p.addCoins}
        spendCoins={p.spendCoins}
        recordPagoda={p.recordPagoda}
        onExit={() => setScreen('menu')}
      />
    );
  if (screen === 'album')
    return <AlbumScreen progress={progress} claimAlbum={p.claimAlbum} onBack={() => setScreen('menu')} />;
  if (screen === 'festival') {
    const fest = activeFestival();
    if (!fest) {
      setScreen('menu');
      return null;
    }
    return (
      <FestivalScreen fest={fest} claimFestival={p.claimFestival} spendCoins={p.spendCoins} onExit={() => setScreen('menu')} />
    );
  }
  if (screen === 'howto') return <HowToScreen onBack={() => setScreen('menu')} />;
  if (screen === 'themes')
    return <ThemesScreen progress={progress} purchaseTheme={p.purchaseTheme} selectTheme={p.selectTheme} purchaseSkin={p.purchaseSkin} selectSkin={p.selectSkin} onBack={() => setScreen('menu')} />;
  if (screen === 'achievements') return <AchievementsScreen progress={progress} onBack={() => setScreen('menu')} />;
  if (screen === 'shop')
    return <ShopScreen progress={progress} addCoins={p.addCoins} setRemoveAds={p.setRemoveAds} onBack={() => setScreen('menu')} />;

  // --- Menü (Spiele-Hub) ---
  const canResume = !!resume && resume.level === progress.level;
  const dailyDone = dailyDoneToday(progress.lastDailyChallenge);
  const connectLevel = progress.connectLevel;
  const eventDone = progress.lastEvent === todayStr();
  const fest = activeFestival();

  const gameItems: GameItem[] = [
    { id: 'solitaire', icon: <Tile face="char1" />, name: t('hub.solitaire'), sub: canResume ? t('hub.resume', { n: resume!.level }) : t('hub.solitaire.sub', { n: progress.level }), onClick: canResume ? startResume : startFresh },
    { id: 'connect', icon: <span className="emoji">🔗</span>, name: t('menu.connect'), sub: t('hub.connect.sub'), badge: connectLevel > 1 ? 'Lv ' + connectLevel : undefined, onClick: () => setScreen('connect') },
    { id: 'm4', icon: <Tile face="dragonR" />, name: t('menu.m4'), sub: t('hub.m4.sub'), onClick: () => setScreen('mahjong4') },
    { id: 'riichi', icon: <Tile face="dragonG" />, name: t('menu.riichi'), sub: t('hub.riichi.sub'), onClick: () => setScreen('riichi') },
    { id: 'zen', icon: <span className="emoji">🧘</span>, name: t('menu.zen'), sub: t('hub.zen.sub'), onClick: () => setScreen('zen') },
    { id: 'pagoda', icon: <span className="emoji">🏯</span>, name: t('menu.pagoda'), sub: t('hub.pagoda.sub'), badge: progress.pagodaFloor > 1 ? `${Math.min(progress.pagodaFloor, PAGODA_FLOORS)}/${PAGODA_FLOORS}` : undefined, onClick: () => setScreen('pagoda') },
    { id: 'album', icon: <Tile face="myth1" />, name: t('menu.album'), sub: t('hub.album.sub'), onClick: () => setScreen('album') },
    { id: 'more', icon: <span className="emoji">🎲</span>, name: t('hub.more'), sub: t('hub.more.sub'), onClick: () => setScreen('modes') },
  ];

  return (
    <div className="home">
      <Sakura />
      <div className="home-top">
        <button className="coin-pill" onClick={() => setScreen('shop')} aria-label={t('menu.shop')}>
          <Icon name="coin" /> <span>{progress.coins}</span> <span className="plus">+</span>
        </button>
        <div className="home-actions">
          <button className="home-rbtn" onClick={() => setScreen('themes')} aria-label={t('menu.design')}><Icon name="palette" size={20} /></button>
          <button className="home-rbtn" onClick={() => setScreen('settings')} aria-label={t('menu.settings')}><Icon name="gear" size={20} /></button>
        </div>
      </div>

      <div className="home-stage">
        <div className="home-brand">
          <div className="hb-sub">Mahjong</div>
          <div className="hb-main">Royale</div>
        </div>
        <div className="home-tile"><HeroTile3D /></div>

        <div className="home-sides">
          <button className="side" onClick={startDaily} disabled={dailyDone}>
            <span className="side-emoji side-daily"><DailyIcon />{!dailyDone && <span className="side-dot" />}</span>
            <span className="side-lbl">{t('home.daily')}</span>
          </button>
          <button className="side" onClick={() => setShowDailyReward(true)} disabled={!pendingDaily}>
            <span className="side-emoji side-reward"><RewardIcon />{pendingDaily && <span className="side-dot" />}</span>
            <span className="side-lbl">{pendingDaily ? t('menu.reward') : '✓ ' + t('menu.reward')}</span>
          </button>
          <button className="side" onClick={() => setScreen(event.mode)}>
            <span className="side-emoji side-event"><EventIcon /></span>
            <span className="side-lbl">{eventDone ? '✓ ' + t('event.title') : t('event.title')}</span>
          </button>
        </div>
      </div>

      <div className="home-bottom">
        {fest && (
          <button className="fest-banner" onClick={() => setScreen('festival')}>
            <span className="fest-emoji">{fest.emoji}</span>
            <span className="fest-tx">
              {t(fest.titleKey)}
              <small>{progress.lastFestival === todayStr() ? '✓ ' + t('fest.sub.done') : t('fest.sub', { n: fest.bonus })}</small>
            </span>
            <span className="fest-go">›</span>
          </button>
        )}
        <button className="play-btn" onClick={canResume ? startResume : startFresh}>
          <span className="play-tri">▶</span>
          <span className="play-tx">
            {canResume ? t('home.resume') : t('home.play')}
            <small>{t('home.level', { n: progress.level })}</small>
          </span>
        </button>
        <button className="allgames-btn" onClick={() => setGamesOpen(true)}>{t('home.allGames')} ›</button>
      </div>

      {gamesOpen && <GamesSheet items={gameItems} onClose={() => setGamesOpen(false)} />}

      {/* Tagesbelohnung: öffnet nur über das Truhen-Symbol, nie automatisch. */}
      {showDailyReward && pendingDaily && (
        <div className="overlay" onClick={() => setShowDailyReward(false)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <div className="logo"><RewardIcon size={60} /></div>
            <h2>{t('daily.title')}</h2>
            <p>
              {t('daily.streak', { n: pendingDaily.streak })}{pendingDaily.streak > 1 && ' 🔥'}
            </p>
            <p className="coins-won"><Icon name="coin" size={24} /> +{pendingDaily.coins}</p>
            <button
              className="big-btn"
              onClick={() => {
                claimDaily();
                setShowDailyReward(false);
              }}
            >
              {t('daily.claim')}
            </button>
          </div>
        </div>
      )}
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

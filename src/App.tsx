import { useEffect, useState } from 'react';
import { GameScreen } from './ui/GameScreen';
import { Icon } from './ui/Icon';
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
import { todayStr, BONUS_DAILY_CAP } from './game/progress';
import { showToast } from './ui/ToastHost';
import { setSoundEnabled, setHapticsEnabled } from './audio/sound';
import { setLanguage, detectLang, t } from './i18n';
import { setAdsRemoved } from './ads/admob';
import { setupDailyReminder } from './notify';
import { Capacitor } from '@capacitor/core';
import { setFactsEnabled } from './ui/FactHost';
import gameSolitaire from './assets/game-solitaire.webp';
import gameConnect from './assets/game-connect.webp';
import gameM4 from './assets/game-m4.webp';
import gameRiichi from './assets/game-riichi.webp';
import gameZen from './assets/game-zen.webp';
import gamePagoda from './assets/game-pagoda.webp';
import gameAlbum from './assets/game-album.webp';
import gameMore from './assets/game-more.webp';
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

  // (Die frühere `on-home`-Klasse ist entfallen: Der Tempel-Hintergrund liegt
  // seit 11.08.2026 auf allen Bildschirmen, also fest auf `html` in styles.css.
  // Kein Umschalten je Screen mehr nötig.)

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
    if (progress) setHapticsEnabled(progress.vibrate);
  }, [progress?.vibrate]);
  useEffect(() => {
    if (progress) setAdsRemoved(progress.removeAds);
  }, [progress?.removeAds]);
  // Die System-Erlaubnis fuer Mitteilungen wird beim Start NUR erfragt, wenn
  // der Spieler schon einmal entschieden hat (notifyAsked). Neue Spieler sehen
  // stattdessen nach dem ersten gewonnenen Level die Karte unten auf der
  // Startseite — vorher hatte der allererste Start zwei Bettel-Dialoge.
  useEffect(() => {
    if (progress) setupDailyReminder(progress.notify, progress.lang || detectLang(), progress.notifyAsked);
  }, [progress?.notify, progress?.notifyAsked]);
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
  setLanguage(progress.lang || detectLang());

  // Alle Bonus-Spiele (Match-3, Connect, 4-Spieler, Riichi, Pagode …) teilen
  // sich einen Tagesdeckel. Ist er erreicht, sagt ein Toast es einmal deutlich,
  // statt dass die Münzen stumm ausbleiben.
  const bonusCoins = (n: number) => {
    const granted = p.addBonusCoins(n);
    if (n > 0 && granted < n) showToast(t('bonus.capReached', { n: BONUS_DAILY_CAP }));
  };

  const api = {
    useBooster: p.useBooster,
    refillBooster: p.refillBooster,
    spendCoins: p.spendCoins,
    addCoins: p.addCoins,
    markDoubleUsed: p.markDoubleUsed,
    recordWin: p.recordWin,
    // WICHTIG: Beim Levelaufstieg das fortgesetzte Brett verwerfen. Sonst wird
    // der gespeicherte Spielstand des ALTEN Levels erneut als Startbrett
    // benutzt -> im nächsten Level erschien wieder dieselbe (halb geräumte)
    // Figur, nur mit höherer Levelnummer.
    advanceLevel: () => {
      setPlayInitial(undefined);
      setResume(null);
      clearSession();
      p.advanceLevel();
    },
    completeDailyChallenge: p.completeDailyChallenge,
    bumpAlbum: p.bumpAlbum,
  };

  const exitToMenu = () => {
    setScreen('menu');
    setPlayInitial(undefined);
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
    // Nur fortsetzen, wenn der Spielstand wirklich zum aktuellen Level gehört.
    setPlayInitial(resume && resume.level === progress.level ? resume : undefined);
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
          // Doppelte Sicherung: ein Spielstand darf nur in genau dem Level
          // wiederverwendet werden, aus dem er stammt.
          initial={playInitial && playInitial.level === progress.level ? playInitial : undefined}
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
        addCoins={bonusCoins}
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
        addCoins={bonusCoins}
        onHandResult={(won) => p.recordM4Hand(won, 0)}
      />
    );
  if (screen === 'settings')
    return <SettingsScreen progress={progress} setSoundOn={p.setSoundOn} setVibrate={p.setVibrate} setNotify={p.setNotify} setShowFacts={p.setShowFacts} setAiLevel={p.setAiLevel} setLang={p.setLang} resetProgress={p.resetProgress} go={(s) => setScreen(s as Screen)} onBack={() => setScreen('menu')} />;
  if (screen === 'stats') return <StatsScreen progress={progress} onBack={() => setScreen('menu')} />;

  // Spezialmodi. recordModeBest ist zugleich der Hook fürs Tages-Event:
  // schließt man den Event-Modus ab, gibt es einmal täglich einen Bonus.
  const event = todayEvent();
  const modeApi = {
    coins: progress.coins,
    addCoins: bonusCoins,
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
        addCoins={bonusCoins}
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
        addCoins={bonusCoins}
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
    return <ShopScreen progress={progress} setRemoveAds={p.setRemoveAds} onBack={() => setScreen('menu')} />;

  // --- Menü (Spiele-Hub) ---
  const canResume = !!resume && resume.level === progress.level;
  const dailyDone = dailyDoneToday(progress.lastDailyChallenge);
  const connectLevel = progress.connectLevel;
  const eventDone = progress.lastEvent === todayStr();
  const fest = activeFestival();

  const gameItems: GameItem[] = [
    { id: 'solitaire', icon: <img className="game-img" src={gameSolitaire} alt="" />, name: t('hub.solitaire'), sub: canResume ? t('hub.resume', { n: resume!.level }) : t('hub.solitaire.sub', { n: progress.level }), onClick: canResume ? startResume : startFresh },
    { id: 'connect', icon: <img className="game-img" src={gameConnect} alt="" />, name: t('menu.connect'), sub: t('hub.connect.sub'), badge: connectLevel > 1 ? 'Lv ' + connectLevel : undefined, onClick: () => setScreen('connect') },
    { id: 'm4', icon: <img className="game-img" src={gameM4} alt="" />, name: t('menu.m4'), sub: t('hub.m4.sub'), onClick: () => setScreen('mahjong4') },
    { id: 'riichi', icon: <img className="game-img" src={gameRiichi} alt="" />, name: t('menu.riichi'), sub: t('hub.riichi.sub'), onClick: () => setScreen('riichi') },
    { id: 'zen', icon: <img className="game-img" src={gameZen} alt="" />, name: t('menu.zen'), sub: t('hub.zen.sub'), onClick: () => setScreen('zen') },
    { id: 'pagoda', icon: <img className="game-img" src={gamePagoda} alt="" />, name: t('menu.pagoda'), sub: t('hub.pagoda.sub'), badge: progress.pagodaFloor > 1 ? `${Math.min(progress.pagodaFloor, PAGODA_FLOORS)}/${PAGODA_FLOORS}` : undefined, onClick: () => setScreen('pagoda') },
    { id: 'album', icon: <img className="game-img" src={gameAlbum} alt="" />, name: t('menu.album'), sub: t('hub.album.sub'), onClick: () => setScreen('album') },
    { id: 'more', icon: <img className="game-img" src={gameMore} alt="" />, name: t('hub.more'), sub: t('hub.more.sub'), onClick: () => setScreen('modes') },
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
      {Capacitor.isNativePlatform() && progress.totalWins >= 1 && !progress.notifyAsked && (
        <div className="overlay">
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <div className="logo">🔔</div>
            <h2>{t('remind.title')}</h2>
            <p>{t('remind.body')}</p>
            <button className="big-btn" onClick={() => p.setNotify(true)}>
              {t('remind.yes')}
            </button>
            <button className="text-btn" onClick={() => p.setNotify(false)}>
              {t('remind.later')}
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { subscribeCoinCredits } from '../store/iap';

// ===========================================================================
//  Persistenter Spielerfortschritt (übersteht App-Neustart)
//  Speicherung via @capacitor/preferences – funktioniert nativ UND im Web
//  (dort automatisch über localStorage).
// ===========================================================================

export type BoosterType = 'hint' | 'shuffle' | 'undo';
export type AiLevel = 'easy' | 'normal' | 'hard';

export interface Progress {
  level: number;
  coins: number;
  boosters: Record<BoosterType, number>;
  bestStars: Record<number, number>; // level -> beste Sternzahl
  streak: number;
  lastPlayedDate: string; // 'YYYY-M-D' des letzten App-Starts (zählt den Streak)
  lastRewardClaim: string; // 'YYYY-M-D' der zuletzt abgeholten Tagesbelohnung
  totalWins: number;
  // v0.3
  soundOn: boolean;
  vibrate: boolean; // Vibration beim Antippen/Treffer (getrennt vom Klang)
  removeAds: boolean;
  theme: string;
  ownedThemes: string[];
  achievements: string[]; // freigeschaltete IDs
  lastDailyChallenge: string; // 'YYYY-MM-DD' der letzten erledigten Tages-Challenge
  aiLevel: AiLevel;
  lang: import('../i18n').Lang | ''; // '' = automatisch (Systemsprache)
  seenM4Tutorial: boolean;
  notify: boolean; // tägliche Erinnerung an
  // Ob die Mitteilungs-Erlaubnis schon einmal erfragt wurde. Bis 1.1.1 fragte
  // die App beim ALLERERSTEN Start danach — bevor der Spieler einen Stein
  // gesehen hatte. iOS stellt diese Frage genau einmal; wer da „Nein“ tippt,
  // ist für die Tageserinnerung verloren. Seit 1.1.2 kommt die Frage erst
  // nach dem ersten gewonnenen Level, mit eigener Karte davor (App.tsx).
  notifyAsked: boolean;
  showFacts: boolean; // „Wusstest du?“-Karten zwischen den Runden
  lastEvent: string; // 'YYYY-M-D' des zuletzt eingelösten Tages-Events
  tileSkin: string; // gewähltes Stein-Design
  ownedSkins: string[];
  connectLevel: number; // höchstes freigeschaltetes Mahjong-Connect-Level
  // v1.1 „Asia-Premium"
  pagodaFloor: number; // aktuelle Etage im Pagoden-Aufstieg (1 = ganz unten)
  album: Record<string, number>; // Mythen/Schätze: gesammelte Paare je Stein-ID
  albumClaimed: string[]; // bereits belohnte Album-Einträge
  lastFestival: string; // 'YYYY-M-D' des zuletzt eingelösten Fest-Bonus
  blitzReset: boolean; // Bestwert einmalig geleert (Blitz-Brett von 144 auf 52 Steine)
  // v1.2 Münz-Ökonomie
  lastDoubleDate: string; // 'YYYY-M-D' des letzten „Münzen verdoppeln“-Videos (1×/Tag)
  bonusCoinsDate: string; // Tag, für den bonusCoinsToday zählt
  bonusCoinsToday: number; // heute aus Bonus-Spielen verdiente Münzen (Deckel BONUS_DAILY_CAP)
  stats: {
    bestTimeMs: number; // schnellstes Solitaire-Level (0 = noch keins)
    dailies: number; // erledigte Tages-Challenges
    m4Hands: number; // gespielte 4-Spieler-Hände
    m4Wins: number; // davon gewonnen
    m4BestFaan: number;
    modeBest: Record<string, number>; // Bestwerte je Spezialmodus
  };
}

const STORAGE_KEY = 'mahjong.progress.v1';

const DEFAULT: Progress = {
  level: 1,
  coins: 100,
  boosters: { hint: 3, shuffle: 2, undo: 3 },
  bestStars: {},
  streak: 0,
  lastPlayedDate: '',
  lastRewardClaim: '',
  totalWins: 0,
  soundOn: true,
  vibrate: true,
  removeAds: false,
  theme: 'classic',
  ownedThemes: ['classic'],
  achievements: [],
  lastDailyChallenge: '',
  aiLevel: 'normal',
  lang: '',
  seenM4Tutorial: false,
  notify: true,
  notifyAsked: false,
  showFacts: true,
  lastEvent: '',
  tileSkin: 'ivory',
  ownedSkins: ['ivory'],
  connectLevel: 1,
  pagodaFloor: 1,
  album: {},
  albumClaimed: [],
  lastFestival: '',
  blitzReset: true,
  lastDoubleDate: '',
  bonusCoinsDate: '',
  bonusCoinsToday: 0,
  stats: { bestTimeMs: 0, dailies: 0, m4Hands: 0, m4Wins: 0, m4BestFaan: 0, modeBest: {} },
};

// Seit 1.2.0 (Rechtsprüfung/Ökonomie): Hilfen kosten so viel, dass sie
// mehrere gewonnene Level wert sind (5/10/15 Münzen je Level). Das Video ist
// immer die kostenlose Alternative.
export const BOOSTER_COST: Record<BoosterType, number> = {
  hint: 150,
  shuffle: 250,
  undo: 100,
};

/** Gemeinsamer Tagesdeckel für Münzen aus allen Bonus-Spielen. */
export const BONUS_DAILY_CAP = 100;

/** Tagesbelohnung: 10 Münzen, je Serientag +5, höchstens 50. */
export function dailyRewardCoins(streak: number): number {
  return Math.min(10 + (Math.max(streak, 1) - 1) * 5, 50);
}

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayStr(d);
}

export interface DailyReward {
  coins: number;
  streak: number;
}

export function useProgress() {
  const [state, setState] = useState<Progress | null>(null); // null = lädt noch
  const [pendingDaily, setPendingDaily] = useState<DailyReward | null>(null);
  const stateRef = useRef<Progress | null>(null);

  const persist = useCallback((next: Progress) => {
    stateRef.current = next;
    setState(next);
    Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(next) }).catch(() => {});
  }, []);

  // Laden beim Start + Tägliche-Belohnung prüfen.
  useEffect(() => {
    let cancelled = false;
    Preferences.get({ key: STORAGE_KEY }).then(({ value }) => {
      if (cancelled) return;
      let loaded: Progress = DEFAULT;
      if (value) {
        try {
          const parsed = JSON.parse(value);
          loaded = { ...DEFAULT, ...parsed, stats: { ...DEFAULT.stats, ...(parsed.stats ?? {}) } };
          // Migration: früher markierte erst das Abholen den Tag (lastPlayedDate).
          if (parsed.lastRewardClaim === undefined) loaded.lastRewardClaim = loaded.lastPlayedDate;
          // Migration 1.1.2: Alte Staende wurden beim ersten Start bereits nach der
          // Mitteilungs-Erlaubnis gefragt — die neue Karte darf dort nicht noch
          // einmal erscheinen (auf iOS gaebe es ohnehin keinen zweiten Dialog).
          if (parsed.notifyAsked === undefined) loaded.notifyAsked = true;
          // Migration: Zeit-Blitz spielt jetzt auf 52 statt 144 Steinen – alte
          // Bestwerte sind damit nicht mehr vergleichbar, einmalig leeren.
          if (!parsed.blitzReset) {
            const { blitz: _drop, ...rest } = loaded.stats.modeBest;
            loaded.stats = { ...loaded.stats, modeBest: rest };
            loaded.blitzReset = true;
          }
        } catch {
          loaded = DEFAULT;
        }
      }

      // Selbstheilung: Das Level steigt erst beim Tippen auf „Weiter". Wurde die
      // App (oder der Browser-Tab) auf dem Sieg-Bildschirm geschlossen, stand
      // danach wieder das bereits gelöste Level an — es kam „immer wieder das
      // gleiche Level". Richtig ist das erste noch nicht gelöste Level.
      const cleared = Object.keys(loaded.bestStars).length;
      for (let i = 0; i <= cleared && (loaded.bestStars[loaded.level] ?? 0) > 0; i++) {
        loaded = { ...loaded, level: loaded.level + 1 };
      }

      // Streak zählt konsekutive Tage mit App-Start — unabhängig vom Abholen,
      // damit ein übersehenes Belohnungs-Icon den Streak nicht bricht.
      const today = todayStr();
      if (loaded.lastPlayedDate !== today) {
        const streak = loaded.lastPlayedDate === yesterdayStr() ? loaded.streak + 1 : 1;
        loaded = { ...loaded, streak, lastPlayedDate: today };
      }
      persist(loaded);

      // Belohnung des Tages noch nicht abgeholt → Punkt am Icon (kein Auto-Popup).
      if (loaded.lastRewardClaim !== today) {
        const coins = dailyRewardCoins(loaded.streak);
        setPendingDaily({ coins, streak: loaded.streak });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const claimDaily = useCallback(() => {
    const s = stateRef.current;
    if (!s || !pendingDaily) return;
    persist({
      ...s,
      coins: s.coins + pendingDaily.coins,
      lastRewardClaim: todayStr(),
    });
    setPendingDaily(null);
  }, [pendingDaily, persist]);

  const addCoins = useCallback(
    (n: number) => {
      const s = stateRef.current;
      if (!s) return;
      persist({ ...s, coins: s.coins + n });
    },
    [persist],
  );

  // Münzen aus Bonus-Spielen (Match-3, Connect, 4-Spieler, Riichi …) laufen
  // durch einen gemeinsamen Tagesdeckel. Liefert die tatsächlich gutgeschriebene
  // Menge (0, wenn der Deckel erreicht ist).
  const addBonusCoins = useCallback(
    (n: number): number => {
      const s = stateRef.current;
      if (!s || n <= 0) return 0;
      const today = todayStr();
      const used = s.bonusCoinsDate === today ? s.bonusCoinsToday : 0;
      const granted = Math.max(0, Math.min(n, BONUS_DAILY_CAP - used));
      persist({ ...s, coins: s.coins + granted, bonusCoinsDate: today, bonusCoinsToday: used + granted });
      return granted;
    },
    [persist],
  );

  // „Münzen verdoppeln“ per Video: einmal pro Kalendertag.
  const markDoubleUsed = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    persist({ ...s, lastDoubleDate: todayStr() });
  }, [persist]);

  // Gekaufte Münzen aus der IAP-Warteschlange gutschreiben (auch Käufe, die
  // erst in einer späteren Sitzung bestätigt werden). Erst abonnieren, wenn
  // der Spielstand geladen ist — sonst ginge die Gutschrift ins Leere.
  const loaded = state !== null;
  useEffect(() => {
    if (!loaded) return;
    return subscribeCoinCredits((n) => {
      const s = stateRef.current;
      if (!s) return;
      persist({ ...s, coins: s.coins + n });
    });
  }, [loaded, persist]);

  const spendCoins = useCallback(
    (n: number): boolean => {
      const s = stateRef.current;
      if (!s || s.coins < n) return false;
      persist({ ...s, coins: s.coins - n });
      return true;
    },
    [persist],
  );

  const useBooster = useCallback(
    (type: BoosterType): boolean => {
      const s = stateRef.current;
      if (!s || s.boosters[type] <= 0) return false;
      persist({ ...s, boosters: { ...s.boosters, [type]: s.boosters[type] - 1 } });
      return true;
    },
    [persist],
  );

  const refillBooster = useCallback(
    (type: BoosterType, amount = 1) => {
      const s = stateRef.current;
      if (!s) return;
      persist({ ...s, boosters: { ...s.boosters, [type]: s.boosters[type] + amount } });
    },
    [persist],
  );

  // Sieg gutschreiben (Münzen + beste Sterne + Statistik), OHNE Level-Aufstieg.
  const recordWin = useCallback(
    (level: number, stars: number, coins: number, elapsedMs = 0) => {
      const s = stateRef.current;
      if (!s) return;
      const best = Math.max(s.bestStars[level] ?? 0, stars);
      const bestTimeMs =
        elapsedMs > 0 && (s.stats.bestTimeMs === 0 || elapsedMs < s.stats.bestTimeMs)
          ? elapsedMs
          : s.stats.bestTimeMs;
      persist({
        ...s,
        coins: s.coins + coins,
        bestStars: { ...s.bestStars, [level]: best },
        totalWins: s.totalWins + 1,
        lastPlayedDate: todayStr(),
        stats: { ...s.stats, bestTimeMs },
      });
    },
    [persist],
  );

  const advanceLevel = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    persist({ ...s, level: s.level + 1 });
  }, [persist]);

  // --- v0.3: Einstellungen, Themes, Achievements, Daily-Challenge, IAP ---

  const setSoundOn = useCallback(
    (on: boolean) => {
      const s = stateRef.current;
      if (!s) return;
      persist({ ...s, soundOn: on });
    },
    [persist],
  );

  const setVibrate = useCallback(
    (on: boolean) => {
      const s = stateRef.current;
      if (!s) return;
      persist({ ...s, vibrate: on });
    },
    [persist],
  );

  const setNotify = useCallback(
    (on: boolean) => {
      const s = stateRef.current;
      if (!s) return;
      // Jede bewusste Entscheidung (Karte oder Einstellungen) zaehlt als „gefragt“.
      persist({ ...s, notify: on, notifyAsked: true });
    },
    [persist],
  );

  const setShowFacts = useCallback(
    (on: boolean) => {
      const s = stateRef.current;
      if (!s) return;
      persist({ ...s, showFacts: on });
    },
    [persist],
  );

  // Tages-Event-Bonus einlösen (max. 1×/Tag; selbst-abgesichert via Ref).
  const claimEvent = useCallback(
    (bonus: number): boolean => {
      const s = stateRef.current;
      if (!s || s.lastEvent === todayStr()) return false;
      persist({ ...s, coins: s.coins + bonus, lastEvent: todayStr() });
      return true;
    },
    [persist],
  );

  const resetProgress = useCallback(() => {
    persist({ ...DEFAULT });
  }, [persist]);

  const setAiLevel = useCallback(
    (lvl: AiLevel) => {
      const s = stateRef.current;
      if (!s) return;
      persist({ ...s, aiLevel: lvl });
    },
    [persist],
  );

  const purchaseTheme = useCallback(
    (id: string, cost: number): boolean => {
      const s = stateRef.current;
      if (!s || s.ownedThemes.includes(id) || s.coins < cost) return false;
      persist({ ...s, coins: s.coins - cost, ownedThemes: [...s.ownedThemes, id], theme: id });
      return true;
    },
    [persist],
  );

  const selectTheme = useCallback(
    (id: string) => {
      const s = stateRef.current;
      if (!s || !s.ownedThemes.includes(id)) return;
      persist({ ...s, theme: id });
    },
    [persist],
  );

  const purchaseSkin = useCallback(
    (id: string, cost: number): boolean => {
      const s = stateRef.current;
      if (!s || s.ownedSkins.includes(id) || s.coins < cost) return false;
      persist({ ...s, coins: s.coins - cost, ownedSkins: [...s.ownedSkins, id], tileSkin: id });
      return true;
    },
    [persist],
  );

  const selectSkin = useCallback(
    (id: string) => {
      const s = stateRef.current;
      if (!s || !s.ownedSkins.includes(id)) return;
      persist({ ...s, tileSkin: id });
    },
    [persist],
  );

  // Pagoden-Etage freischalten (höchste erreichte Etage).
  const recordPagoda = useCallback(
    (floor: number) => {
      const s = stateRef.current;
      if (!s || floor <= s.pagodaFloor) return;
      persist({ ...s, pagodaFloor: floor, lastPlayedDate: todayStr() });
    },
    [persist],
  );

  // Mythen/Schätze-Paare fürs Album zählen (Stein-IDs eines entfernten Paars).
  const bumpAlbum = useCallback(
    (ids: string[]) => {
      const s = stateRef.current;
      if (!s || ids.length === 0) return;
      const album = { ...s.album };
      for (const id of ids) album[id] = (album[id] ?? 0) + 1;
      persist({ ...s, album });
    },
    [persist],
  );

  // Album-Belohnung abholen (einmal je Eintrag).
  const claimAlbum = useCallback(
    (id: string, reward: number): boolean => {
      const s = stateRef.current;
      if (!s || s.albumClaimed.includes(id)) return false;
      persist({ ...s, coins: s.coins + reward, albumClaimed: [...s.albumClaimed, id] });
      return true;
    },
    [persist],
  );

  // Fest-Bonus einlösen (max. 1×/Tag während eines Saison-Fests).
  const claimFestival = useCallback(
    (bonus: number): boolean => {
      const s = stateRef.current;
      if (!s || s.lastFestival === todayStr()) return false;
      persist({ ...s, coins: s.coins + bonus, lastFestival: todayStr() });
      return true;
    },
    [persist],
  );

  // Connect-Level freischalten (höchstes erreichtes Level).
  const recordConnect = useCallback(
    (level: number) => {
      const s = stateRef.current;
      if (!s || level <= s.connectLevel) return;
      persist({ ...s, connectLevel: level, lastPlayedDate: todayStr() });
    },
    [persist],
  );

  const setRemoveAds = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    persist({ ...s, removeAds: true });
  }, [persist]);

  const unlockAchievements = useCallback(
    (ids: string[]) => {
      const s = stateRef.current;
      if (!s) return;
      const fresh = ids.filter((id) => !s.achievements.includes(id));
      if (fresh.length === 0) return;
      persist({ ...s, achievements: [...s.achievements, ...fresh] });
    },
    [persist],
  );

  const completeDailyChallenge = useCallback(
    (coins: number) => {
      const s = stateRef.current;
      if (!s) return;
      persist({
        ...s,
        coins: s.coins + coins,
        lastDailyChallenge: todayStr(),
        stats: { ...s.stats, dailies: s.stats.dailies + 1 },
      });
    },
    [persist],
  );

  // Ergebnis einer 4-Spieler-Hand für die Statistik verbuchen.
  const recordM4Hand = useCallback(
    (won: boolean, faan: number) => {
      const s = stateRef.current;
      if (!s) return;
      persist({
        ...s,
        stats: {
          ...s.stats,
          m4Hands: s.stats.m4Hands + 1,
          m4Wins: s.stats.m4Wins + (won ? 1 : 0),
          m4BestFaan: won ? Math.max(s.stats.m4BestFaan, faan) : s.stats.m4BestFaan,
        },
      });
    },
    [persist],
  );

  // Bestwert je Modus verbuchen. higher=true: höher ist besser; false: niedriger (z. B. Züge/Zeit).
  const recordModeBest = useCallback(
    (key: string, value: number, higher = true): boolean => {
      const s = stateRef.current;
      if (!s) return false;
      const prev = s.stats.modeBest[key];
      const better = prev === undefined || (higher ? value > prev : value < prev);
      if (better) persist({ ...s, stats: { ...s.stats, modeBest: { ...s.stats.modeBest, [key]: value } } });
      return better;
    },
    [persist],
  );

  const setLang = useCallback(
    (lang: import('../i18n').Lang | '') => {
      const s = stateRef.current;
      if (!s) return;
      persist({ ...s, lang });
    },
    [persist],
  );

  const markM4TutorialSeen = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.seenM4Tutorial) return;
    persist({ ...s, seenM4Tutorial: true });
  }, [persist]);

  return {
    progress: state,
    pendingDaily,
    claimDaily,
    addCoins,
    addBonusCoins,
    markDoubleUsed,
    spendCoins,
    useBooster,
    refillBooster,
    recordWin,
    advanceLevel,
    setSoundOn,
    setVibrate,
    setNotify,
    setShowFacts,
    claimEvent,
    setAiLevel,
    resetProgress,
    purchaseTheme,
    selectTheme,
    purchaseSkin,
    selectSkin,
    recordConnect,
    recordPagoda,
    bumpAlbum,
    claimAlbum,
    claimFestival,
    setRemoveAds,
    unlockAchievements,
    completeDailyChallenge,
    recordM4Hand,
    recordModeBest,
    setLang,
    markM4TutorialSeen,
  };
}

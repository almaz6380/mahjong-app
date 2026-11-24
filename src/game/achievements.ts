import type { Progress } from './progress';
import { MEISTER_AB } from './meister';
import { FESTIVALS } from './festivals';
import { worldsCompleted, WORLD_COUNT } from './worlds';

// Lokale Erfolge. `check` leitet den Status aus dem Fortschritt ab.

export interface Achievement {
  id: string;
  label: string;
  desc: string;
  icon: string;
  check: (p: Progress) => boolean;
}

// label/desc sind i18n-Schlüssel (Auflösung beim Rendern via t()).
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', label: 'ach.first_win', desc: 'ach.first_win.d', icon: '🎉', check: (p) => p.totalWins >= 1 },
  { id: 'wins_10', label: 'ach.wins_10', desc: 'ach.wins_10.d', icon: '🔥', check: (p) => p.totalWins >= 10 },
  { id: 'wins_50', label: 'ach.wins_50', desc: 'ach.wins_50.d', icon: '🏆', check: (p) => p.totalWins >= 50 },
  { id: 'level_10', label: 'ach.level_10', desc: 'ach.level_10.d', icon: '⛰️', check: (p) => p.level >= 10 },
  { id: 'level_25', label: 'ach.level_25', desc: 'ach.level_25.d', icon: '🚀', check: (p) => p.level >= 25 },
  { id: 'level_100', label: 'ach.level_100', desc: 'ach.level_100.d', icon: '🏯', check: (p) => p.level >= 100 },
  { id: 'level_500', label: 'ach.level_500', desc: 'ach.level_500.d', icon: '🐉', check: (p) => p.level >= 500 },
  { id: 'meister', label: 'ach.meister', desc: 'ach.meister.d', icon: '👑', check: (p) => p.level >= MEISTER_AB },
  { id: 'three_star', label: 'ach.three_star', desc: 'ach.three_star.d', icon: '⭐', check: (p) => Object.values(p.bestStars).some((s) => s >= 3) },
  { id: 'streak_7', label: 'ach.streak_7', desc: 'ach.streak_7.d', icon: '📅', check: (p) => p.streak >= 7 },
  { id: 'duel_win', label: 'ach.duel_win', desc: 'ach.duel_win.d', icon: '⚔️', check: (p) => (p.stats.duelWins ?? 0) >= 1 },
  { id: 'riichi_win', label: 'ach.riichi_win', desc: 'ach.riichi_win.d', icon: '🀄', check: (p) => (p.stats.riichiWins ?? 0) >= 1 },
  { id: 'connect_25', label: 'ach.connect_25', desc: 'ach.connect_25.d', icon: '🔗', check: (p) => p.connectLevel >= 25 },
  { id: 'lawine_25', label: 'ach.lawine_25', desc: 'ach.lawine_25.d', icon: '🏔️', check: (p) => p.lawineLevel >= 25 },
  { id: 'rich', label: 'ach.rich', desc: 'ach.rich.d', icon: '💰', check: (p) => p.coins >= 1000 },
];

// Seit 1.7.0: 25 weitere Erfolge. Alle leiten sich aus vorhandenen Zählern ab
// (oder aus den neuen Feldern worldChests/festivalsSeen) — kein Erfolg braucht
// einen Zähler, den es nicht gibt. Bestehende Spieler bekommen beim ersten
// Start alle schon erfüllten auf einmal freigeschaltet (Toast zeigt den ersten).
const threeStarCount = (p: Progress) => Object.values(p.bestStars).filter((s) => s >= 3).length;
const albumDone = (p: Progress) => Object.values(p.album).filter((n) => n >= 4).length;
const pagodaCleared = (p: Progress) => p.pagodaFloor - 1;

ACHIEVEMENTS.push(
  { id: 'wins_100', label: 'ach.wins_100', desc: 'ach.wins_100.d', icon: '🎋', check: (p) => p.totalWins >= 100 },
  { id: 'wins_250', label: 'ach.wins_250', desc: 'ach.wins_250.d', icon: '🏮', check: (p) => p.totalWins >= 250 },
  { id: 'wins_500', label: 'ach.wins_500', desc: 'ach.wins_500.d', icon: '🎎', check: (p) => p.totalWins >= 500 },
  { id: 'stars_25', label: 'ach.stars_25', desc: 'ach.stars_25.d', icon: '🌟', check: (p) => threeStarCount(p) >= 25 },
  { id: 'stars_100', label: 'ach.stars_100', desc: 'ach.stars_100.d', icon: '✨', check: (p) => threeStarCount(p) >= 100 },
  { id: 'world_1', label: 'ach.world_1', desc: 'ach.world_1.d', icon: '🗺️', check: (p) => worldsCompleted(p.bestStars) >= 1 },
  { id: 'world_5', label: 'ach.world_5', desc: 'ach.world_5.d', icon: '🧭', check: (p) => worldsCompleted(p.bestStars) >= 5 },
  { id: 'world_10', label: 'ach.world_10', desc: 'ach.world_10.d', icon: '🌏', check: (p) => worldsCompleted(p.bestStars) >= 10 },
  { id: 'world_all', label: 'ach.world_all', desc: 'ach.world_all.d', icon: '⛩️', check: (p) => worldsCompleted(p.bestStars) >= WORLD_COUNT },
  { id: 'chest_1', label: 'ach.chest_1', desc: 'ach.chest_1.d', icon: '🧰', check: (p) => p.worldChests.length >= 1 },
  { id: 'chest_10', label: 'ach.chest_10', desc: 'ach.chest_10.d', icon: '💎', check: (p) => p.worldChests.length >= 10 },
  { id: 'fest_1', label: 'ach.fest_1', desc: 'ach.fest_1.d', icon: '🎆', check: (p) => p.festivalsSeen.length >= 1 },
  { id: 'fest_4', label: 'ach.fest_4', desc: 'ach.fest_4.d', icon: '🎐', check: (p) => p.festivalsSeen.length >= 4 },
  { id: 'fest_all', label: 'ach.fest_all', desc: 'ach.fest_all.d', icon: '🎑', check: (p) => FESTIVALS.every((f) => p.festivalsSeen.includes(f.id)) },
  { id: 'pagoda_150', label: 'ach.pagoda_150', desc: 'ach.pagoda_150.d', icon: '🛕', check: (p) => pagodaCleared(p) >= 150 },
  { id: 'pagoda_200', label: 'ach.pagoda_200', desc: 'ach.pagoda_200.d', icon: '🗼', check: (p) => pagodaCleared(p) >= 200 },
  { id: 'pagoda_300', label: 'ach.pagoda_300', desc: 'ach.pagoda_300.d', icon: '🏯', check: (p) => pagodaCleared(p) >= 300 },
  { id: 'connect_100', label: 'ach.connect_100', desc: 'ach.connect_100.d', icon: '⛓️', check: (p) => p.connectLevel >= 100 },
  { id: 'lawine_100', label: 'ach.lawine_100', desc: 'ach.lawine_100.d', icon: '❄️', check: (p) => p.lawineLevel >= 100 },
  { id: 'duel_10', label: 'ach.duel_10', desc: 'ach.duel_10.d', icon: '🗡️', check: (p) => (p.stats.duelWins ?? 0) >= 10 },
  { id: 'riichi_10', label: 'ach.riichi_10', desc: 'ach.riichi_10.d', icon: '🀅', check: (p) => (p.stats.riichiWins ?? 0) >= 10 },
  { id: 'm4_win', label: 'ach.m4_win', desc: 'ach.m4_win.d', icon: '🀀', check: (p) => p.stats.m4Wins >= 1 },
  { id: 'album_all', label: 'ach.album_all', desc: 'ach.album_all.d', icon: '📜', check: (p) => albumDone(p) >= 8 },
  { id: 'streak_30', label: 'ach.streak_30', desc: 'ach.streak_30.d', icon: '🗓️', check: (p) => p.streak >= 30 },
  { id: 'daily_30', label: 'ach.daily_30', desc: 'ach.daily_30.d', icon: '☀️', check: (p) => p.stats.dailies >= 30 },
);

// Liefert die IDs aller aktuell erfüllten Erfolge.
export function satisfiedAchievements(p: Progress): string[] {
  return ACHIEVEMENTS.filter((a) => a.check(p)).map((a) => a.id);
}

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

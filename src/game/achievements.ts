import type { Progress } from './progress';
import { MEISTER_AB } from './meister';

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

// Liefert die IDs aller aktuell erfüllten Erfolge.
export function satisfiedAchievements(p: Progress): string[] {
  return ACHIEVEMENTS.filter((a) => a.check(p)).map((a) => a.id);
}

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

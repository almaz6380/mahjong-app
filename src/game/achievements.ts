import type { Progress } from './progress';

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
  { id: 'three_star', label: 'ach.three_star', desc: 'ach.three_star.d', icon: '⭐', check: (p) => Object.values(p.bestStars).some((s) => s >= 3) },
  { id: 'streak_7', label: 'ach.streak_7', desc: 'ach.streak_7.d', icon: '📅', check: (p) => p.streak >= 7 },
  { id: 'rich', label: 'ach.rich', desc: 'ach.rich.d', icon: '💰', check: (p) => p.coins >= 1000 },
];

// Liefert die IDs aller aktuell erfüllten Erfolge.
export function satisfiedAchievements(p: Progress): string[] {
  return ACHIEVEMENTS.filter((a) => a.check(p)).map((a) => a.id);
}

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

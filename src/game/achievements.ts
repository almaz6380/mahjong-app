import type { Progress } from './progress';

// Lokale Erfolge. `check` leitet den Status aus dem Fortschritt ab.

export interface Achievement {
  id: string;
  label: string;
  desc: string;
  icon: string;
  check: (p: Progress) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', label: 'Erster Sieg', desc: 'Gewinne dein erstes Level', icon: '🎉', check: (p) => p.totalWins >= 1 },
  { id: 'wins_10', label: 'Aufwärmen', desc: 'Gewinne 10 Level', icon: '🔥', check: (p) => p.totalWins >= 10 },
  { id: 'wins_50', label: 'Profi', desc: 'Gewinne 50 Level', icon: '🏆', check: (p) => p.totalWins >= 50 },
  { id: 'level_10', label: 'Aufstieg', desc: 'Erreiche Level 10', icon: '⛰️', check: (p) => p.level >= 10 },
  { id: 'level_25', label: 'Kletterer', desc: 'Erreiche Level 25', icon: '🚀', check: (p) => p.level >= 25 },
  { id: 'three_star', label: 'Makellos', desc: 'Hol 3 Sterne in einem Level', icon: '⭐', check: (p) => Object.values(p.bestStars).some((s) => s >= 3) },
  { id: 'streak_7', label: 'Treuer Spieler', desc: '7 Tage in Folge', icon: '📅', check: (p) => p.streak >= 7 },
  { id: 'rich', label: 'Reich', desc: 'Besitze 1000 Münzen', icon: '💰', check: (p) => p.coins >= 1000 },
];

// Liefert die IDs aller aktuell erfüllten Erfolge.
export function satisfiedAchievements(p: Progress): string[] {
  return ACHIEVEMENTS.filter((a) => a.check(p)).map((a) => a.id);
}

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

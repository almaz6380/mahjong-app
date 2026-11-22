import { LEVEL_ORDER } from './levelOrder';

// Welten (seit 1.7.0): Die 999 Kampagnen-Level sind in Welten à 50 Level
// gegliedert — reine Darstellung und Belohnung. Brett-Erzeugung, levelOrder und
// damit DUEL_PROTOCOL bleiben unberührt; eine Welt ist nur ein Levelbereich.
//
// Je Welt drei Sterne-Truhen, jede genau EINMAL (Stand in progress.worldChests):
//   half  – die Hälfte der möglichen Sterne
//   clear – alle Level der Welt geschafft (Weltende)
//   most  – 80 % der möglichen Sterne
// Bewusst nicht „alle Sterne“: Gelöste Level lassen sich nicht wiederholen, ein
// verpasster dritter Stern wäre damit für immer verloren — die Truhe auch.
//
// Altstände: Es gibt keine Sonder-Migration. Eine Truhe, deren Bedingung beim
// ersten Start schon erfüllt ist, steht einfach zum Öffnen bereit.

export const WORLD_SIZE = 50;
export const CAMPAIGN_LEVELS = LEVEL_ORDER.length; // 999
export const WORLD_COUNT = Math.ceil(CAMPAIGN_LEVELS / WORLD_SIZE); // 20

// Reihenfolge = Weltnummer. IDs sind i18n-Schlüssel `world.<id>` — nie umbenennen.
export const WORLD_IDS = [
  'bambus', 'lotus', 'jade', 'nebel', 'kirsch',
  'seide', 'kranich', 'laterne', 'tee', 'koi',
  'mond', 'drache', 'phoenix', 'mauer', 'porzellan',
  'tiger', 'wolken', 'gold', 'kaiser', 'himmel',
] as const;

export type ChestTier = 'half' | 'clear' | 'most';
export const CHEST_COINS: Record<ChestTier, number> = { half: 50, clear: 75, most: 100 };

export interface WorldInfo {
  index: number; // 0-basiert
  id: string;
  from: number;
  to: number;
  levels: number;
  stars: number;
  maxStars: number;
  cleared: number; // Level mit mindestens 1 Stern
  complete: boolean;
  unlocked: boolean; // erstes Level erreicht
}

export interface ChestInfo {
  id: string; // 'w<n>.<tier>'
  tier: ChestTier;
  coins: number;
  need: number; // Sterne bzw. Level (clear)
  reached: boolean;
  claimed: boolean;
}

/** 0-basierte Welt eines Kampagnen-Levels, null im Meister-Bereich. */
export function worldIndexOf(level: number): number | null {
  if (level < 1 || level > CAMPAIGN_LEVELS) return null;
  return Math.floor((level - 1) / WORLD_SIZE);
}

export function worldInfo(index: number, bestStars: Record<number, number>, currentLevel: number): WorldInfo {
  const from = index * WORLD_SIZE + 1;
  const to = Math.min(CAMPAIGN_LEVELS, from + WORLD_SIZE - 1);
  let stars = 0;
  let cleared = 0;
  for (let l = from; l <= to; l++) {
    const s = bestStars[l] ?? 0;
    if (s > 0) cleared++;
    stars += Math.min(3, s);
  }
  const levels = to - from + 1;
  return {
    index,
    id: WORLD_IDS[index] ?? `w${index + 1}`,
    from,
    to,
    levels,
    stars,
    maxStars: levels * 3,
    cleared,
    complete: cleared >= levels,
    unlocked: currentLevel >= from || cleared > 0,
  };
}

export function allWorlds(bestStars: Record<number, number>, currentLevel: number): WorldInfo[] {
  return Array.from({ length: WORLD_COUNT }, (_, i) => worldInfo(i, bestStars, currentLevel));
}

export const chestId = (index: number, tier: ChestTier) => `w${index + 1}.${tier}`;

export function worldChests(w: WorldInfo, claimed: string[]): ChestInfo[] {
  const half = Math.ceil(w.maxStars * 0.5);
  const most = Math.ceil(w.maxStars * 0.8);
  const mk = (tier: ChestTier, need: number, reached: boolean): ChestInfo => {
    const id = chestId(w.index, tier);
    return { id, tier, coins: CHEST_COINS[tier], need, reached, claimed: claimed.includes(id) };
  };
  return [mk('half', half, w.stars >= half), mk('clear', w.levels, w.complete), mk('most', most, w.stars >= most)];
}

/** Anzahl Truhen, die gerade geöffnet werden könnten (für den Punkt auf der Startseite). */
export function openableChests(bestStars: Record<number, number>, currentLevel: number, claimed: string[]): number {
  let n = 0;
  for (const w of allWorlds(bestStars, currentLevel)) {
    for (const c of worldChests(w, claimed)) if (c.reached && !c.claimed) n++;
  }
  return n;
}

/** Ob eine Truhen-ID (z. B. aus einem Klick) wirklich erreicht ist — Schutz in claimWorldChest. */
export function chestReached(id: string, bestStars: Record<number, number>): ChestInfo | null {
  const m = /^w(\d+)\.(half|clear|most)$/.exec(id);
  if (!m) return null;
  const index = Number(m[1]) - 1;
  if (index < 0 || index >= WORLD_COUNT) return null;
  const c = worldChests(worldInfo(index, bestStars, 0), []).find((x) => x.tier === m[2]);
  return c && c.reached ? c : null;
}

export function worldsCompleted(bestStars: Record<number, number>): number {
  return allWorlds(bestStars, 0).filter((w) => w.complete).length;
}

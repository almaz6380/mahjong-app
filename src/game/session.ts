import { Preferences } from '@capacitor/preferences';
import type { PlacedTile } from './engine';

// Laufendes Spiel sichern, damit man nach App-Neustart „Fortsetzen" kann.

const KEY = 'mahjong.session.v1';

export interface SavedGame {
  level: number;
  tiles: PlacedTile[];
  elapsedMs: number;
  helpUsed: number;
}

export async function saveSession(game: SavedGame): Promise<void> {
  try {
    await Preferences.set({ key: KEY, value: JSON.stringify(game) });
  } catch {
    /* ignore */
  }
}

export async function loadSession(): Promise<SavedGame | null> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return null;
    const g = JSON.parse(value) as SavedGame;
    // Nur sinnvoll, wenn noch Steine übrig sind.
    if (!g.tiles?.some((t) => !t.removed)) return null;
    return g;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await Preferences.remove({ key: KEY });
  } catch {
    /* ignore */
  }
}

// Sterne- und Münz-Berechnung pro Level.

export interface LevelStats {
  tileCount: number;
  elapsedMs: number;
  helpUsed: number; // genutzte Tipps + Mischen (Undo zählt nicht)
}

// Par-Zeit für 3 Sterne: 4 Sekunden pro Paar.
export function parTimeMs(tileCount: number): number {
  return (tileCount / 2) * 4000;
}

export function starsFor(stats: LevelStats): 1 | 2 | 3 {
  const par = parTimeMs(stats.tileCount);
  if (stats.helpUsed === 0 && stats.elapsedMs <= par) return 3;
  if (stats.helpUsed <= 1 && stats.elapsedMs <= par * 1.8) return 2;
  return 1;
}

// Münzen für ein abgeschlossenes Level.
export function coinsFor(stars: number): number {
  return 20 + 15 * stars; // 1★=35, 2★=50, 3★=65
}

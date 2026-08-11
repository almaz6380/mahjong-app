// Sterne- und Münz-Berechnung pro Level.

export interface LevelStats {
  tileCount: number;
  elapsedMs: number;
  helpUsed: number; // genutzte Tipps + Mischen (Undo zählt nicht)
  /** Verdeckte Steine auf diesem Brett (verlängern die Par-Zeit). */
  hiddenCount?: number;
}

/** Zuschlag je verdecktem Stein: einmal aufdecken, merken, wiederfinden. */
const HIDDEN_BONUS_MS = 2500;

// Par-Zeit für 3 Sterne: 4 Sekunden pro Paar.
//
// Verdeckte Steine kosten Zeit, die nichts mit Können zu tun hat — ohne
// Zuschlag fiele in genau diesen Leveln die Drei-Sterne-Quote, und zwar ohne
// dass der Spieler schlechter geworden wäre.
export function parTimeMs(tileCount: number, hiddenCount = 0): number {
  return (tileCount / 2) * 4000 + hiddenCount * HIDDEN_BONUS_MS;
}

export function starsFor(stats: LevelStats): 1 | 2 | 3 {
  const par = parTimeMs(stats.tileCount, stats.hiddenCount ?? 0);
  if (stats.helpUsed === 0 && stats.elapsedMs <= par) return 3;
  if (stats.helpUsed <= 1 && stats.elapsedMs <= par * 1.8) return 2;
  return 1;
}

// Münzen für ein abgeschlossenes Level.
export function coinsFor(stars: number): number {
  return 20 + 15 * stars; // 1★=35, 2★=50, 3★=65
}

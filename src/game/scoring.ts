// Sterne- und Münz-Berechnung pro Level.

export interface LevelStats {
  tileCount: number;
  elapsedMs: number;
  helpUsed: number; // genutzte Tipps + Mischen (Undo zählt nicht)
  /** Verdeckte Steine auf diesem Brett (verlängern die Par-Zeit). */
  hiddenCount?: number;
  /** Anteil der Vierer-Sorten (0–1, Level-Kampagne): Fallen kosten Bedenkzeit. */
  vierer?: number;
}

/** Zuschlag auf die Par-Zeit bei vollem Vierer-Deck (+30 %). */
const VIERER_ZUSCHLAG = 0.3;

/** Zuschlag je verdecktem Stein: einmal aufdecken, merken, wiederfinden. */
const HIDDEN_BONUS_MS = 2500;

// Par-Zeit für 3 Sterne: 4 Sekunden pro Paar.
//
// Verdeckte Steine kosten Zeit, die nichts mit Können zu tun hat — ohne
// Zuschlag fiele in genau diesen Leveln die Drei-Sterne-Quote, und zwar ohne
// dass der Spieler schlechter geworden wäre.
//
// Dasselbe gilt seit 18.10.2026 für die Vierer-Fallen: Wer vor dem Zug abwägt,
// welches der beiden passenden Paare er nimmt, spielt besser, nicht langsamer.
export function parTimeMs(tileCount: number, hiddenCount = 0, vierer = 0): number {
  return (tileCount / 2) * 4000 * (1 + VIERER_ZUSCHLAG * vierer) + hiddenCount * HIDDEN_BONUS_MS;
}

export function starsFor(stats: LevelStats): 1 | 2 | 3 {
  const par = parTimeMs(stats.tileCount, stats.hiddenCount ?? 0, stats.vierer ?? 0);
  if (stats.helpUsed === 0 && stats.elapsedMs <= par) return 3;
  if (stats.helpUsed <= 1 && stats.elapsedMs <= par * 1.8) return 2;
  return 1;
}

// Münzen für ein abgeschlossenes Level.
export function coinsFor(stars: number): number {
  // Seit 1.2.0 bewusst knapp: 1★=5, 2★=10, 3★=15. Eine bezahlte Hilfe (100–250)
  // ist damit viele Level wert; das Video bleibt die Alternative.
  return 5 * stars;
}

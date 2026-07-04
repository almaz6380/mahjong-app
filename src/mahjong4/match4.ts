// Match über eine Ostrunde: Punktestand, Dealer-Rotation, Rundenende.

import type { WinResult } from './engine4';

export interface MatchState {
  scores: number[]; // 4 Spieler
  dealer: number;
  hand: number; // laufende Handnummer (1-basiert)
  rotations: number; // wie oft der Dealer weitergegeben wurde
  over: boolean;
}

export function createMatch(startDealer = 0): MatchState {
  return { scores: [0, 0, 0, 0], dealer: startDealer, hand: 1, rotations: 0, over: false };
}

// Ergebnis einer Hand verbuchen (zero-sum) und Dealer/Runde fortschreiben.
export function applyResult(match: MatchState, result: WinResult, points: number): MatchState {
  const scores = match.scores.slice();
  const v = Math.max(1, points);

  if (result.winner != null) {
    if (result.fromDiscard == null) {
      // Selbstzug: alle drei zahlen v
      for (let p = 0; p < 4; p++) if (p !== result.winner) scores[p] -= v;
      scores[result.winner] += 3 * v;
    } else {
      // Abwurf-Gewinn: der Abwerfer zahlt alles
      scores[result.fromDiscard] -= 3 * v;
      scores[result.winner] += 3 * v;
    }
  }

  // Dealer bleibt bei Dealer-Sieg oder Abbruch, sonst Rotation.
  const dealerKeeps = result.winner === match.dealer || result.winner == null;
  let dealer = match.dealer;
  let rotations = match.rotations;
  if (!dealerKeeps) {
    dealer = (dealer + 1) % 4;
    rotations += 1;
  }
  const over = rotations >= 4; // Ostrunde: eine volle Dealer-Runde

  return { scores, dealer, hand: match.hand + 1, rotations, over };
}

export function standings(match: MatchState): number[] {
  // Spieler-Indizes nach Punkten absteigend.
  return [0, 1, 2, 3].sort((a, b) => match.scores[b] - match.scores[a]);
}

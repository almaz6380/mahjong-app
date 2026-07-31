import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { TileCode } from './tiles4';
import {
  createGame, draw, discard, canWinSelfDraw, declareWin, claimsFor, applyClaim, passClaims,
  type GameState, type ClaimOption,
} from './engine4';
import { chooseDiscard, decideClaim, type Difficulty } from './ai';
import { scoreWin, coinsForWin, type ScoreResult } from './scoring4';
import { createMatch, applyResult, type MatchState } from './match4';
import { playTap, playMatch, playWin } from '../audio/sound';
import { watchRewardedAd } from '../ui/reward';

type ClaimType = 'win' | 'kong' | 'pung' | 'chow';
interface AiClaim { player: number; type: ClaimType; tiles?: [TileCode, TileCode]; dist: number; prio: number }

export type Interaction =
  | { kind: 'discard' }
  | { kind: 'claim'; option: ClaimOption }
  | { kind: 'handEnd' }
  | { kind: 'matchEnd' }
  | null;

const AI_DELAY = 650;
const prioOf = (t: string) => (t === 'win' ? 3 : t === 'chow' ? 1 : 2);

export function useMahjong4(opts: {
  addCoins: (n: number) => void;
  difficulty?: Difficulty;
  onHandResult?: (won: boolean, faan: number) => void;
}) {
  const [, bump] = useReducer((x) => x + 1, 0);
  const rand = useRef<() => number>(Math.random);
  const diff = useRef<Difficulty>(opts.difficulty ?? 'normal');
  diff.current = opts.difficulty ?? 'normal';
  const stateRef = useRef<GameState>(createGame(0, rand.current));
  const matchRef = useRef<MatchState>(createMatch(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAi = useRef<AiClaim | null>(null);

  const [interaction, setInteraction] = useState<Interaction>(null);
  const [handResult, setHandResult] = useState<{ winner: number | null; score: ScoreResult | null } | null>(null);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [suggested, setSuggested] = useState<TileCode | null>(null);

  const interactionRef = useRef<Interaction>(null);
  interactionRef.current = interaction;

  const schedule = useCallback((fn: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, AI_DELAY);
  }, []);

  const bestAiClaim = useCallback((g: GameState): AiClaim | null => {
    let best: AiClaim | null = null;
    for (let p = 1; p < 4; p++) {
      const opt = claimsFor(g, p);
      if (!opt) continue;
      const dec = decideClaim(g, opt, diff.current);
      if (!dec) continue;
      const dist = (p - g.lastDiscard!.from + 4) % 4;
      const cand: AiClaim = { player: p, type: dec.type, tiles: dec.tiles, dist, prio: prioOf(dec.type) };
      if (!best || cand.prio > best.prio || (cand.prio === best.prio && cand.dist < best.dist)) best = cand;
    }
    return best;
  }, []);

  const applyAiThenDiscard = useCallback((g: GameState, ai: AiClaim) => {
    applyClaim(g, ai.player, ai.type, ai.tiles);
    if (g.phase === 'over') { playWin(); bump(); drive(); return; }
    playMatch();
    schedule(() => {
      discard(g, chooseDiscard(g, g.turn, diff.current));
      playTap(false); // Gegner-Abwurf: Klang ja, Vibration nein
      bump();
      drive();
    });
  }, [schedule]);

  // Haupt-Treiber
  const drive = useCallback(() => {
    const g = stateRef.current;
    if (interactionRef.current) return;
    if (matchRef.current.over) { setInteraction({ kind: 'matchEnd' }); interactionRef.current = { kind: 'matchEnd' }; return; }

    if (g.phase === 'over') {
      const r = g.result!;
      let score: ScoreResult | null = null;
      if (r.winner != null) {
        score = scoreWin(g, r.winner);
        if (r.winner === 0) {
          const c = coinsForWin(score.faan);
          opts.addCoins(c);
          setCoinsEarned((x) => x + c);
        }
      }
      opts.onHandResult?.(r.winner === 0, r.winner === 0 && score ? score.faan : 0);
      setHandResult({ winner: r.winner, score });
      setInteraction({ kind: 'handEnd' });
      interactionRef.current = { kind: 'handEnd' };
      return;
    }

    if (g.phase === 'draw') {
      if (g.turn === 0) {
        const t = draw(g);
        bump();
        // draw() kann g.phase auf 'over' mutieren (leere Mauer) — TS sieht das nicht.
        if ((g.phase as string) === 'over') { drive(); return; }
        if (t && canWinSelfDraw(g, 0)) { declareWin(g, 0, null, t); playWin(); bump(); drive(); return; }
        setSuggested(null);
        setInteraction({ kind: 'discard' });
        interactionRef.current = { kind: 'discard' };
      } else {
        schedule(() => {
          const t = draw(g);
          if (g.phase === 'over') { bump(); drive(); return; }
          if (t && canWinSelfDraw(g, g.turn)) { declareWin(g, g.turn, null, t); playWin(); bump(); drive(); return; }
          discard(g, chooseDiscard(g, g.turn, diff.current));
          playTap(false); // Gegner-Abwurf: Klang ja, Vibration nein
          bump();
          drive();
        });
      }
      return;
    }

    if (g.phase === 'claim') {
      const humanOpt = claimsFor(g, 0);
      const ai = bestAiClaim(g);
      if (humanOpt) {
        pendingAi.current = ai;
        setInteraction({ kind: 'claim', option: humanOpt });
        interactionRef.current = { kind: 'claim', option: humanOpt };
      } else if (ai) {
        schedule(() => applyAiThenDiscard(g, ai));
      } else {
        schedule(() => { passClaims(g); bump(); drive(); });
      }
    }
  }, [opts, schedule, bestAiClaim, applyAiThenDiscard]);

  // Start / Cleanup
  useEffect(() => {
    drive();
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Aktionen des Menschen ---
  const discardHuman = useCallback((tile: TileCode) => {
    if (interactionRef.current?.kind !== 'discard') return;
    const g = stateRef.current;
    if (!discard(g, tile)) return;
    playTap();
    setSuggested(null);
    setInteraction(null);
    interactionRef.current = null;
    bump();
    drive();
  }, [drive]);

  const resolveHuman = useCallback((humanChoice: AiClaim | null) => {
    const g = stateRef.current;
    const ai = pendingAi.current;
    pendingAi.current = null;
    setInteraction(null);
    interactionRef.current = null;

    // Gewinner nach Priorität/Distanz
    let winner: AiClaim | null = null;
    for (const c of [humanChoice, ai]) {
      if (!c) continue;
      if (!winner || c.prio > winner.prio || (c.prio === winner.prio && c.dist < winner.dist)) winner = c;
    }
    if (!winner) { passClaims(g); bump(); drive(); return; }
    if (winner.player === 0) {
      applyClaim(g, 0, winner.type, winner.tiles);
      if (g.phase === 'over') { playWin(); bump(); drive(); return; }
      playMatch();
      bump();
      // Mensch muss abwerfen
      setInteraction({ kind: 'discard' });
      interactionRef.current = { kind: 'discard' };
    } else {
      applyAiThenDiscard(g, winner);
    }
  }, [drive, applyAiThenDiscard]);

  const claimHuman = useCallback((type: ClaimType, tiles?: [TileCode, TileCode]) => {
    if (interactionRef.current?.kind !== 'claim') return;
    const g = stateRef.current;
    const dist = (0 - g.lastDiscard!.from + 4) % 4;
    resolveHuman({ player: 0, type, tiles, dist, prio: prioOf(type) });
  }, [resolveHuman]);

  const passHuman = useCallback(() => {
    if (interactionRef.current?.kind !== 'claim') return;
    resolveHuman(null);
  }, [resolveHuman]);

  const continueHand = useCallback(() => {
    const g = stateRef.current;
    const next = applyResult(matchRef.current, g.result!, handResult?.score?.points ?? 0);
    matchRef.current = next;
    setHandResult(null);
    setInteraction(null);
    interactionRef.current = null;
    if (next.over) { setInteraction({ kind: 'matchEnd' }); interactionRef.current = { kind: 'matchEnd' }; bump(); return; }
    stateRef.current = createGame(next.dealer, rand.current);
    bump();
    drive();
  }, [drive, handResult]);

  const hint = useCallback(async () => {
    if (interactionRef.current?.kind !== 'discard') return;
    const ok = await watchRewardedAd();
    if (ok) setSuggested(chooseDiscard(stateRef.current, 0, 'hard'));
  }, []);

  return {
    state: stateRef.current,
    match: matchRef.current,
    interaction,
    handResult,
    coinsEarned,
    suggested,
    discardHuman,
    claimHuman,
    passHuman,
    continueHand,
    hint,
  };
}

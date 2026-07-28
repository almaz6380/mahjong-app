import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { draw, discard, declareWin, seatWind, type GameState } from './engine4';
import { isTenpai } from './win';
import { chooseDiscard } from './ai';
import { tileIndex, type TileCode } from './tiles4';
import { createRiichiGame, canRiichiWin, isFuriten, scoreRiichi, type RiichiExtra } from './riichiGame';
import type { Scored } from './riichi';
import { playTap, playMatch, playWin } from '../audio/sound';

const AI_DELAY = 620;

export type RInteraction =
  | { kind: 'discard'; canTsumo: boolean; canRiichi: boolean }
  | { kind: 'ron'; tile: TileCode; from: number }
  | { kind: 'over' }
  | null;

export interface RResult { winner: number | null; scored: Scored | null; tsumo: boolean; winTile: TileCode | null }

// Gibt es einen Abwurf, der die Hand in Tenpai bringt? (für Riichi-Ansage)
function canReachTenpai(hand: TileCode[], melds: number): boolean {
  const seen = new Set<string>();
  for (const tile of hand) {
    if (seen.has(tile)) continue; seen.add(tile);
    const rest = hand.slice(); rest.splice(rest.indexOf(tile), 1);
    if (isTenpai(rest, melds)) return true;
  }
  return false;
}

export function useRiichi(opts: { addCoins: (n: number) => void; onResult?: (won: boolean) => void }) {
  const [, bump] = useReducer((x) => x + 1, 0);
  const rand = useRef<() => number>(Math.random);
  const init = useRef(createRiichiGame(0, rand.current));
  const gRef = useRef<GameState>(init.current.state);
  const exRef = useRef<RiichiExtra>(init.current.extra);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [interaction, setInteraction] = useState<RInteraction>(null);
  const iRef = useRef<RInteraction>(null); iRef.current = interaction;
  const [result, setResult] = useState<RResult | null>(null);
  const [coinsEarned, setCoinsEarned] = useState(0);

  const schedule = (fn: () => void) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(fn, AI_DELAY); };

  const win = useCallback((player: number, tile: TileCode, tsumo: boolean) => {
    const g = gRef.current, ex = exRef.current;
    declareWin(g, player, tsumo ? null : g.lastDiscard?.from ?? null, tile);
    const scored = scoreRiichi(g, ex, player, tile, tsumo);
    if (player === 0 && scored.points > 0) {
      const c = Math.max(5, Math.round(scored.points / 100));
      opts.addCoins(c); setCoinsEarned((x) => x + c);
    }
    playWin();
    opts.onResult?.(player === 0);
    setResult({ winner: player, scored, tsumo, winTile: tile });
    setInteraction({ kind: 'over' }); iRef.current = { kind: 'over' };
    bump();
  }, [opts]);

  const endDraw = useCallback(() => {
    setResult({ winner: null, scored: null, tsumo: false, winTile: null });
    setInteraction({ kind: 'over' }); iRef.current = { kind: 'over' };
    bump();
  }, []);

  const drive = useCallback(() => {
    const g = gRef.current;
    if (iRef.current) return;
    if (g.phase === 'over') { endDraw(); return; }
    if (g.phase !== 'draw') return;

    if (g.turn === 0) {
      const t = draw(g); bump();
      if ((g.phase as string) === 'over') { endDraw(); return; }
      const canTsumo = !!t && canRiichiWin(g, exRef.current, 0, t, true);
      if (exRef.current.riichi[0] && !canTsumo) {
        // Riichi gesperrt -> gezogenen Stein automatisch abwerfen
        schedule(() => { discard(g, t!); playTap(); bump(); afterDiscard(0, t!); });
        return;
      }
      const pl = g.players[0];
      const canRiichi = !exRef.current.riichi[0] && pl.melds.length === 0 && canReachTenpai(pl.hand, 0);
      setInteraction({ kind: 'discard', canTsumo, canRiichi });
      iRef.current = { kind: 'discard', canTsumo, canRiichi };
    } else {
      schedule(() => aiTurn(g.turn));
    }
  }, [endDraw]);

  const aiTurn = useCallback((p: number) => {
    const g = gRef.current, ex = exRef.current;
    const t = draw(g); bump();
    if ((g.phase as string) === 'over') { endDraw(); return; }
    if (t && canRiichiWin(g, ex, p, t, true)) { win(p, t, true); return; }
    let disc: TileCode;
    if (ex.riichi[p]) disc = t!;
    else {
      disc = chooseDiscard(g, p, 'normal');
      if (g.players[p].melds.length === 0 && canReachTenpai(g.players[p].hand, 0) && rand.current() < 0.85) {
        ex.riichi[p] = true; // Riichi ansagen (der gewählte Abwurf hält i.d.R. Tenpai)
      }
    }
    discard(g, disc); playTap(false); bump(); // Gegner-Abwurf: Klang ja, Vibration nein
    afterDiscard(p, disc);
  }, [win, endDraw]);

  const afterDiscard = useCallback((from: number, tile: TileCode) => {
    const g = gRef.current, ex = exRef.current;
    for (let k = 1; k < 4; k++) {
      const p = (from + k) % 4;
      if (canRiichiWin(g, ex, p, tile, false) && !isFuriten(g, p)) {
        if (p === 0) { setInteraction({ kind: 'ron', tile, from }); iRef.current = { kind: 'ron', tile, from }; bump(); return; }
        win(p, tile, false); return;
      }
    }
    // niemand ront -> nächster Spieler
    g.turn = (from + 1) % 4; g.phase = 'draw'; g.lastDiscard = null;
    bump(); drive();
  }, [win, drive]);

  useEffect(() => { drive(); return () => { if (timer.current) clearTimeout(timer.current); }; /* eslint-disable-next-line */ }, []);

  // --- Aktionen des Menschen ---
  const discardHuman = useCallback((tile: TileCode) => {
    if (iRef.current?.kind !== 'discard') return;
    const g = gRef.current;
    if (!discard(g, tile)) return;
    playTap(); setInteraction(null); iRef.current = null; bump();
    afterDiscard(0, tile);
  }, [afterDiscard]);

  const tsumo = useCallback(() => {
    if (iRef.current?.kind !== 'discard' || !iRef.current.canTsumo) return;
    win(0, gRef.current.lastDrawn!, true);
  }, [win]);

  const declareRiichi = useCallback(() => {
    if (iRef.current?.kind !== 'discard' || !iRef.current.canRiichi) return;
    exRef.current.riichi[0] = true; playMatch(); bump();
    setInteraction({ kind: 'discard', canTsumo: iRef.current.canTsumo, canRiichi: false });
    iRef.current = { kind: 'discard', canTsumo: false, canRiichi: false };
  }, []);

  const ron = useCallback(() => {
    if (iRef.current?.kind !== 'ron') return;
    win(0, iRef.current.tile, false);
  }, [win]);

  const passRon = useCallback(() => {
    if (iRef.current?.kind !== 'ron') return;
    const from = iRef.current.from;
    setInteraction(null); iRef.current = null;
    const g = gRef.current; g.turn = (from + 1) % 4; g.phase = 'draw'; g.lastDiscard = null;
    bump(); drive();
  }, [drive]);

  const newGame = useCallback(() => {
    const fresh = createRiichiGame(0, rand.current);
    gRef.current = fresh.state; exRef.current = fresh.extra;
    setResult(null); setInteraction(null); iRef.current = null; setCoinsEarned(0);
    bump(); drive();
  }, [drive]);

  return {
    state: gRef.current, extra: exRef.current, interaction, result, coinsEarned,
    seatWindOf: (p: number) => seatWind(gRef.current, p),
    doraIndicator: exRef.current.doraIndicator,
    discardHuman, tsumo, declareRiichi, ron, passRon, newGame,
    tileIndex,
  };
}

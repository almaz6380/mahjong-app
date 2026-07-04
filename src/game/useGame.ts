import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deckForCount } from './tiles';
import { LAYOUTS } from './layouts';
import {
  buildNeighbors,
  generateBoard,
  isFreeIdx,
  reshuffleBoard,
  type FadeTile,
  type Neighbors,
  type PlacedTile,
} from './engine';

interface GameOptions {
  onMatch?: () => void;
  onInvalid?: () => void;
  onSelect?: () => void;
  onWin?: () => void;
  initial?: { tiles: PlacedTile[]; elapsedMs: number; helpUsed: number };
}

export function useGame(initialLayout = 'classic', opts: GameOptions = {}) {
  const nbRef = useRef<Neighbors>(buildNeighbors(LAYOUTS[initialLayout].cells));
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [tiles, setTiles] = useState<PlacedTile[]>(
    () =>
      opts.initial?.tiles ??
      generateBoard(LAYOUTS[initialLayout].cells, nbRef.current, deckForCount(LAYOUTS[initialLayout].cells.length)),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<[number, number][]>([]);
  const [hintPair, setHintPair] = useState<[number, number] | null>(null);
  const [fading, setFading] = useState<FadeTile[]>([]);

  // Für die Sterne-Wertung: Startzeit und genutzte Hilfen (Tipp + Mischen).
  const startedAt = useRef<number>(opts.initial ? Date.now() - opts.initial.elapsedMs : Date.now());
  const helpUsed = useRef<number>(opts.initial?.helpUsed ?? 0);

  // present-Maske und freie Steine aus dem aktuellen Board ableiten.
  const present = useMemo(() => {
    const p = new Uint8Array(tiles.length);
    for (const t of tiles) if (!t.removed) p[t.key] = 1;
    return p;
  }, [tiles]);

  const freeSet = useMemo(() => {
    const s = new Set<number>();
    for (const t of tiles) {
      if (!t.removed && isFreeIdx(t.key, present, nbRef.current)) s.add(t.key);
    }
    return s;
  }, [tiles, present]);

  const remaining = useMemo(() => tiles.reduce((n, t) => n + (t.removed ? 0 : 1), 0), [tiles]);
  const won = remaining === 0 && tiles.length > 0;

  const wonFired = useRef(false);
  useEffect(() => {
    if (won && !wonFired.current) {
      wonFired.current = true;
      optsRef.current.onWin?.();
    }
  }, [won]);

  const byKey = useCallback((k: number) => tiles.find((t) => t.key === k), [tiles]);

  // Gibt es überhaupt noch einen gültigen Zug?
  const hasMoves = useMemo(() => {
    const seen = new Set<string>();
    for (const k of freeSet) {
      const mk = byKey(k)!.face.matchKey;
      if (seen.has(mk)) return true;
      seen.add(mk);
    }
    return false;
  }, [freeSet, byKey]);

  const clickTile = useCallback(
    (key: number) => {
      if (won) return;
      setHintPair(null);
      const t = byKey(key);
      if (!t || t.removed || !freeSet.has(key)) return;

      if (selected === null) {
        setSelected(key);
        optsRef.current.onSelect?.();
        return;
      }
      if (selected === key) {
        setSelected(null);
        return;
      }
      const s = byKey(selected);
      if (s && s.face.matchKey === t.face.matchKey) {
        // Fade-Animation für das entfernte Paar
        const fade: FadeTile[] = [s, t].map((x) => ({
          key: x.key,
          col: x.col,
          row: x.row,
          layer: x.layer,
          faceId: x.face.id,
        }));
        setFading((f) => [...f, ...fade]);
        setTimeout(() => setFading((f) => f.filter((x) => x.key !== key && x.key !== selected)), 260);

        setTiles((prev) =>
          prev.map((x) => (x.key === key || x.key === selected ? { ...x, removed: true } : x)),
        );
        setHistory((h) => [...h, [selected, key]]);
        setSelected(null);
        optsRef.current.onMatch?.();
      } else {
        setSelected(key); // Auswahl umschalten
        optsRef.current.onInvalid?.();
      }
    },
    [won, byKey, freeSet, selected],
  );

  const newGame = useCallback((layoutName = initialLayout) => {
    const lay = LAYOUTS[layoutName] ?? LAYOUTS[initialLayout];
    nbRef.current = buildNeighbors(lay.cells);
    setTiles(generateBoard(lay.cells, nbRef.current, deckForCount(lay.cells.length)));
    setSelected(null);
    setHistory([]);
    setHintPair(null);
    startedAt.current = Date.now();
    helpUsed.current = 0;
  }, [initialLayout]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const [a, b] = h[h.length - 1];
      setTiles((prev) =>
        prev.map((x) => (x.key === a || x.key === b ? { ...x, removed: false } : x)),
      );
      setSelected(null);
      setHintPair(null);
      return h.slice(0, -1);
    });
  }, []);

  const hint = useCallback(() => {
    const free = [...freeSet];
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (byKey(free[i])!.face.matchKey === byKey(free[j])!.face.matchKey) {
          setHintPair([free[i], free[j]]);
          helpUsed.current += 1;
          return;
        }
      }
    }
    setHintPair(null);
  }, [freeSet, byKey]);

  const shuffle = useCallback(() => {
    setTiles((prev) => reshuffleBoard(prev, nbRef.current));
    setSelected(null);
    setHintPair(null);
    helpUsed.current += 1;
  }, []);

  // Momentaufnahme für die Wertung (Zeit + genutzte Hilfen).
  const snapshot = useCallback(
    () => ({ elapsedMs: Date.now() - startedAt.current, helpUsed: helpUsed.current }),
    [],
  );

  return {
    tiles,
    fading,
    freeSet,
    selected,
    hintPair,
    remaining,
    tileCount: tiles.length,
    won,
    hasMoves,
    canUndo: history.length > 0,
    clickTile,
    newGame,
    undo,
    hint,
    shuffle,
    snapshot,
  };
}

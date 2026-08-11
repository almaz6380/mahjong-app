import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deckForCount, isPair } from './tiles';
import { getLayout } from './layouts';
import {
  buildNeighbors,
  generateBoardWithPairs,
  isFreeIdx,
  reshuffleBoard,
  type FadeTile,
  type Neighbors,
  type PlacedTile,
} from './engine';
import { applyHidden, KEINE_MODS, type LevelMods } from './modifiers';

/** Wie lange ein angetippter verdeckter Stein offen liegt. */
export const PEEK_MS = 900;

interface GameOptions {
  // Bekommt die beiden entfernten Steine (z. B. fürs Mythen-Album).
  onMatch?: (a?: PlacedTile, b?: PlacedTile) => void;
  onInvalid?: () => void;
  onSelect?: () => void;
  onWin?: () => void;
  initial?: { tiles: PlacedTile[]; elapsedMs: number; helpUsed: number };
  /**
   * Modifikatoren für ein NEU erzeugtes Brett.
   *
   * ⚠ Greifen ausschliesslich im Erzeugungspfad. Beim Fortsetzen aus `initial`
   * stecken sie bereits im gespeicherten Brett — würde man sie dort erneut
   * anwenden, bekäme eine laufende Partie beim Laden neue Verdeckungen.
   * Ohne diese Option verhält sich `useGame` exakt wie vorher; sechs Modi
   * hängen daran.
   */
  mods?: LevelMods;
}

export function useGame(initialLayout = 'classic', opts: GameOptions = {}) {
  // Beim Fortsetzen die Nachbarschaft aus den GESPEICHERTEN Steinen bauen
  // (nach Layout-Index sortiert = key-Reihenfolge). So bleibt eine alte
  // Session auch dann korrekt, wenn sich die Level-Rampe geändert hat.
  const nbRef = useRef<Neighbors>(
    buildNeighbors(
      opts.initial?.tiles
        ? opts.initial.tiles
            .slice()
            .sort((a, b) => a.key - b.key)
            .map((t) => ({ col: t.col, row: t.row, layer: t.layer }))
        : getLayout(initialLayout).cells,
    ),
  );
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Ein frisches Brett samt Modifikatoren. `pairs` (die Lösungspaarung) wird ab
  // Etappe 3 für die Spezialsteine gebraucht.
  const frischesBrett = useCallback((layoutName: string, mods: LevelMods) => {
    const lay = getLayout(layoutName);
    // Nachbarschaft gehört zum Layout — beide Pfade (Erstaufbau und `newGame`)
    // müssen sie zusammen mit dem Brett setzen, sonst rechnet `isFreeIdx` gegen
    // das Layout der Vorrunde.
    nbRef.current = buildNeighbors(lay.cells);
    const { tiles: roh } = generateBoardWithPairs(lay.cells, nbRef.current, deckForCount(lay.cells.length));
    return applyHidden(roh, mods.hidden);
  }, []);

  const [tiles, setTiles] = useState<PlacedTile[]>(
    () => opts.initial?.tiles ?? frischesBrett(initialLayout, opts.mods ?? KEINE_MODS),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<[number, number][]>([]);
  const [hintPair, setHintPair] = useState<[number, number] | null>(null);
  const [fading, setFading] = useState<FadeTile[]>([]);

  // Kurzzeitig aufgedeckte verdeckte Steine. Bewusst NUR zur Laufzeit und NICHT
  // in der Session: Nach einem App-Neustart soll wieder alles zu sein, sonst
  // waere das Gedaechtnisspiel mit einem Neustart ausgehebelt.
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const peekTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  // Timer beim Verlassen abraeumen — sonst feuert ein setTimeout in eine
  // abgebaute Komponente und React meldet ein Update auf einem toten Baum.
  useEffect(() => {
    const timers = peekTimers.current;
    return () => {
      for (const id of timers.values()) clearTimeout(id);
      timers.clear();
    };
  }, []);

  /** Deckt einen verdeckten Stein fuer `PEEK_MS` auf. */
  const peek = useCallback((key: number, dauer = PEEK_MS) => {
    const alt = peekTimers.current.get(key);
    if (alt) clearTimeout(alt);
    setRevealed((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    peekTimers.current.set(
      key,
      setTimeout(() => {
        peekTimers.current.delete(key);
        setRevealed((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, dauer),
    );
  }, []);

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
  //
  // Paarweise statt über ein Set von matchKeys: Ein Joker passt zu JEDEM Stein,
  // ihn könnte ein Set nicht abbilden. `freeSet` ist klein (meist < 20), der
  // doppelte Durchlauf kostet also nichts.
  //
  // ⚠ Diese Prüfung bleibt bewusst allwissend und ignoriert `hidden`: Sie
  // beantwortet „ist das Brett tot?", nicht „weiß der Spieler von einem Zug?".
  // Würde sie verdeckte Steine ausklammern, meldete das Spiel Sackgassen, die
  // keine sind, und böte grundlos ein neues Brett an.
  const hasMoves = useMemo(() => {
    const free = [...freeSet].map((k) => byKey(k)!).filter(Boolean);
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (isPair(free[i], free[j])) return true;
      }
    }
    return false;
  }, [freeSet, byKey]);

  const clickTile = useCallback(
    (key: number) => {
      if (won) return;
      setHintPair(null);
      const t = byKey(key);
      if (!t || t.removed || !freeSet.has(key)) return;

      // Ein Tipp auf einen verdeckten Stein deckt ihn auf UND waehlt ihn aus.
      // Kein getrennter „Guck-Modus": Man bekommt nie zwei verdeckte Steine
      // gleichzeitig zu sehen, ausser im Moment des Zugversuchs — genau das ist
      // die Gedaechtnisarbeit. Sie kostet Zeit, und Zeit zaehlt (Sterne im
      // Level, Countdown im Blitz).
      if (t.hidden) peek(key);

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
      if (s && isPair(s, t)) {
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
        optsRef.current.onMatch?.(s, t);
      } else {
        // Fehlversuch: beide kurz zeigen, dann wieder zu — der Memory-Takt.
        if (s?.hidden) peek(s.key, 700);
        setSelected(key); // Auswahl umschalten
        optsRef.current.onInvalid?.();
      }
    },
    [won, byKey, freeSet, selected, peek],
  );

  const newGame = useCallback((layoutName = initialLayout) => {
    setTiles(frischesBrett(layoutName, optsRef.current.mods ?? KEINE_MODS));
    setSelected(null);
    setHistory([]);
    setHintPair(null);
    setRevealed(new Set());
    startedAt.current = Date.now();
    helpUsed.current = 0;
  }, [initialLayout, frischesBrett]);

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

  // Nicht mehr „das erste Paar gewinnt", sondern „das offenste Paar gewinnt".
  //
  // Der Tipp darf nicht spoilern: Zeigte er auf zwei verdeckte Steine, hätte er
  // die Gedächtnisaufgabe nebenbei gelöst. Er bevorzugt deshalb Paare, bei denen
  // nichts verdeckt ist. Bleibt am Ende nur noch ein verdecktes Paar übrig,
  // deckt er beide auf — ein bezahlter Booster muss liefern, sonst kauft ihn
  // niemand ein zweites Mal.
  const hint = useCallback(() => {
    const free = [...freeSet];
    let bestes: [number, number] | null = null;
    let bestVerdeckt = 99;
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const a = byKey(free[i])!;
        const b = byKey(free[j])!;
        if (!isPair(a, b)) continue;
        const verdeckt = (a.hidden ? 1 : 0) + (b.hidden ? 1 : 0);
        if (verdeckt < bestVerdeckt) {
          bestVerdeckt = verdeckt;
          bestes = [free[i], free[j]];
          if (verdeckt === 0) break;
        }
      }
      if (bestVerdeckt === 0) break;
    }
    if (!bestes) {
      setHintPair(null);
      return;
    }
    setHintPair(bestes);
    // Verdeckte Steine im Tipp laufen NICHT nach PEEK_MS zu: Der Spieler soll
    // den gezeigten Zug auch ausführen können.
    for (const k of bestes) if (byKey(k)!.hidden) peek(k, 30000);
    helpUsed.current += 1;
  }, [freeSet, byKey, peek]);

  // Gibt zurück, ob das Mischen etwas bewirkt hat. Bei einem Rest, für den es
  // KEINE lösbare Verteilung mehr gibt (z. B. das letzte Paar liegt gestapelt),
  // liefert reshuffleBoard dasselbe Brett zurück – dann darf weder ein Booster
  // verbraucht werden noch soll die Oberfläche endlos weiter mischen.
  const shuffle = useCallback((): boolean => {
    const next = reshuffleBoard(tiles, nbRef.current);
    if (next === tiles) return false;
    setTiles(next);
    setSelected(null);
    setHintPair(null);
    helpUsed.current += 1;
    return true;
  }, [tiles]);

  // Momentaufnahme für die Wertung (Zeit + genutzte Hilfen).
  const snapshot = useCallback(
    () => ({ elapsedMs: Date.now() - startedAt.current, helpUsed: helpUsed.current }),
    [],
  );

  return {
    tiles,
    fading,
    freeSet,
    revealed,
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

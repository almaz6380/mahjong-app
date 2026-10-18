// Level-Modifikatoren: verdeckte Steine und Spezialsteine.
//
// Deterministisch aus der Levelnummer abgeleitet — dasselbe Muster wie die
// Figuren und die Tages-Challenge. Wichtig aus zwei Gründen: Wer ein Level
// wiederholt, findet dieselbe Aufgabe vor, und im Test ist alles reproduzierbar.
// Die MOTIVE bleiben `Math.random`, nur Art und Menge der Modifikatoren liegen
// fest.
//
// ═══ Die Paritätsregel — das Wichtigste an dieser Datei ═══
//
// `makePairs` in engine.ts lässt bei ungerader Gruppengröße den Rest liegen
// (`i + 1 < g.length`). Hat eine matchKey-Gruppe auf dem Brett eine UNGERADE
// Zahl von Steinen, ist das `pairs`-Array kürzer als die Zahl der Positionen —
// `assignSolvable` läuft darüber hinaus. Seit dem 11.08.2026 fängt eine
// Schutzzeile das ab (vorher: TypeError bis in die Oberfläche, weißer
// Bildschirm, weil Blitz und Zen bei Sackgassen selbsttätig mischen).
//
// Auch mit dem Riegel gilt: **Jede matchKey-Gruppe auf dem Brett muss gerade
// bleiben.** Sonst ist das Brett unlösbar und kein Mischen repariert es.
// Daraus folgt die Bauform aller Spezialsteine:
//
//   Spezialsteine treten als PAAR auf und ersetzen ein LÖSUNGSPAAR.
//
// Nicht zwei beliebige Steine derselben Gruppe: Dann bliebe die Parität zwar
// heil, aber der rückwärts konstruierte Lösungsweg wäre zerstört — die früheren
// Partner der beiden fänden einander nicht mehr. Ersetzt man genau das Paar,
// das `assignSolvable` einander zugewiesen hat, bleibt die Entfernungs-
// Reihenfolge Zug für Zug gültig.

import {
  generateBoardWithPairs,
  mulberry32,
  seedFromString,
  zufallsSiege,
  type Neighbors,
  type PlacedTile,
  type Rng,
} from './engine';
import type { Cell } from './layouts';
import { deckForCount, deckForLevel, specialFace, type SpecialKind } from './tiles';

/** Ab hier tauchen verdeckte Steine auf. Davor lernt man erst das Spiel. */
export const HIDDEN_FROM_LEVEL = 30;
/** Ab hier zusätzlich Spezialsteine. */
export const SPECIAL_FROM_LEVEL = 50;

/** Höchstanteil verdeckter Steine am Brett — mehr wird zum Ratespiel. */
const HIDDEN_MAX_SHARE = 0.22;
/** Höchstzahl Spezial-PAARE je Brett. */
const SPECIAL_MAX_PAIRS = 2;

export interface LevelMods {
  /** Anzahl verdeckter Steine. */
  hidden: number;
  /** Sonderwirkungen; je Eintrag ein PAAR gleichartiger Steine. */
  specials: SpecialKind[];
  /** Anteil der Sorten, die viermal liegen (0–1), siehe `deckForLevel`. */
  vierer?: number;
  /**
   * Wie viele lösbare Verteilungen erzeugt werden; genommen wird die, deren
   * Zufallsquote (`zufallsSiege`) `zielQuote` am nächsten liegt. 1 = wie früher.
   */
  kandidaten?: number;
  /** Gewünschte Gewinnquote des planlosen Spielers (0–1), siehe `zielQuote()`. */
  zielQuote?: number;
}

export const KEINE_MODS: LevelMods = { hidden: 0, specials: [] };

/**
 * Kontext des Modus. Bestimmt, welche Spezialsteine überhaupt sinnvoll sind.
 *
 * ⚠ `timed` heißt „es läuft ein Countdown" und trifft nur auf den Zeit-Blitz zu.
 * Die Tages-Challenge hat KEINE Uhr — sie wird aber über `starsFor` gegen
 * `parTimeMs` bewertet, dort wirkt ein Zeitbonus über `rated`.
 */
export interface ModKontext {
  /** Wird die Zeit für die Sternwertung gemessen? (Level, Tages-Challenge) */
  rated?: boolean;
  /** Läuft ein Countdown? (nur Zeit-Blitz) */
  timed?: boolean;
  /**
   * Level-Kampagne: zusätzlich Vierer-Fallen und Auswahl der härtesten
   * Verteilung. Bewusst nur dort — Tages-Challenge, Blitz und Co. bleiben wie sie sind.
   */
  kampagne?: boolean;
}

/** Ab hier liegen erste Sorten viermal auf dem Brett. */
export const VIERER_FROM_LEVEL = 15;
/** Ab hier liegt jede Sorte viermal. */
export const VIERER_VOLL_LEVEL = 100;

/**
 * Schwierigkeit der Level-Kampagne (seit 18.10.2026). Vorher gewann ein
 * planloser Zufallsspieler bis Level ~150 über 90 % der Bretter — man konnte
 * praktisch nicht verlieren. Vierer-Deck + Kandidaten-Auswahl gegen die
 * Zielkurve (`zielQuote`) ergeben stattdessen ~90 % auf Level 1, ~60 % auf 50,
 * ~40 % auf 150 und ~25 % ab 300 (Prüfung: scripts/check-schwierigkeit.mjs).
 * Ein Mensch, der hinschaut, liegt deutlich darüber; die Zahlen messen nur,
 * wie viel Nachdenken ein Brett verlangt.
 */
export function haerteForLevel(level: number): { vierer: number; kandidaten: number; zielQuote: number } {
  const vierer =
    level < VIERER_FROM_LEVEL
      ? 0
      : Math.min(1, (level - VIERER_FROM_LEVEL + 1) / (VIERER_VOLL_LEVEL - VIERER_FROM_LEVEL + 1));
  const kandidaten = level < 10 ? 1 : level < 30 ? 4 : level < 100 ? 6 : level < 250 ? 8 : 10;
  return { vierer, kandidaten, zielQuote: zielQuote(level) };
}

/** Zielkurve: Gewinnquote des planlosen Spielers je Level. */
const ZIELKURVE: [number, number][] = [[1, 0.92], [50, 0.55], [150, 0.35], [300, 0.2]];
export function zielQuote(level: number): number {
  if (level <= ZIELKURVE[0][0]) return ZIELKURVE[0][1];
  for (let i = 1; i < ZIELKURVE.length; i++) {
    const [l1, q1] = ZIELKURVE[i];
    if (level <= l1) {
      const [l0, q0] = ZIELKURVE[i - 1];
      return q0 + ((q1 - q0) * (level - l0)) / (l1 - l0);
    }
  }
  return ZIELKURVE[ZIELKURVE.length - 1][1];
}

/** Zufallspartien je Kandidat — Rauschen ±10 %, reicht für die Auswahl. */
export const KANDIDATEN_PROBEN = 24;

/**
 * Brett der Level-Kampagne: `kandidaten` lösbare Verteilungen bauen und die
 * nehmen, deren Zufallsquote der Zielkurve am nächsten liegt. Bewusst nicht
 * einfach „die härteste“: Die Figuren sind unterschiedlich schwer (gemessen
 * zwischen 17 und 97 %), und mit der Zielkurve gleicht die Auswahl das aus —
 * eine zu leichte Figur bekommt eine harte Verteilung, eine sehr harte eine
 * mildere. So steigt die Kurve glatt, statt an jedem Größensprung zu zacken.
 *
 * Ohne `kandidaten` (alle anderen Modi) genau ein Brett, wie früher.
 */
export function kampagnenBrett(
  cells: Cell[],
  nb: Neighbors,
  mods: LevelMods,
  rand: Rng = Math.random,
): { tiles: PlacedTile[]; pairs: [number, number][] } {
  const kandidaten = Math.max(1, mods.kandidaten ?? 1);
  const deck = () => (mods.vierer ? deckForLevel(cells.length, mods.vierer, rand) : deckForCount(cells.length));
  if (kandidaten === 1) return generateBoardWithPairs(cells, nb, deck(), rand);
  const ziel = mods.zielQuote ?? 0;
  let bestes: { tiles: PlacedTile[]; pairs: [number, number][] } | null = null;
  let abstand = Infinity;
  for (let k = 0; k < kandidaten; k++) {
    const brett = generateBoardWithPairs(cells, nb, deck(), rand);
    const d = Math.abs(zufallsSiege(brett.tiles, nb, KANDIDATEN_PROBEN, rand) / KANDIDATEN_PROBEN - ziel);
    if (d < abstand) {
      abstand = d;
      bestes = brett;
    }
  }
  return bestes!;
}

export function modsForLevel(level: number, tileCount: number, ctx: ModKontext = {}): LevelMods {
  const rand = mulberry32(seedFromString('mods:' + level));

  // Verdeckt: ab Level 30 zwei Steine, danach je 25 Level einer mehr.
  let hidden = 0;
  if (level >= HIDDEN_FROM_LEVEL) {
    hidden = 2 + Math.floor((level - HIDDEN_FROM_LEVEL) / 25);
    hidden = Math.min(hidden, Math.floor(tileCount * HIDDEN_MAX_SHARE));
  }

  const specials: SpecialKind[] = [];
  if (level >= SPECIAL_FROM_LEVEL) {
    const anzahl = Math.min(SPECIAL_MAX_PAIRS, level >= 120 ? 2 : 1);
    // Der Zeitbonus kommt nur dort vor, wo Zeit überhaupt zählt — sonst wäre er
    // ein Blindgänger, den der Spieler zu Recht für kaputt hielte.
    const topf: SpecialKind[] = ['shuffle', 'joker', 'bomb'];
    if (ctx.timed || ctx.rated) topf.push('time');
    // Ohne Zurücklegen ziehen: Zwei gleiche Spezialsteine auf einem Brett sind
    // langweilig und sehen wie ein Fehler aus.
    for (let i = 0; i < anzahl && topf.length; i++) {
      specials.push(topf.splice(Math.floor(rand() * topf.length), 1)[0]);
    }
  }

  return ctx.kampagne ? { hidden, specials, ...haerteForLevel(level) } : { hidden, specials };
}

/**
 * Ersetzt je Sonderwirkung ein LÖSUNGSPAAR durch zwei Spezialsteine.
 *
 * `pairs` kommt aus `generateBoardWithPairs` und enthält die Positionen, die die
 * Rückwärtskonstruktion einander zugewiesen hat. Genau ein solches Paar zu
 * ersetzen ist der Kern der Sache: Die Parität jeder Motivgruppe bleibt heil
 * (die Gruppe verliert zwei Steine), und der Lösungsweg bleibt gültig, weil an
 * der Stelle, an der die Lösung dieses Paar entfernt hätte, jetzt beide
 * Spezialsteine frei liegen und zueinander passen.
 *
 * Zwei beliebige Steine derselben Gruppe zu nehmen wäre falsch: Die Parität
 * bliebe zwar heil, aber die früheren Partner der beiden fänden einander nicht
 * mehr.
 */
export function applySpecials(
  tiles: PlacedTile[],
  pairs: [number, number][],
  specials: SpecialKind[],
  rand: Rng = Math.random,
): PlacedTile[] {
  if (!specials.length || !pairs.length) return tiles;

  const frei = pairs.slice();
  for (let i = frei.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [frei[i], frei[j]] = [frei[j], frei[i]];
  }

  const belegt = new Map<number, SpecialKind>();
  specials.slice(0, frei.length).forEach((art, i) => {
    const [a, b] = frei[i];
    belegt.set(a, art);
    belegt.set(b, art);
  });
  if (!belegt.size) return tiles;

  return tiles.map((t) => {
    const art = belegt.get(t.key);
    return art ? { ...t, face: specialFace(art) } : t;
  });
}

/**
 * Setzt verdeckte Stellen auf ein fertiges Brett. Gibt ein NEUES Array zurück.
 *
 * Spezialsteine setzt diese Funktion NICHT — sie brauchen die Paarung aus
 * `assignSolvable` und werden deshalb bei der Bretterzeugung eingesetzt
 * (Etappe 3). Verdeckte Stellen sind davon unabhängig: Sie ändern nur, was der
 * Spieler sieht, nie welche Steine zueinander passen.
 */
export function applyHidden(tiles: PlacedTile[], anzahl: number, rand: Rng = Math.random): PlacedTile[] {
  if (anzahl <= 0) return tiles;

  // Spezialsteine bleiben offen — ein verdeckter Joker wäre für den Spieler
  // nicht erkennbar und damit reiner Zufall statt Gedächtnisleistung.
  const kandidaten = tiles.filter((t) => !t.removed && !t.face.special).map((t) => t.key);
  for (let i = kandidaten.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [kandidaten[i], kandidaten[j]] = [kandidaten[j], kandidaten[i]];
  }
  const verdeckt = new Set(kandidaten.slice(0, anzahl));
  if (!verdeckt.size) return tiles;

  return tiles.map((t) => (verdeckt.has(t.key) ? { ...t, hidden: true } : t));
}

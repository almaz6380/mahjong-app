// Memory-Brett: echte Mahjong-Figuren statt eines Rechteck-Rasters.
//
// Bewusst getrennt vom Bildschirm, damit `scripts/check-specials.mjs` die
// Kartenzahlen prüfen kann — eine UNGERADE Kartenzahl hieße eine Karte ohne
// Partner und ein Level, das sich nicht abschließen lässt.
//
// Zwei Stufen:
//   1–12   flache Silhouette  — nur die Zellen auf Ebene 0 einer Figur. Dafür
//          braucht es KEINE Änderung am Figuren-Generator (der flache Profile
//          sperrt): Man nimmt einfach die unterste Ebene einer bestehenden Figur.
//   ab 13  gestapelt          — alle Ebenen. Karten, auf denen etwas liegt, sind
//          abgedunkelt und nicht umdrehbar; sie werden frei, sobald die Karte
//          darüber weg ist. Das ist die Mahjong-Regel plus Gedächtnis.
//
// ⚠ Anders als das Solitaire-Brett wird MIT Lücke gerastert: Karten derselben
// Ebene überlappen nie, nur die Ebenen liegen versetzt übereinander. Sonst wäre
// „verdeckt" optisch nicht von „daneben" zu unterscheiden.

import { buildDeck } from '../../game/tiles';
import { allFigures } from '../../game/figures';
import { mulberry32, seedFromString } from '../../game/engine';

export const FLACH_BIS = 12;

export const KW = 52; // Kartengröße (muss zu `.mem-cell` in styles.css passen)
export const KH = 70;
export const CW = 58; // Kartenraster (Karte + Lücke)
export const CH = 76;
// Ebenenversatz. Bewusst groß (Karte 52×70): Bei kleinerem Versatz ragt von der
// unteren Karte nur ein schmaler Streifen heraus, und der liest sich als
// Schlagschatten statt als zweite Karte — der Spieler übersieht dann, dass dort
// überhaupt etwas liegt.
export const DXL = 15;
export const DYL = 17;

export interface Card {
  key: number;
  col: number;
  row: number;
  layer: number;
  faceId: string;
  up: boolean;
  done: boolean;
}

/** Alle verschiedenen Motive des Decks — der Vorrat für die Paare. */
const DISTINCT = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of buildDeck()) if (!seen.has(f.id)) { seen.add(f.id); out.push(f.id); }
  return out;
})();

/**
 * Deckt eine Karte etwas ab? Echte Überlappung, nicht nur exakt dieselbe Zelle —
 * die Ebenen liegen im Halbschritt versetzt.
 *
 * ⚠ Blockiert wird NUR von oben. Links/rechts wäre bei Karten, die einander gar
 * nicht berühren, optisch gelogen (im Solitaire liegen die Steine dicht an
 * dicht, hier mit Lücke).
 */
export function bedeckt(c: Card, alle: Card[]): boolean {
  return alle.some(
    (u) => !u.done && u.layer === c.layer + 1
      && Math.abs(u.col - c.col) < 1 && Math.abs(u.row - c.row) < 1,
  );
}

/**
 * Baut das Brett für ein Level. Deterministisch aus der Levelnummer — wer ein
 * Level wiederholt, bekommt dieselbe Figur (die Motive wechseln trotzdem, das
 * ist bei einem Gedächtnisspiel der Sinn der Sache).
 */
export function baueLevel(level: number): { cards: Card[]; shape: string } {
  const rand = mulberry32(seedFromString('memory:' + level));
  const flach = level <= FLACH_BIS;

  const kandidaten = allFigures().filter((f) => {
    const zellen = flach ? f.cells.filter((c) => c.layer === 0).length : f.cells.length;
    return flach
      ? zellen >= 12 && zellen <= 24 && f.cols <= 7 && f.rows <= 8
      : zellen >= 16 && zellen <= 30 && f.layerCount <= 3 && f.cols <= 7 && f.rows <= 8;
  });
  const fig = kandidaten[Math.floor(rand() * kandidaten.length)] ?? allFigures()[0];

  let zellen = flach ? fig.cells.filter((c) => c.layer === 0) : fig.cells.slice();
  // Kartenzahl MUSS gerade sein — sonst bleibt eine Karte ohne Partner. Bei
  // ungerader Zahl fällt die LETZTE Zelle weg; `cells` ist nach Ebene sortiert,
  // es trifft also eine der obersten und lässt nichts schweben.
  if (zellen.length % 2) zellen = zellen.slice(0, -1);

  const paare = zellen.length / 2;
  // Reicht der Vorrat nicht, wird er umlaufend wiederholt — sonst blieben
  // `undefined`-Motive im Brett stehen. Bei den heutigen Grenzen (max. 15 Paare
  // gegen 42 Motive) greift das nie; der Riegel steht für den Tag, an dem
  // jemand die Kartenzahl hochsetzt.
  const topf = [...DISTINCT].sort(() => rand() - 0.5);
  const motive = Array.from({ length: paare }, (_, i) => topf[i % topf.length]);
  const gemischt = motive.flatMap((m) => [m, m]);
  for (let i = gemischt.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [gemischt[i], gemischt[j]] = [gemischt[j], gemischt[i]];
  }

  return {
    cards: zellen.map((c, i) => ({
      key: i, col: c.col, row: c.row, layer: c.layer,
      faceId: gemischt[i], up: false, done: false,
    })),
    shape: fig.shape,
  };
}

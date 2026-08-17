// Der Plan einer Charge: welches Reel welches Format, Level und welchen Fakt hat.
//
// ⚠ Bewusst eine EIGENE Datei und nicht in charge.mjs: Dort laeuft beim Laden
// eine Vorpruefung, die den Preview-Server anspricht und notfalls
// `process.exit(1)` ruft. Ein Import zum blossen Nachschlagen des Plans wuerde
// diese Nebenwirkung ausloesen — captions-neu.mjs braucht keinen Server.
//
// Die Nummer bestimmt die Posting-Reihenfolge: Der Start wechselt bewusst
// zwischen den Formaten, damit der Kanal von Tag 1 an nach mehr als einem
// Trick aussieht.
//
// ⚠ Die Level sind so gewaehlt, dass die Bretter unterschiedlich GROSS sind
// (Level 6 ≈ 36 Steine, Level 200 ≈ 60). Bei `paar` bleiben sie klein — die
// Frage soll in zwei Sekunden beantwortbar sein. Bei `clear` duerfen sie gross
// sein, dort ist die Laenge der Reiz.
export const PLAN = [
  { nr: 1,  format: 'paar',  level: 18 },
  { nr: 2,  format: 'clear', level: 40 },
  { nr: 3,  format: 'fakt',  level: 10, fakt: 0 },
  { nr: 4,  format: 'paar',  level: 34 },
  { nr: 5,  format: 'clear', level: 12 },
  { nr: 6,  format: 'fakt',  level: 25, fakt: 8 },
  { nr: 7,  format: 'paar',  level: 6 },
  { nr: 8,  format: 'clear', level: 110 },
  { nr: 9,  format: 'fakt',  level: 48, fakt: 3 },
  { nr: 10, format: 'paar',  level: 52 },
  { nr: 11, format: 'clear', level: 66 },
  { nr: 12, format: 'fakt',  level: 72, fakt: 15 },
  { nr: 13, format: 'paar',  level: 78 },
  { nr: 14, format: 'clear', level: 150 },
  { nr: 15, format: 'fakt',  level: 90, fakt: 20 },
  { nr: 16, format: 'paar',  level: 96 },
  { nr: 17, format: 'clear', level: 200 },
  { nr: 18, format: 'fakt',  level: 135, fakt: 26 },
  { nr: 19, format: 'paar',  level: 125 },
  { nr: 20, format: 'fakt',  level: 175, fakt: 31 },
];

// Welcher Vorspann vor welchem Reel steht. Die beiden wechseln sich ab, damit
// der Kanal nicht bei jedem Beitrag mit demselben Bild anfaengt — nach drei
// Reels haette das jeder wiedererkannt, und Wiedererkennung ist beim Einstieg
// genau das Falsche: Wer die ersten Sekunden schon kennt, wischt weiter.
//
// ⚠ Die Namen muessen in `VORSPAENNE` (make-reel.mjs) stehen. Dort liegt zu
// jedem der gemessene Schnittpunkt; ein Clip ohne Eintrag wird abgelehnt.
export const vorspannFuer = (j) => (j.nr % 2 === 1 ? 'steine-legen' : 'steine-kippen');

// Namensschema der fertigen Dateien. Steht hier, damit charge.mjs und
// captions-neu.mjs nicht zwei Fassungen davon pflegen.
export const reelName = (j) => `${String(j.nr).padStart(2, '0')}-${j.format}-lvl${j.level}-EN`;

// Namensschema der Rohaufnahme — kommt aus record-solitaire.mjs.
export const clipName = (level) => `mahjong-solitaire-lvl${level}-en`;

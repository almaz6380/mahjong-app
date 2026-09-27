// Formate, Texte und Captions für die Reels.
//
// Alles an einem Ort, damit Texte geaendert werden koennen, ohne den
// Videobau anzufassen. Sprache ist Englisch: Ein Kanal, groesster Markt,
// und das Video selbst ist bis auf Hook und Abspann sprachfrei.
//
// ⚠ Der Abspann sagt „Free on the App Store & Google Play“. Das stimmt fuer
// Mahjong Royale (beide Stores seit 29.7.2026). Bei Anigosha war genau dieser
// Satz das Problem — dort gilt er nicht. Nicht gedankenlos kopieren.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');

// --- Fakten aus der App ziehen ---------------------------------------------
// `src/game/facts.ts` ist die Wahrheit — die Texte sind dort redaktionell
// geprueft und bewusst harmlos gehalten (keine Heilversprechen). Sie hier zu
// kopieren hiesse, sie zweimal zu pflegen.
export function fakten() {
  const roh = readFileSync(join(WURZEL, 'src/game/facts.ts'), 'utf8');
  const treffer = [...roh.matchAll(/\{\s*cat:\s*'(\w+)',\s*de:\s*'([^']*)',\s*en:\s*'([^']*)'\s*\}/g)];
  if (treffer.length < 20) throw new Error(`nur ${treffer.length} Fakten gefunden — Format von facts.ts geaendert?`);
  return treffer.map((m) => ({ cat: m[1], de: m[2], en: m[3] }));
}

// --- Formate ----------------------------------------------------------------
// hookSek: Wie lange die Eingangskarte steht. Eine Frage ist in 1,8 s gelesen,
// ein Fakt braucht laenger — sonst steht Text da, den niemand zu Ende liest.
export const FORMATE = {
  paar: {
    hookSek: 1.9,
    hook: 'Can you spot\nthe pair?',
    hookSub: 'Most people need three tries',
    hashtags: ['mahjong', 'mahjongsolitaire', 'puzzlegame', 'brainteaser', 'spotthedifference'],
    caption: (o) => `Can you spot the matching pair before I do? 👀\n\n`
      + `Level ${o.level} · ${o.paare} pairs · cleared in ${o.spielSek}s\n\n`
      + `Mahjong Royale — free on iOS & Android.`,
  },

  clear: {
    hookSek: 1.6,
    hook: 'Every single tile.\nGone.',
    hookSub: 'Sound on 🔊',
    hashtags: ['mahjong', 'satisfying', 'oddlysatisfying', 'asmr', 'mahjongsolitaire'],
    caption: (o) => `${o.paare} pairs, no mistakes. Sound on for the tiles. 🔊\n\n`
      + `Level ${o.level} · ${o.spielSek}s\n\n`
      + `Mahjong Royale — free on iOS & Android.`,
  },

  fakt: {
    hookSek: 3.6,          // ein Satz will gelesen werden
    hook: 'Did you know?',
    hookSub: null,         // kommt aus dem Fakt
    hashtags: ['mahjong', 'didyouknow', 'mahjongsolitaire', 'history', 'funfacts'],
    caption: (o) => `${o.fakt}\n\n`
      + `Playing level ${o.level} while you read. 🀄\n\n`
      + `Mahjong Royale — free on iOS & Android.`,
  },

  // Der beste Aufhaenger, den dieses Spiel hat — und er ist keine Behauptung,
  // sondern die echte Regel aus src/game/tiles.ts: alle Blumen teilen sich
  // matchKey 'flower', alle Jahreszeiten 'season'. Wer nach dem IDENTISCHEN
  // Stein sucht, sucht falsch. Eine echte Ueberraschung ist mehr wert als
  // jede Aufforderung mitzuraten.
  //
  // ⚠ Nur mit Brettern ab 40 Steinen: erst dort mischt deckForCount ueberhaupt
  // Blumen und Jahreszeiten ein. Darunter geht das Format ins Leere.
  'blumen-falle': {
    hookSek: 2.4,
    hook: 'These two match.\nLook again.',
    hookSub: 'Every flower matches every flower',
    hashtags: ['mahjong', 'mahjongsolitaire', 'puzzlegame', 'brainteaser', 'didyouknow'],
    caption: (o) => `Most people lose here. 🌸\n\n`
      + `In mahjong solitaire any flower matches any other flower — and any season `
      + `any other season. They do not have to be identical. Miss that and you stall `
      + `on boards you could have cleared.\n\n`
      + `Level ${o.level} · ${o.paare} pairs · ${o.spielSek}s\n\n`
      + `Mahjong Royale — free on iOS & Android.`,
  },

  // Die FORM ist der Aufhaenger, nicht das Spiel. 370 gebaute Figuren sind
  // zugleich die beste Antwort auf Apples 4.3(a)-Vorwurf ("Design: Spam") —
  // sichtbar, dass hier keine Variante desselben Bretts vorliegt.
  'figur-des-tages': {
    hookSek: 2.0,
    hook: (o) => `Today: the\n${o.figur ?? 'dragon'}.`,
    hookSub: 'One of 370 hand-built layouts',
    hashtags: ['mahjong', 'mahjongsolitaire', 'satisfying', 'oddlysatisfying', 'puzzlegame'],
    caption: (o) => `Every level is an actual shape. This one is the ${o.figur ?? 'dragon'}. 🀄\n\n`
      + `370 of them — turtle, butterfly, lantern, crown, bridge. None is a reskin `
      + `of the last.\n\n`
      + `Level ${o.level} · ${o.paare} pairs · ${o.spielSek}s\n\n`
      + `Mahjong Royale — free on iOS & Android.`,
  },

  // Saison-Fest (24.09.2026, Josef: „neue ideen/styles"). Aufgenommen wird
  // das ECHTE Fest-Brett (record-solitaire.mjs --fest), nicht ein normales
  // Level mit Fest-Überschrift. Eigener Nacht-Look statt Jade: dunkles
  // Mondblau, das Gold bleibt. Nur im Zeitfenster eines Fests sinnvoll —
  // der Recorder bricht außerhalb ab.
  mondfest: {
    hookSek: 2.2,
    hook: 'Only during the\nMoon Festival 🌕',
    hookSub: 'A ring-shaped board — until October 1',
    farben: {
      abdunkeln: 'rgba(8,12,34,.38)',
      band: [8, 12, 34],
      abspann: 'linear-gradient(160deg,#1c2552,#0e1433 60%,#070a1c)',
    },
    hashtags: ['mahjong', 'moonfestival', 'midautumnfestival', 'mahjongsolitaire', 'puzzlegame'],
    caption: (o) => `The Moon Festival board is only here until October 1. 🌕\n\n`
      + `A ring of ${o.paare} pairs, cleared in ${o.spielSek}s. First win of the day earns a festival bonus.\n\n`
      + `Mahjong Royale — free on iOS & Android.`,
  },
};

/** Hook und Unterzeile duerfen Funktionen sein — `figur-des-tages` braucht den Namen. */
export function hookTexte(format, o = {}) {
  const f = FORMATE[format];
  const loese = (x) => (typeof x === 'function' ? x(o) : x);
  return { hook: loese(f.hook), hookSub: loese(f.hookSub) };
}

// --- Caption-Datei ----------------------------------------------------------
// Neben jedes Video eine .txt: Caption zum Kopieren, Hashtags, und die
// Hinweise, die man beim Hochladen sonst vergisst.
export function captionText(format, o) {
  const f = FORMATE[format];
  return [
    `# ${o.datei}`,
    '',
    '## Caption (kopieren)',
    '',
    f.caption(o),
    '',
    '## Hashtags',
    '',
    f.hashtags.map((h) => `#${h}`).join(' '),
    '',
    '## Beim Hochladen',
    '',
    '- Die eigene Tonspur reicht. Beim Format "clear" IST der Klang der Reiz',
    '  ("Sound on"). Willst du Musik, nimm sie aus der Commercial Music Library.',
    '- KEINE Chart-/Trending-Sounds. Die sind für private Beiträge lizenziert,',
    '  nicht für Firmen, die ein Produkt bewerben — erkennt die Plattform das,',
    '  wird das Video stummgeschaltet.',
    '- Keinen Store-Link in die Caption (drückt die Auslieferung), nur "link in bio".',
    '- TikTok als BUSINESS-Konto: nur so gibt es unter 1000 Followern ein',
    '  Website-Feld. Instagram als Creator-Konto — dort ist der Link ohnehin frei.',
    '- Auf Instagram den Haken für Facebook mitnehmen. Die Zielgruppe für',
    '  Mahjong ist dort älter und der Wettbewerb geringer.',
    '',
    '## Inhalt',
    '',
    `- Format: ${format}`,
    `- Level ${o.level}, ${o.paare} Paare, Spieldauer ${o.spielSek} s`,
    o.fakt ? `- Fakt: ${o.fakt}` : null,
    `- Gesamtlänge ${o.gesamtSek} s`,
    o.einblendungen?.length ? `- Einblendungen: ${o.einblendungen.join(', ')}` : null,
    o.vorspann ? `- Vorspann: ${o.vorspann} (KI-Filmszene, fal.ai — Herkunft in scripts/reel/assets/vorspann/HERKUNFT.md)` : null,
    // ⚠ Diese Zeile liest der Tageslauf (wellapps-social/tools/social/lauf.mjs)
    // fuer die Leitplanke (vorflug.mjs): `ki-menschen` = realistisch, Plaettchen
    // Pflicht; `ki-figur` = gemalt, Plaettchen verboten (Josef, 26.09.2026).
    o.kiRealistisch ? `- Medienherkunft: ki-menschen (${o.vorspann ? 'realistische KI-Filmszene' : 'realistische KI-Einblendungen'}, Wasserzeichen gesetzt)`
      : o.kiMenschen ? '- Medienherkunft: ki-figur (gemalte Einblendungen Junge/Opa/Tempel, '
        + 'kein Plättchen)' : null,
  ].filter((z) => z !== null).join('\n') + '\n';
}

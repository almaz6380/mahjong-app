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
    hashtags: ['mahjong', 'mahjongsolitaire', 'puzzlegame', 'brainteaser', 'spotthedifference',
      'satisfying', 'mobilegame', 'freegame', 'tilematching', 'puzzletok'],
    caption: (o) => `Can you spot the matching pair before I do? 👀\n\n`
      + `Level ${o.level} · ${o.paare} pairs · cleared in ${o.spielSek}s\n\n`
      + `Mahjong Royale — free on iOS & Android. Link in bio.`,
  },

  clear: {
    hookSek: 1.6,
    hook: 'Every single tile.\nGone.',
    hookSub: 'Sound on 🔊',
    hashtags: ['mahjong', 'satisfying', 'oddlysatisfying', 'asmr', 'mahjongsolitaire',
      'puzzlegame', 'relaxing', 'mobilegame', 'freegame', 'tilematching'],
    caption: (o) => `${o.paare} pairs, no mistakes. Sound on for the tiles. 🔊\n\n`
      + `Level ${o.level} · ${o.spielSek}s\n\n`
      + `Mahjong Royale — free on iOS & Android. Link in bio.`,
  },

  fakt: {
    hookSek: 3.6,          // ein Satz will gelesen werden
    hook: 'Did you know?',
    hookSub: null,         // kommt aus dem Fakt
    hashtags: ['mahjong', 'didyouknow', 'mahjongsolitaire', 'history', 'funfacts',
      'boardgames', 'puzzlegame', 'mobilegame', 'freegame', 'tilematching'],
    caption: (o) => `${o.fakt}\n\n`
      + `Playing level ${o.level} while you read. 🀄\n\n`
      + `Mahjong Royale — free on iOS & Android. Link in bio.`,
  },
};

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
  ].filter((z) => z !== null).join('\n') + '\n';
}

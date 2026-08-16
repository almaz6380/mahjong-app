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
// ⚠ HOECHSTENS FUENF HASHTAGS je Format (Josefs Vorgabe, 16.08.2026). Vorher
// waren es zehn. Die Liste ist deshalb keine Sammelstelle: Wer einen neuen
// aufnimmt, muss einen alten streichen. Gewaehlt sind je Format zwei breite
// (`mahjong`, `mahjongsolitaire`) und drei, die das Format selbst treffen.
// hookSek: Wie lange die Eingangskarte steht. Eine Frage ist in 1,8 s gelesen,
// ein Fakt braucht laenger — sonst steht Text da, den niemand zu Ende liest.
export const FORMATE = {
  paar: {
    // 1,9 s waren zu lang: Die Frage ist in gut einer Sekunde gelesen, und die
    // ersten Sekunden sind im Feed die teuerste Zeit ueberhaupt — wer dort ein
    // Standbild sieht, wischt weiter.
    hookSek: 1.3,
    hook: 'Can you spot\nthe pair?',
    hookSub: 'Most people need three tries',
    hashtags: ['mahjong', 'mahjongsolitaire', 'puzzletok', 'brainteaser', 'satisfying'],
    koerper: (o) => `Can you spot the matching pair before I do? 👀\n\n`
      + `Level ${o.level} · ${o.paare} pairs · cleared in ${o.spielSek}s`,
  },

  clear: {
    hookSek: 1.6,
    hook: 'Every single tile.\nGone.',
    hookSub: 'Sound on 🔊',
    hashtags: ['mahjong', 'mahjongsolitaire', 'oddlysatisfying', 'asmr', 'relaxing'],
    koerper: (o) => `${o.paare} pairs, no mistakes. Sound on for the tiles. 🔊\n\n`
      + `Level ${o.level} · ${o.spielSek}s`,
  },

  fakt: {
    hookSek: 3.6,          // ein Satz will gelesen werden
    hook: 'Did you know?',
    hookSub: null,         // kommt aus dem Fakt
    hashtags: ['mahjong', 'mahjongsolitaire', 'didyouknow', 'funfacts', 'boardgames'],
    koerper: (o) => `${o.fakt}\n\n`
      + `Playing level ${o.level} while you read. 🀄`,
  },

  // Der Werbespot (spot.mjs) — kein Gameplay-Reel, deshalb keine Hook-Karte.
  // Er erzaehlt eine Geschichte statt eine Runde zu zeigen, und der Text muss
  // das aufnehmen: „Spot the pair" waere hier sinnlos.
  spot: {
    hookSek: null, hook: null, hookSub: null,
    hashtags: ['mahjong', 'mahjongsolitaire', 'puzzlegame', 'mobilegame', 'satisfying'],
    // ⚠ Weder Modi noch Levelzahl hier nennen — der Facebook-Schluss traegt
    // beides schon („Solitaire, Connect, Riichi … 370 levels"). Doppelt
    // gelesen wirkt es wie ein Textbaustein-Unfall, und genau das stand in der
    // ersten Fassung.
    // ⚠ KI-Hinweis: Generiert sind NUR die Tempelszenen. Das Gameplay ist eine
    // echte Bildschirmaufnahme. Ein pauschales „dieses Video ist KI" waere
    // falsch und wuerde ausgerechnet den Teil in Zweifel ziehen, auf den es bei
    // einer App-Anzeige ankommt — dass die gezeigte App wirklich so aussieht.
    // Der Satz trennt beides deshalb ausdruecklich.
    koerper: () => `Some games you don't just play. You're taught. 🀄\n\n`
      + `From your first pair to boards that fight back.\n\n`
      + `Temple scenes created with AI · gameplay is real footage`,
  },
};

// --- Plattformen ------------------------------------------------------------
// Der SCHLUSS unterscheidet sich, der Koerper nicht. Deshalb steht er hier
// einmal je Plattform statt dreimal je Format.
//
// ⚠ Der Unterschied ist nicht kosmetisch:
// • Auf Instagram und TikTok sind URLs im Beschreibungstext NICHT klickbar,
//   und Beitraege, die aus der App hinausfuehren, werden schlechter
//   ausgespielt. Ein Store-Link dort schadet also doppelt — deshalb „link in
//   bio“, und deshalb prueft check-captions.mjs ausdruecklich, dass in diesen
//   beiden Fassungen kein `http` steht.
// • Auf Facebook ist der Link klickbar und erwartet; „link in bio“ gibt es
//   dort als Konvention gar nicht. Hashtags bringen dort kaum Reichweite und
//   lassen einen Beitrag nach Werbung aussehen — daher nur zwei.
export const LINK = 'https://mahjong-app-plum.vercel.app/links.html';

export const PLATTFORMEN = {
  instagram: {
    name: 'Instagram',
    text: (f, o) => `${f.koerper(o)}\n\nMahjong Royale — free on iOS & Android. Link in bio.`,
    tags: (f) => f.hashtags,
  },
  tiktok: {
    name: 'TikTok',
    // Einfache statt doppelter Umbrueche: Im TikTok-Feld ist wenig Platz, und
    // die ersten Zeilen entscheiden, ob jemand „mehr“ antippt.
    text: (f, o) => `${f.koerper(o).replace(/\n\n/g, '\n')}\nFree on iOS & Android — link in bio`,
    tags: (f) => f.hashtags,
  },
  facebook: {
    name: 'Facebook',
    text: (f, o) => `${f.koerper(o)}\n\n`
      + `Mahjong Royale is free on iOS and Android — Solitaire, Connect, Riichi and `
      + `4-player mahjong. 370 levels, no account needed.\n\n👉 ${LINK}`,
    tags: (f) => f.hashtags.slice(0, 2),
  },
};

// --- Caption-Datei ----------------------------------------------------------
// Neben jedes Video eine .txt: Caption zum Kopieren, Hashtags, und die
// Hinweise, die man beim Hochladen sonst vergisst.
export function captionText(format, o) {
  const f = FORMATE[format];
  const abschnitt = (p) => [
    `## ${p.name}`,
    '',
    p.text(f, o),
    '',
    p.tags(f).map((h) => `#${h}`).join(' '),
    '',
  ];
  return [
    `# ${o.datei}`,
    '',
    ...Object.values(PLATTFORMEN).flatMap(abschnitt),
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
    ...(format === 'spot' ? [
      '- ⚠ NUR beim Spot: in der App den Schalter für KI-GENERIERTE INHALTE',
      '  setzen. Instagram und TikTok haben dafür ein eigenes Feld beim',
      '  Hochladen, und diese plattformeigene Kennzeichnung zählt mehr als',
      '  eine Zeile im Beschreibungstext. Erkennt die Plattform es selbst und',
      '  hängt ihr Label nachträglich an, sieht es nach Vertuschen aus.',
      '  Die Gameplay-Reels bekommen den Schalter NICHT — sie enthalten kein',
      '  KI-Material, und eine falsche Kennzeichnung schadet wie eine fehlende.',
    ] : []),
    '',
    '## Inhalt',
    '',
    `- Format: ${format}`,
    `- Level ${o.level}, ${o.paare} Paare, Spieldauer ${o.spielSek} s`,
    o.fakt ? `- Fakt: ${o.fakt}` : null,
    `- Gesamtlänge ${o.gesamtSek} s`,
  ].filter((z) => z !== null).join('\n') + '\n';
}

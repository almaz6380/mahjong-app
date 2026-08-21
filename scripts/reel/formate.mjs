// Formate, Texte und Captions für die Reels.
//
// Alles an einem Ort, damit Texte geaendert werden koennen, ohne den
// Videobau anzufassen. Sprache ist Englisch: Ein Kanal, groesster Markt,
// und das Video selbst ist bis auf Hook und Abspann sprachfrei.
//
// ⚠ Der Abspann zeigt seit 21.08.2026 die BADGES beider Stores statt des
// Satzes „Free on the App Store & Google Play“. Die Aussage ist dieselbe, nur
// als Bild — und damit gilt dieselbe Warnung: Sie stimmt fuer Mahjong Royale
// (beide Stores seit 29.7.2026). Bei Anigosha war genau das das Problem, dort
// gilt sie nicht. Ein Badge ist keine Verzierung, sondern eine Behauptung ueber
// Verfuegbarkeit — nicht gedankenlos in eine andere App kopieren.

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
    // ⚠ KI-Hinweis. Im Bild gibt es KEIN Symbol mehr (Josefs Entscheidung) —
    // dieser Satz traegt die Kennzeichnung also allein und muss deutlich sein.
    //
    // Generiert sind NUR die Tempelszenen; das Gameplay ist eine echte
    // Bildschirmaufnahme. Ein pauschales „dieses Video ist KI" waere falsch und
    // wuerde ausgerechnet den Teil in Zweifel ziehen, auf den es bei einer
    // App-Anzeige ankommt — dass die gezeigte App wirklich so aussieht. Der
    // Satz sagt deshalb beides.
    koerper: () => `Some games you don't just play. You're taught. 🀄\n\n`
      + `From your first pair to boards that fight back.\n\n`
      + `🤖 The temple scenes in this video were created with AI. `
      + `The gameplay is real footage from the app.`,
  },

  // Das Modi-Reel (reel-modi.mjs): sechs Spiele hintereinander. Kein
  // KI-Hinweis — alles echte Bildschirmaufnahme.
  // ⚠ Der Text muss das Versprechen des Bildes einloesen und die Frage am
  // Ende STELLEN: „welches wuerdest du spielen" ist der Kommentar-Koeder,
  // und Kommentare sind das Einzige, was die Auslieferung wirklich treibt.
  modi: {
    hookSek: null, hook: null, hookSub: null,
    hashtags: ['mahjong', 'mahjongsolitaire', 'mobilegame', 'puzzlegame', 'gaming'],
    koerper: () => `Six games in one app — and they're all mahjong. 🀄\n\n`
      + `Solitaire · Memory · Connect · 3D · Riichi · Time Blitz\n\n`
      + `Which one would you play first? 👇`,
  },

  // Das Rueckwaerts-Reel (reel-rueckwaerts.mjs): echtes Gameplay umgekehrt,
  // die Steine fliegen zurueck aufs Brett. Die Pointe ist ein wahrer Fakt
  // ueber den Generator (Rueckwaertskonstruktion = immer loesbar). KEIN
  // KI-Material — die Beschreibung sagt ausdruecklich, dass es echte,
  // umgekehrte Aufnahme ist, sonst wirkt es wie ein Trick.
  rueckwaerts: {
    hookSek: null, hook: null, hookSub: null,
    hashtags: ['mahjong', 'mahjongsolitaire', 'reverse', 'oddlysatisfying', 'didyouknow'],
    koerper: (o) => `Every board in Mahjong Royale is built backwards — `
      + `that's why it's always solvable. 🀄\n\n`
      + `This is real gameplay, just reversed. Level ${o.level}, ${o.paare} pairs flying home.`,
  },

  // Der Domino-Spot (spot-domino.mjs): eine Kettenreaktion aus echten Steinen
  // muendet in die Schlussrampe des Spiels. Gleiche Regeln wie beim `spot`:
  // kein Gameplay-Reel, keine Hook-Karte, KI-Hinweis nur im Text — und der
  // Hinweis muss trennen, was erzeugt ist und was echt (die Kettenreaktion ist
  // KI, das Gameplay eine echte Aufnahme).
  domino: {
    hookSek: null, hook: null, hookSub: null,
    hashtags: ['mahjong', 'mahjongsolitaire', 'dominoeffect', 'satisfying', 'chainreaction'],
    koerper: () => `One tile. That's all it takes. 🀄\n\n`
      + `Watch the whole board go.\n\n`
      + `🤖 The domino scenes in this video were created with AI. `
      + `The gameplay is real footage from the app.`,
  },
};

// --- Plattformen ------------------------------------------------------------
// Der SCHLUSS unterscheidet sich, der Koerper nicht. Deshalb steht er hier
// einmal je Plattform statt dreimal je Format.
//
// ⚠ Die Adresse steht seit dem 16.08.2026 in ALLEN drei Fassungen (Josefs
// Vorgabe). Vorher trug sie nur Facebook, und `check-captions.mjs` hat das
// Gegenteil erzwungen — wer die alte Regel im Kopf hat, wundert sich sonst.
//
// Zur Einordnung, damit die Entscheidung nachvollziehbar bleibt: Auf Instagram
// und TikTok ist eine Adresse im Beschreibungstext NICHT anklickbar, und
// Beitraege, die aus der App hinausfuehren, werden tendenziell schlechter
// ausgespielt. Sie steht dort also zum Ablesen, nicht zum Antippen — der
// klickbare Weg bleibt das Profil. Auf Facebook ist sie klickbar und gehoert
// deshalb in voller Form mit `https://` hinein.
export const LINK = 'https://mahjong-app-plum.vercel.app/links.html';

export const PLATTFORMEN = {
  instagram: {
    name: 'Instagram',
    text: (f, o) => `${f.koerper(o)}\n\nMahjong Royale — free on iOS & Android\n`
      + `${LINK.replace('https://', '')}`,
    tags: (f) => f.hashtags,
  },
  tiktok: {
    name: 'TikTok',
    // Einfache statt doppelter Umbrueche: Im TikTok-Feld ist wenig Platz, und
    // die ersten Zeilen entscheiden, ob jemand „mehr“ antippt.
    text: (f, o) => `${f.koerper(o).replace(/\n\n/g, '\n')}\nFree on iOS & Android\n`
      + `${LINK.replace('https://', '')}`,
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
    '- Die Adresse steht in allen drei Fassungen. Auf Instagram und TikTok ist',
    '  sie NICHT anklickbar — sie steht dort zum Ablesen; der klickbare Weg',
    '  bleibt der Link im Profil. Auf Facebook ist sie klickbar.',
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

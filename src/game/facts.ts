// Kurze, bilinguale Fakten/Tipps für die „Wusstest du?“-Karte zwischen den Runden.
// cat: 'culture' = Mahjong-Kultur/Geschichte · 'mind' = Konzentration/Entspannung · 'tip' = Spieltipp.
// Bewusst allgemein & harmlos gehalten (keine Heilversprechen).

export interface Fact {
  cat: 'culture' | 'mind' | 'tip';
  de: string;
  en: string;
}

export const FACTS: Fact[] = [
  // --- Kultur / Geschichte ---
  { cat: 'culture', de: 'Mahjong entstand im 19. Jahrhundert in China und verbreitete sich in den 1920ern über die ganze Welt.', en: 'Mahjong emerged in 19th-century China and spread across the world in the 1920s.' },
  { cat: 'culture', de: 'Der Name „Mahjong“ wird oft mit „Sperling“ übersetzt – nach dem klappernden Geräusch der Steine.', en: 'The name “mahjong” is often linked to the word for “sparrow”, echoing the clatter of the tiles.' },
  { cat: 'culture', de: 'Ein klassisches Set hat 144 Steine: Zahlen, Winde, Drachen sowie Blumen und Jahreszeiten.', en: 'A classic set has 144 tiles: numbers, winds, dragons plus flowers and seasons.' },
  { cat: 'culture', de: 'Die drei Drachen – Rot, Grün und Weiß – stehen sinnbildlich für Glück, Wohlstand und Reinheit.', en: 'The three dragons — red, green and white — symbolize fortune, prosperity and purity.' },
  { cat: 'culture', de: 'Die vier Winde Ost, Süd, West und Nord bestimmen im 4-Spieler-Spiel Sitzplätze und Runden.', en: 'The four winds — East, South, West, North — set seats and rounds in the 4-player game.' },
  { cat: 'culture', de: 'Die „Bambus“-Steine zeigen stilisierte Bambusstäbe; die 1 wird traditionell als Vogel dargestellt.', en: 'The “bamboo” suit shows stylized sticks; the 1 is traditionally drawn as a bird.' },
  { cat: 'culture', de: 'Mahjong Solitaire (Steine paaren) ist ein modernes Computerspiel – nicht das klassische 4-Spieler-Mahjong.', en: 'Mahjong solitaire (matching pairs) is a modern computer game, not the classic 4-player game.' },
  { cat: 'culture', de: 'Die beliebte „Schildkröten“-Auslage im Solitaire heißt so wegen ihrer gewölbten Form.', en: 'The popular “turtle” solitaire layout is named for its dome-like shape.' },
  { cat: 'culture', de: 'In Japan hat sich mit „Riichi“ eine eigene, tief strategische Mahjong-Variante entwickelt.', en: 'Japan developed its own deeply strategic variant of mahjong, called “riichi”.' },
  { cat: 'culture', de: 'Traditionell werden die Steine vor jeder Runde zu einer „Mauer“ aufgebaut – daher „live wall“.', en: 'Traditionally the tiles are stacked into a “wall” before each round — hence the live wall.' },
  { cat: 'culture', de: 'Mahjong-Steine wurden früher aus Bambus und Knochen gefertigt, heute meist aus Kunststoff.', en: 'Mahjong tiles were once made from bamboo and bone; today they are usually plastic.' },
  { cat: 'culture', de: 'In vielen Familien ist Mahjong ein fester Teil von Festen und Zusammenkünften.', en: 'In many families, mahjong is a fixture at holidays and gatherings.' },

  // --- Konzentration / Entspannung ---
  { cat: 'mind', de: 'Schon ein paar Minuten Steine legen können helfen, den Kopf zwischendurch frei zu bekommen.', en: 'Even a few minutes of matching tiles can help clear your head.' },
  { cat: 'mind', de: 'Kleine Denkspiele in Maßen sind eine schöne Pause – gönn dir zwischendurch bewusst Ruhe.', en: 'Light puzzles in moderation make a nice break — allow yourself calm moments.' },
  { cat: 'mind', de: 'Ruhiges, konzentriertes Spielen kann eine kleine Auszeit vom Alltag sein.', en: 'Calm, focused play can be a little timeout from everyday life.' },
  { cat: 'mind', de: 'Tief durchatmen vor einer kniffligen Auslage – ein klarer Kopf sieht mehr Züge.', en: 'Breathe deeply before a tricky layout — a clear mind spots more moves.' },
  { cat: 'mind', de: 'Muster erkennen und vorausplanen hält den Geist spielerisch beschäftigt.', en: 'Spotting patterns and planning ahead keeps the mind playfully engaged.' },
  { cat: 'mind', de: 'Lieber kurz und regelmäßig spielen als lange am Stück – das bleibt entspannt.', en: 'Short, regular sessions stay more relaxing than long marathons.' },
  { cat: 'mind', de: 'Kein Zeitdruck nötig: In den meisten Modi kannst du in deinem eigenen Tempo überlegen.', en: 'No rush needed: in most modes you can think at your own pace.' },
  { cat: 'mind', de: 'Ein voller Bildschirm wirkt oft weniger chaotisch, wenn du eine Ecke nach der anderen angehst.', en: 'A full board feels less chaotic when you clear one corner at a time.' },

  // --- Spieltipps ---
  { cat: 'tip', de: 'Räume im Solitaire zuerst die oberen und äußeren Steine ab – sie legen darunterliegende frei.', en: 'In solitaire, clear top and outer tiles first — they free the ones beneath.' },
  { cat: 'tip', de: 'Ein Stein ist nur frei, wenn er links oder rechts eine offene Kante hat und nichts darüber liegt.', en: 'A tile is only free if it has an open left or right edge and nothing on top.' },
  { cat: 'tip', de: 'Bevor du ein Paar entfernst: Prüfe, ob es später als Schlüssel für einen anderen Stein gebraucht wird.', en: 'Before removing a pair, check whether it unlocks a tile you’ll need later.' },
  { cat: 'tip', de: 'Steckst du fest? Der Mischen-Booster ordnet die verbliebenen Steine neu – oft geht es dann weiter.', en: 'Stuck? The shuffle booster rearranges remaining tiles — often that reopens the board.' },
  { cat: 'tip', de: 'In Connect verbinden sich zwei Steine nur über einen Pfad mit höchstens zwei Knicken.', en: 'In Connect, two tiles link only along a path with at most two turns.' },
  { cat: 'tip', de: 'Blumen und Jahreszeiten passen im Solitaire jeweils untereinander – nicht nur exakt gleiche.', en: 'In solitaire, any flower matches any flower and any season any season — not just identical ones.' },
  { cat: 'tip', de: 'Im Riichi zählt ein Gewinn nur mit mindestens einem Yaku – plane deine Hand auf ein Muster hin.', en: 'In riichi a win counts only with at least one yaku — build your hand toward a pattern.' },
  { cat: 'tip', de: 'Riichi ansagen kannst du nur mit geschlossener Hand in Tenpai – ein Stein fehlt dann zum Sieg.', en: 'You can declare riichi only with a closed hand in tenpai — one tile from winning.' },
  { cat: 'tip', de: 'Achte auf den Dora-Indikator: Passende Dora-Steine geben zusätzliche Han und mehr Punkte.', en: 'Watch the dora indicator: matching dora tiles add extra han and more points.' },
  { cat: 'tip', de: 'Verdiene Münzen mit Siegen und nutze sie für Booster oder neue Stein-Designs.', en: 'Earn coins from wins and spend them on boosters or new tile skins.' },
  { cat: 'tip', de: 'Sammle deine tägliche Belohnung ein – eine Serie an Tagen bringt mehr Münzen.', en: 'Claim your daily reward — a streak of days yields more coins.' },
  { cat: 'tip', de: 'Schnellere Lösungen und weniger Hilfen bringen im Solitaire mehr Sterne.', en: 'Faster solves with fewer hints earn more stars in solitaire.' },
  { cat: 'tip', de: 'Im Tages-Event gibt es einmal pro Tag einen Extra-Bonus – schau im Hub vorbei.', en: 'The daily event grants a once-a-day bonus — check the hub.' },
  { cat: 'tip', de: 'Plane bei symmetrischen Auslagen paarweise, damit dir am Ende keine „Sackgasse“ bleibt.', en: 'On symmetric layouts, plan in pairs so you don’t hit a dead end at the finish.' },
];

// --- Rotation ohne sofortige Wiederholung (gemischter „Beutel“) ---
let bag: Fact[] = [];
let last: Fact | null = null;

function refillBag() {
  bag = FACTS.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  // Beutel-Grenze: verhindern, dass der erste neue Fakt = zuletzt gezogener ist.
  if (bag.length > 1 && bag[bag.length - 1] === last) {
    [bag[bag.length - 1], bag[0]] = [bag[0], bag[bag.length - 1]];
  }
}

export function nextFact(): Fact {
  if (bag.length === 0) refillBag();
  const f = bag.pop()!;
  last = f;
  return f;
}

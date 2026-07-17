// Leichtes i18n (de/en). App setzt die Sprache vor dem Rendern der Kinder
// (setLanguage in App.tsx); t() liest synchron. Platzhalter: {name}.

export type Lang = 'de' | 'en';

let lang: Lang = 'de';

export function detectLang(): Lang {
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'de';
  return nav.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function setLanguage(l: Lang) {
  lang = l;
}
export function currentLang(): Lang {
  return lang;
}

type Entry = { de: string; en: string };
const D: Record<string, Entry> = {
  // Allgemein
  'common.ok': { de: 'OK', en: 'OK' },
  'common.cancel': { de: 'Abbrechen', en: 'Cancel' },
  'common.next': { de: 'Weiter', en: 'Continue' },
  'common.toMenu': { de: 'Zum Menü', en: 'Back to menu' },
  'common.active': { de: 'Aktiv', en: 'Active' },
  'common.choose': { de: 'Wählen', en: 'Select' },
  'common.you': { de: 'Du', en: 'You' },

  // Menü
  'menu.subtitle': { de: 'Finde alle Paare und leere das Board.', en: 'Match all pairs and clear the board.' },
  'menu.play': { de: 'Level {n} spielen', en: 'Play level {n}' },
  'menu.resume': { de: 'Fortsetzen · Level {n}', en: 'Resume · Level {n}' },
  'menu.restart': { de: 'Neu starten', en: 'Start over' },
  'menu.daily': { de: 'Tages-Challenge', en: 'Daily challenge' },
  'menu.m4': { de: '4 Spieler · Ostrunde', en: '4 players · East round' },
  'menu.riichi': { de: 'Riichi Mahjong', en: 'Riichi Mahjong' },
  'home.play': { de: 'Spielen', en: 'Play' },
  'home.resume': { de: 'Weiterspielen', en: 'Resume' },
  'home.level': { de: 'Level {n}', en: 'Level {n}' },
  'home.daily': { de: 'Täglich', en: 'Daily' },
  'home.allGames': { de: 'Alle Spiele', en: 'All games' },
  'menu.shop': { de: 'Shop', en: 'Shop' },
  'menu.themes': { de: 'Designs', en: 'Themes' },
  'menu.achievements': { de: 'Erfolge', en: 'Awards' },
  'menu.stats': { de: 'Statistik', en: 'Stats' },
  'menu.settings': { de: 'Optionen', en: 'Settings' },
  'menu.help': { de: 'Hilfe', en: 'Help' },

  // Tages-Belohnung
  'menu.reward': { de: 'Belohnung', en: 'Reward' },
  'daily.title': { de: 'Tägliche Belohnung', en: 'Daily reward' },
  'daily.streak': { de: 'Tag {n} in Folge!', en: 'Day {n} in a row!' },
  'daily.claim': { de: 'Abholen', en: 'Claim' },

  // Solitaire / GameScreen
  'game.level': { de: 'Level {n}', en: 'Level {n}' },
  'game.daily': { de: 'Tages-Challenge', en: 'Daily challenge' },
  'game.pairs': { de: '{layout} · {n} Paare', en: '{layout} · {n} pairs' },
  'game.new': { de: 'Neu', en: 'New' },
  'game.undo': { de: 'Zurück', en: 'Undo' },
  'game.hint': { de: 'Tipp', en: 'Hint' },
  'game.shuffle': { de: 'Mischen', en: 'Shuffle' },
  'game.noMoves': { de: 'Keine Züge mehr', en: 'No moves left' },
  'game.noMovesText': { de: 'Misch die Steine neu, um weiterzuspielen.', en: 'Shuffle the tiles to keep playing.' },
  'game.boosterEmpty': { de: '{b} aufgebraucht', en: 'Out of {b}' },
  'game.refill': { de: 'Hol dir Nachschub:', en: 'Get a refill:' },
  'game.coinsBtn': { de: '{n} Münzen', en: '{n} coins' },
  'game.watchVideo': { de: 'Video ansehen', en: 'Watch video' },
  'game.levelDone': { de: 'Level {n} geschafft!', en: 'Level {n} complete!' },
  'game.levelWord': { de: 'Level', en: 'Level' },
  'game.dailyDone': { de: 'Tages-Challenge geschafft!', en: 'Daily challenge complete!' },
  'game.doubleCoins': { de: 'Münzen verdoppeln', en: 'Double coins' },
  'game.nextLevel': { de: 'Weiter →', en: 'Next →' },

  // Layouts
  'layout.mini': { de: 'Mini', en: 'Mini' },
  'layout.classic': { de: 'Klassisch', en: 'Classic' },
  'layout.pyramid': { de: 'Pyramide', en: 'Pyramid' },
  'layout.turtle': { de: 'Schildkröte', en: 'Turtle' },
  'layout.dailyBoard': { de: 'Tages-Schildkröte', en: 'Daily Turtle' },
  'layout.blitzBoard': { de: 'Blitz-Hügel', en: 'Blitz Hill' },
  'layout.daily': { de: 'Tages-Board', en: 'Daily board' },
  // Grundformen des Figuren-Generators (figures.ts)
  'fig.herz': { de: 'Herz', en: 'Heart' },
  'fig.raute': { de: 'Raute', en: 'Diamond' },
  'fig.ring': { de: 'Ring', en: 'Ring' },
  'fig.sanduhr': { de: 'Sanduhr', en: 'Hourglass' },
  'fig.kreuz': { de: 'Kreuz', en: 'Cross' },
  'fig.halbmond': { de: 'Halbmond', en: 'Crescent' },
  'fig.sechseck': { de: 'Sechseck', en: 'Hexagon' },
  'fig.auge': { de: 'Auge', en: 'Eye' },
  'fig.pfeil': { de: 'Pfeil', en: 'Arrow' },
  'fig.stern4': { de: 'Stern', en: 'Star' },
  'fig.stern5': { de: 'Stern', en: 'Star' },
  'fig.stern6': { de: 'Stern', en: 'Star' },
  'fig.stern8': { de: 'Stern', en: 'Star' },
  'fig.bluete4': { de: 'Blüte', en: 'Blossom' },
  'fig.bluete5': { de: 'Blüte', en: 'Blossom' },
  'fig.bluete6': { de: 'Blüte', en: 'Blossom' },
  'fig.drache': { de: 'Drache', en: 'Dragon' },
  'fig.tor': { de: 'Tor', en: 'Gate' },
  'fig.krone': { de: 'Krone', en: 'Crown' },
  'fig.fisch': { de: 'Koi', en: 'Koi' },
  'fig.krabbe': { de: 'Krabbe', en: 'Crab' },
  'fig.fledermaus': { de: 'Fledermaus', en: 'Bat' },
  'fig.laterne': { de: 'Laterne', en: 'Lantern' },
  'fig.bruecke': { de: 'Brücke', en: 'Bridge' },
  'fig.schmetterling': { de: 'Schmetterling', en: 'Butterfly' },
  'fig.rahmen': { de: 'Rahmen', en: 'Frame' },
  'fig.schildkroete': { de: 'Schildkröte', en: 'Turtle' },
  'fig.knospe': { de: 'Knospe', en: 'Bud' },
  'fig.turm': { de: 'Turm', en: 'Tower' },

  // Zen-Modus
  'menu.zen': { de: 'Zen-Modus', en: 'Zen Mode' },
  'hub.zen.sub': { de: 'Ohne Zeit, ohne Druck', en: 'No timer, no pressure' },
  'zen.title': { de: 'Zen', en: 'Zen' },
  'zen.done': { de: 'Im Gleichgewicht', en: 'In balance' },
  'zen.quote': { de: 'Ein leerer Tisch, ein klarer Geist.', en: 'An empty table, a clear mind.' },
  'zen.next': { de: 'Nächste Figur', en: 'Next figure' },

  // Pagoden-Aufstieg
  'menu.pagoda': { de: 'Pagoden-Aufstieg', en: 'Pagoda Climb' },
  'hub.pagoda.sub': { de: '100 Etagen bis zur Spitze', en: '100 floors to the top' },
  'pagoda.title': { de: 'Pagoden-Aufstieg', en: 'Pagoda Climb' },
  'pagoda.floor': { de: 'Etage', en: 'Floor' },
  'pagoda.progress': { de: 'Etage {n} von 100', en: 'Floor {n} of 100' },
  'pagoda.allDone': { de: 'Spitze erreicht!', en: 'Top reached!' },
  'pagoda.cleared': { de: 'Etage {n} geschafft!', en: 'Floor {n} cleared!' },
  'pagoda.top': { de: 'Die Spitze der Pagode!', en: 'The top of the pagoda!' },
  'pagoda.nextFloor': { de: 'Nächste Etage →', en: 'Next floor →' },
  'pagoda.toTower': { de: 'Zum Turm', en: 'To the tower' },

  // Mythen-Album
  'menu.album': { de: 'Mythen-Album', en: 'Myth Album' },
  'hub.album.sub': { de: 'Mythen & Schätze sammeln', en: 'Collect myths & treasures' },
  'album.title': { de: 'Mythen-Album', en: 'Myth Album' },
  'album.progress': { de: '{n} von {max} komplett', en: '{n} of {max} complete' },
  'album.hint': { de: 'Mythen- und Schätze-Steine erscheinen auf großen Boards. Entferne ihre Paare, um das Album zu füllen.', en: 'Myth and treasure tiles appear on large boards. Match their pairs to fill the album.' },
  'album.locked': { de: 'Noch nicht entdeckt …', en: 'Not discovered yet …' },
  'album.pairs': { de: '{n}/{max} Paare', en: '{n}/{max} pairs' },
  'album.myth1': { de: 'Drache 龍', en: 'Dragon 龍' },
  'album.myth1.text': { de: 'Der Drache steht für Kraft, Glück und den Segen des Regens — der König der Symbole.', en: 'The dragon stands for strength, fortune and the blessing of rain — the king of symbols.' },
  'album.myth2': { de: 'Phönix 鳳', en: 'Phoenix 鳳' },
  'album.myth2.text': { de: 'Der Phönix verkörpert Erneuerung und Harmonie — mit dem Drachen ein Glückspaar.', en: 'The phoenix embodies renewal and harmony — a lucky pair with the dragon.' },
  'album.myth3': { de: 'Qilin 麒', en: 'Qilin 麒' },
  'album.myth3.text': { de: 'Das sanfte Qilin kündigt Weisheit und glückliche Ereignisse an.', en: 'The gentle qilin heralds wisdom and joyful events.' },
  'album.myth4': { de: 'Schildkröte 龜', en: 'Turtle 龜' },
  'album.myth4.text': { de: 'Die Schildkröte trägt das Zeichen des langen Lebens und der Beständigkeit.', en: 'The turtle carries the sign of long life and steadiness.' },
  'album.treasure1': { de: 'Laterne', en: 'Lantern' },
  'album.treasure1.text': { de: 'Rote Laternen leuchten zu Festen — Zeichen für Freude und Zusammenkunft.', en: 'Red lanterns glow at festivals — a sign of joy and gathering.' },
  'album.treasure2': { de: 'Fächer', en: 'Fan' },
  'album.treasure2.text': { de: 'Der Fächer wedelt Gutes herbei — sein Schriftzeichen klingt wie „Güte".', en: 'The fan waves in good things — its character sounds like "kindness".' },
  'album.treasure3': { de: 'Glücksmünze', en: 'Lucky Coin' },
  'album.treasure3.text': { de: 'Alte Münzen mit quadratischem Loch stehen für Wohlstand und Fülle.', en: 'Old coins with a square hole stand for wealth and plenty.' },
  'album.treasure4': { de: 'Glücksknoten', en: 'Lucky Knot' },
  'album.treasure4.text': { de: 'Der endlose Knoten hat weder Anfang noch Ende — wie das Glück selbst.', en: 'The endless knot has no beginning and no end — like luck itself.' },

  // Saison-Feste
  'fest.laterne': { de: 'Laternenfest', en: 'Lantern Festival' },
  'fest.sakura': { de: 'Sakura-Saison', en: 'Sakura Season' },
  'fest.drache': { de: 'Drachenfest', en: 'Dragon Festival' },
  'fest.mond': { de: 'Mondfest', en: 'Moon Festival' },
  'fest.sub': { de: 'Fest-Board · heute +{n} Münzen', en: 'Festival board · +{n} coins today' },
  'fest.sub.done': { de: 'Bonus geholt — weiterspielen?', en: 'Bonus claimed — keep playing?' },
  'fest.done': { de: '{fest}: Board geschafft!', en: '{fest}: board cleared!' },
  'fest.bonusUsed': { de: 'Der Tagesbonus ist schon abgeholt.', en: "Today's bonus is already claimed." },

  // Einstellungen
  'set.title': { de: 'Einstellungen', en: 'Settings' },
  'set.sound': { de: 'Sound & Haptik', en: 'Sound & haptics' },
  'set.notify': { de: 'Tägliche Erinnerung', en: 'Daily reminder' },
  'set.facts': { de: 'Infokarten zwischen Runden', en: 'Info cards between rounds' },
  'fact.cat.culture': { de: 'Wusstest du?', en: 'Did you know?' },
  'fact.cat.mind': { de: 'Gut für dich', en: 'Good for you' },
  'fact.cat.tip': { de: 'Tipp', en: 'Tip' },
  'set.ai': { de: 'KI-Stärke (4 Spieler)', en: 'AI strength (4 players)' },
  'set.easy': { de: 'Leicht', en: 'Easy' },
  'set.normal': { de: 'Mittel', en: 'Normal' },
  'set.hard': { de: 'Schwer', en: 'Hard' },
  'set.lang': { de: 'Sprache', en: 'Language' },
  'set.langAuto': { de: 'Auto', en: 'Auto' },
  'set.reset': { de: 'Fortschritt zurücksetzen', en: 'Reset progress' },
  'set.resetBtn': { de: 'Reset', en: 'Reset' },
  'set.resetQ': { de: 'Wirklich zurücksetzen?', en: 'Really reset?' },
  'set.resetText': { de: 'Level, Münzen und alle Erfolge gehen verloren.', en: 'Levels, coins and all awards will be lost.' },
  'set.resetYes': { de: 'Ja, zurücksetzen', en: 'Yes, reset' },
  'set.adConsent': { de: 'Werbe-Einwilligung (DSGVO)', en: 'Ad consent (GDPR)' },
  'set.adConsentBtn': { de: 'Ändern', en: 'Change' },

  // Anleitung (Solitaire)
  'howto.title': { de: "So geht's", en: 'How to play' },
  'howto.1': { de: '🎯 Ziel: Räume alle Steine vom Board, indem du gleiche Paare entfernst.', en: '🎯 Goal: clear the board by removing matching pairs.' },
  'howto.2': { de: '✅ Frei ist ein Stein, wenn nichts darauf liegt und links oder rechts frei ist. Nur freie Steine (hell) sind anklickbar.', en: '✅ A tile is free when nothing lies on top and its left or right side is open. Only free (bright) tiles can be tapped.' },
  'howto.3': { de: '🀱 Paare: Zwei gleiche Steine. Blumen passen zu allen Blumen, Jahreszeiten zu allen Jahreszeiten.', en: '🀱 Pairs: two identical tiles. Flowers match any flower, seasons match any season.' },
  'howto.4': { de: '💡 Tipp/Mischen/Zurück sind begrenzte Booster – nachfüllbar mit Münzen oder Video.', en: '💡 Hint/Shuffle/Undo are limited boosters – refill with coins or a video.' },
  'howto.5': { de: '⭐ Schnell und ohne Hilfen = 3 Sterne und mehr Münzen.', en: '⭐ Fast and without helpers = 3 stars and more coins.' },
  'howto.6': { de: '🎁 Jeden Tag: Tages-Belohnung + eigene Tages-Challenge.', en: '🎁 Every day: daily reward + a special daily challenge.' },

  // Shop
  'shop.title': { de: 'Shop', en: 'Shop' },
  'shop.support': { de: 'Käufe unterstützen die Weiterentwicklung 💚', en: 'Purchases support development 💚' },
  'shop.thanks': { de: 'Danke für deinen Kauf! ✅', en: 'Thanks for your purchase! ✅' },
  'shop.failed': { de: 'Kauf fehlgeschlagen.', en: 'Purchase failed.' },
  'shop.removeAds': { de: 'Werbung entfernen', en: 'Remove ads' },
  'shop.coins500': { de: '500 Münzen', en: '500 coins' },
  'shop.coins1500': { de: '1500 Münzen', en: '1,500 coins' },
  'shop.coins5000': { de: '5000 Münzen', en: '5,000 coins' },
  'shop.restore': { de: 'Frühere Käufe', en: 'Previous purchases' },
  'shop.restoreBtn': { de: 'Wiederherstellen', en: 'Restore' },
  'shop.restored': { de: 'Käufe wiederhergestellt! ✅', en: 'Purchases restored! ✅' },
  'shop.restoreNone': { de: 'Keine früheren Käufe gefunden.', en: 'No previous purchases found.' },

  // Themes
  'theme.classic': { de: 'Klassisch', en: 'Classic' },
  'theme.midnight': { de: 'Mitternacht', en: 'Midnight' },
  'theme.sakura': { de: 'Sakura', en: 'Sakura' },
  'theme.sunset': { de: 'Sonnenuntergang', en: 'Sunset' },
  'theme.jade': { de: 'Jade', en: 'Jade' },
  'theme.lackrot': { de: 'Lack & Gold', en: 'Lacquer & Gold' },
  'theme.seide': { de: 'Seidenpapier', en: 'Silk Paper' },
  'theme.lampion': { de: 'Lampion-Nacht', en: 'Lantern Night' },

  // Erfolge
  'ach.title': { de: 'Erfolge', en: 'Awards' },
  'ach.unlocked': { de: 'Erfolg freigeschaltet', en: 'Award unlocked' },
  'ach.first_win': { de: 'Erster Sieg', en: 'First win' },
  'ach.first_win.d': { de: 'Gewinne dein erstes Level', en: 'Win your first level' },
  'ach.wins_10': { de: 'Aufwärmen', en: 'Warming up' },
  'ach.wins_10.d': { de: 'Gewinne 10 Level', en: 'Win 10 levels' },
  'ach.wins_50': { de: 'Profi', en: 'Pro' },
  'ach.wins_50.d': { de: 'Gewinne 50 Level', en: 'Win 50 levels' },
  'ach.level_10': { de: 'Aufstieg', en: 'Climbing' },
  'ach.level_10.d': { de: 'Erreiche Level 10', en: 'Reach level 10' },
  'ach.level_25': { de: 'Kletterer', en: 'High climber' },
  'ach.level_25.d': { de: 'Erreiche Level 25', en: 'Reach level 25' },
  'ach.three_star': { de: 'Makellos', en: 'Flawless' },
  'ach.three_star.d': { de: 'Hol 3 Sterne in einem Level', en: 'Get 3 stars in a level' },
  'ach.streak_7': { de: 'Treuer Spieler', en: 'Loyal player' },
  'ach.streak_7.d': { de: '7 Tage in Folge', en: '7 days in a row' },
  'ach.rich': { de: 'Reich', en: 'Rich' },
  'ach.rich.d': { de: 'Besitze 1000 Münzen', en: 'Own 1,000 coins' },

  // Statistik
  'stats.title': { de: 'Statistik', en: 'Statistics' },
  'stats.level': { de: 'Aktuelles Level', en: 'Current level' },
  'stats.wins': { de: 'Gewonnene Level', en: 'Levels won' },
  'stats.threeStars': { de: '3★-Level', en: '3★ levels' },
  'stats.bestTime': { de: 'Bestzeit', en: 'Best time' },
  'stats.dailies': { de: 'Tages-Challenges', en: 'Daily challenges' },
  'stats.streak': { de: 'Aktuelle Serie', en: 'Current streak' },
  'stats.days': { de: '{n} Tage', en: '{n} days' },
  'stats.coins': { de: 'Münzen', en: 'Coins' },
  'stats.m4': { de: '4-Spieler-Modus', en: '4-player mode' },
  'stats.m4Hands': { de: 'Gespielte Hände', en: 'Hands played' },
  'stats.m4Wins': { de: 'Gewonnene Hände', en: 'Hands won' },
  'stats.m4Rate': { de: 'Siegquote', en: 'Win rate' },
  'stats.m4Faan': { de: 'Beste Hand', en: 'Best hand' },
  'stats.solitaire': { de: 'Solitär', en: 'Solitaire' },
  'stats.best': { de: 'Bestwerte', en: 'Best scores' },
  'stats.faanN': { de: '{n} Faan', en: '{n} faan' },

  // 4-Spieler-Tisch
  'm4.title': { de: 'Ostrunde · Hand {n}', en: 'East round · Hand {n}' },
  'm4.wall': { de: 'Wand: {n}', en: 'Wall: {n}' },
  'm4.dealer': { de: 'Geber', en: 'Dealer' },
  'm4.roundYou': { de: 'Runde {r} · du: {s}', en: 'Round {r} · you: {s}' },
  'm4.discard': { de: 'Abwurf', en: 'Discard' },
  'm4.yourTurn': { de: 'Du bist dran', en: 'Your turn' },
  'm4.draws': { de: '{w} zieht…', en: '{w} draws…' },
  'm4.thinks': { de: '{w} denkt…', en: '{w} is thinking…' },
  'm4.tapDiscard': { de: 'Tippe einen Stein zum Abwerfen', en: 'Tap a tile to discard' },
  'm4.tenpai': { de: 'Bereit – ein Stein fehlt zum Sieg!', en: 'Ready – one tile from winning!' },
  'm4.win': { de: 'Gewinn 🎉', en: 'Win 🎉' },
  'm4.pass': { de: 'Weiter', en: 'Pass' },
  'm4.whichChow': { de: 'Welche Straße?', en: 'Which run?' },
  'm4.youWin': { de: 'Du gewinnst!', en: 'You win!' },
  'm4.wallEmpty': { de: 'Abbruch (Wand leer)', en: 'Draw (wall empty)' },
  'm4.someoneWins': { de: '{w} gewinnt', en: '{w} wins' },
  'm4.matchOver': { de: 'Runde beendet', en: 'Round finished' },
  'm4.east': { de: 'Ost', en: 'East' },
  'm4.south': { de: 'Süd', en: 'South' },
  'm4.west': { de: 'West', en: 'West' },
  'm4.north': { de: 'Nord', en: 'North' },

  // 4-Spieler-Tutorial
  'tut.title': { de: 'So spielst du Mahjong', en: 'How to play Mahjong' },
  'tut.1': { de: '🎯 Ziel: Sammle 4 Sätze + 1 Paar. Ein Satz ist ein Drilling (Pung), Vierling (Kong) oder eine Straße (Chow, z. B. 3-4-5 einer Farbe).', en: '🎯 Goal: collect 4 sets + 1 pair. A set is a triplet (pung), quad (kong) or a run (chow, e.g. 3-4-5 of one suit).' },
  'tut.2': { de: '🔄 Ablauf: Reihum ziehen und einen Stein abwerfen. Wirft ein Gegner etwas Passendes ab, kannst du es beanspruchen (Pung/Kong – Chow nur vom linken Spieler).', en: '🔄 Flow: take turns drawing and discarding. If an opponent discards a tile you need, you can claim it (pung/kong – chow only from the player to your left).' },
  'tut.3': { de: '🌸 Blumen & Jahreszeiten zählen nicht zur Hand – sie geben Bonus und du ziehst nach.', en: '🌸 Flowers & seasons are not part of your hand – they give a bonus and you draw a replacement.' },
  'tut.4': { de: '🏆 Mehr Faan = mehr Punkte: z. B. alle Pungs, eine Farbe, Drachen-Drillinge oder Selbstzug.', en: '🏆 More faan = more points: e.g. all pungs, one suit, dragon triplets or self-draw.' },
  'tut.start': { de: "Los geht's!", en: "Let's go!" },

  // Faan-Muster (scoring4)
  'faan.win': { de: 'Gewinn', en: 'Win' },
  'faan.selfDraw': { de: 'Selbstzug', en: 'Self-draw' },
  'faan.allPungs': { de: 'Alle Pungs', en: 'All pungs' },
  'faan.allChows': { de: 'Alle Chows', en: 'All chows' },
  'faan.fullFlush': { de: 'Farbrein', en: 'Full flush' },
  'faan.halfFlush': { de: 'Halbrein', en: 'Half flush' },
  'faan.dragonPung': { de: 'Drachen-Pung', en: 'Dragon pung' },
  'faan.roundWindPung': { de: 'Rundenwind-Pung', en: 'Round wind pung' },
  'faan.seatWindPung': { de: 'Sitzwind-Pung', en: 'Seat wind pung' },
  'faan.seatFlower': { de: 'Sitz-Blume', en: 'Seat flower' },

  // Modi-Menü + gemeinsame Modus-Strings
  'menu.moreGames': { de: 'Weitere Spiele', en: 'More games' },
  'mode.title': { de: 'Weitere Spiele', en: 'More games' },
  'mode.best': { de: 'Bestwert: {n}', en: 'Best: {n}' },
  'mode.bestLabel': { de: 'Best', en: 'Best' },
  'mode.score': { de: 'Punkte', en: 'Score' },
  'mode.newBest': { de: 'Neuer Bestwert!', en: 'New best!' },
  'mode.gameOver': { de: 'Vorbei', en: 'Game over' },
  'mode.won': { de: 'Geschafft!', en: 'Solved!' },
  'mode.again': { de: 'Nochmal', en: 'Play again' },
  'mode.moves': { de: 'Züge', en: 'Moves' },
  'mode.undo': { de: 'Zurück', en: 'Undo' },
  'mode.hint': { de: 'Tipp', en: 'Hint' },
  'mode.extraMoves': { de: 'Extra-Züge', en: 'Extra moves' },
  'mode.merge': { de: 'Mahjong 2048', en: 'Mahjong 2048' },
  'mode.merge.sub': { de: 'Verschmelzen & wachsen', en: 'Merge & grow' },
  'mode.match3': { de: 'Match-3', en: 'Match-3' },
  'mode.match3.sub': { de: '3 gleiche in einer Reihe', en: 'Line up 3 alike' },
  'mode.tilematch': { de: 'Tile Match', en: 'Tile Match' },
  'mode.tilematch.sub': { de: 'Finde 3 gleiche Steine', en: 'Find 3 matching tiles' },
  'mode.blitz': { de: 'Zeit-Blitz', en: 'Time Attack' },
  'mode.blitz.sub': { de: 'So viele Paare wie möglich', en: 'As many pairs as you can' },
  'mode.dimensions': { de: 'Dimensions 3D', en: 'Dimensions 3D' },
  'mode.dimensions.sub': { de: 'Drehbarer 3D-Steinturm', en: 'Rotatable 3D tile tower' },
  'mode.memory': { de: 'Paare', en: 'Pairs' },
  'mode.memory.sub': { de: 'Gedächtnis-Spiel', en: 'Memory game' },
  'mode.sudoku': { de: 'Sudoku', en: 'Sudoku' },
  'mode.sudoku.sub': { de: 'Mit Kreis-Steinen', en: 'With circle tiles' },

  // Merge (2048)
  'merge.swipe': { de: 'Wische, um Steine zu verschmelzen', en: 'Swipe to merge tiles' },

  // Memory
  'memory.size': { de: 'Größe', en: 'Size' },

  // Match-3
  'match3.goal': { de: 'Ziel: {n} in {m} Zügen', en: 'Goal: {n} in {m} moves' },
  'match3.left': { de: 'Züge übrig: {n}', en: 'Moves left: {n}' },

  // Sudoku
  'sudoku.pick': { de: 'Zelle wählen, dann Stein tippen', en: 'Pick a cell, then a tile' },

  // Mahjong Connect
  'menu.connect': { de: 'Mahjong Connect', en: 'Mahjong Connect' },
  'connect.title': { de: 'Mahjong Connect', en: 'Mahjong Connect' },
  'connect.level': { de: 'Level {n}', en: 'Level {n}' },
  'connect.cleared': { de: 'Brett geschafft!', en: 'Board cleared!' },
  'connect.next': { de: 'Weiter', en: 'Continue' },
  'connect.hint': { de: 'Tipp', en: 'Hint' },
  'connect.shuffle': { de: 'Mischen', en: 'Shuffle' },
  'connect.reshuffled': { de: 'Kein Zug – neu gemischt', en: 'No move – reshuffled' },

  // Tile Match
  'tm.level': { de: 'Level {n}', en: 'Level {n}' },
  'tm.undo': { de: 'Zurück', en: 'Undo' },
  'tm.shuffle': { de: 'Mischen', en: 'Shuffle' },
  'tm.cleared': { de: 'Brett geschafft!', en: 'Board cleared!' },
  'tm.next': { de: 'Weiter', en: 'Continue' },
  'tm.full': { de: 'Ablage voll', en: 'Tray full' },
  'tm.fullText': { de: 'Die Ablage ist voll. Mach 3 Slots frei oder starte neu.', en: 'The tray is full. Free 3 slots or start over.' },
  'tm.free3': { de: '3 Slots frei machen', en: 'Free 3 slots' },

  // Zeit-Blitz
  'blitz.title': { de: 'Zeit-Blitz', en: 'Time Attack' },
  'blitz.score': { de: '{n} Paare', en: '{n} pairs' },
  'blitz.boards': { de: 'Bretter: {n}', en: 'Boards: {n}' },
  'blitz.over': { de: 'Zeit abgelaufen!', en: 'Time up!' },

  // Mahjong Dimensions
  'dim.level': { de: 'Level {n}', en: 'Level {n}' },
  'dim.hint': { de: 'Tipp', en: 'Hint' },
  'dim.shuffle': { de: 'Mischen', en: 'Shuffle' },
  'dim.cleared': { de: 'Turm geschafft!', en: 'Tower cleared!' },

  // Event des Tages
  'event.title': { de: 'Event des Tages', en: 'Daily event' },
  'event.sub': { de: '{game} spielen → +{n} Münzen', en: 'Play {game} → +{n} coins' },

  // Stein-Designs (Skins)
  'menu.design': { de: 'Design', en: 'Design' },
  'design.title': { de: 'Design', en: 'Design' },
  'design.bg': { de: 'Hintergrund', en: 'Background' },
  'design.tiles': { de: 'Stein-Design', en: 'Tile design' },
  'skin.ivory': { de: 'Elfenbein', en: 'Ivory' },
  'skin.sakura': { de: 'Sakura', en: 'Sakura' },
  'skin.minimal': { de: 'Modern', en: 'Modern' },
  'skin.neon': { de: 'Neon-Nacht', en: 'Neon night' },
  'skin.contrast': { de: 'Hoher Kontrast', en: 'High contrast' },

  // Spiele-Hub
  'hub.solitaire': { de: 'Solitaire', en: 'Solitaire' },
  'hub.solitaire.sub': { de: 'Der Klassiker · Level {n}', en: 'The classic · level {n}' },
  'hub.resume': { de: 'Fortsetzen · Level {n}', en: 'Resume · level {n}' },
  'hub.daily': { de: 'Tages-Challenge', en: 'Daily challenge' },
  'hub.daily.sub': { de: 'Jeden Tag neu', en: 'New every day' },
  'hub.connect.sub': { de: 'Gleiche Steine verbinden', en: 'Connect matching tiles' },
  'hub.m4.sub': { de: '1 gegen 3 KI', en: 'You vs 3 AI' },
  'hub.riichi.sub': { de: 'Japanisch · Riichi/Dora', en: 'Japanese · riichi/dora' },
  'hub.more': { de: 'Mehr Spiele', en: 'More games' },
  'hub.more.sub': { de: '2048 · Paare · Sudoku', en: '2048 · pairs · sudoku' },
};

export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = D[key];
  let s = entry ? entry[lang] : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

// Regressionstest: Ein Spielstand aus der Zeit VOR den Level-Modifikatoren muss
// weiter laden.
//
// Warum das eine eigene Prüfung wert ist: Die Modifikatoren (verdeckte Steine,
// Spezialsteine) dürfen ausschließlich im ERZEUGUNGS-Pfad greifen, nie beim
// Fortsetzen aus `mahjong.session.v1`. Täten sie es doch, bekäme eine laufende
// Partie beim Laden plötzlich neue Verdeckungen — und der Level-Fortschritt ist
// laut CLAUDE.md genau an dieser Stelle schon mehrfach gebrochen.
//
// Der gespeicherte Stand hier ist bewusst Level 60: über beiden Schwellen
// (verdeckt ab 30, Spezial ab 50). Käme irgendwo doch ein Modifikator durch,
// fiele es hier auf.
//
// Voraussetzung: `npx vite preview --port 5199` läuft.
// Aufruf: node scripts/check-altstand.mjs
import puppeteer from 'puppeteer-core';

const URL = 'http://127.0.0.1:5199/';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Ein Brett im ALTEN Format: PlacedTile ohne `hidden`, Face ohne `special`.
//
// ⚠ Die Spalten stehen mit LÜCKE (col = i*2). In einem geschlossenen Block wäre
// nur die äußerste Spalte frei, das Brett gälte sofort als festgefahren und die
// App zeigte die Sackgassen-Karte — der Test hätte dann versehentlich „Mischen"
// gedrückt und geprüft, was er nicht prüfen wollte. So liegt jeder Stein frei.
const tiles = [];
for (let k = 0; k < 16; k++) {
  const id = `wan-${Math.floor(k / 2) + 1}`;
  tiles.push({
    key: k, col: (k % 8) * 2, row: Math.floor(k / 8), layer: 0, removed: false,
    face: { id, glyph: '萬', matchKey: id, group: 'man' },
  });
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--lang=de-DE', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
});
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 930, deviceScaleFactor: 1 });

const seitenfehler = [];
page.on('pageerror', (e) => seitenfehler.push(String(e)));

await page.evaluateOnNewDocument((tiles) => {
  localStorage.setItem('CapacitorStorage.mahjong.progress.v1', JSON.stringify({
    level: 60, coins: 500, lang: 'de', showFacts: false,
  }));
  localStorage.setItem('CapacitorStorage.mahjong.session.v1', JSON.stringify({
    level: 60, tiles, elapsedMs: 12000, helpUsed: 0,
  }));
}, tiles);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (ok, msg) => {
  console.log(`   ${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fails.push(msg);
};

await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => {
  const s = document.getElementById('splash');
  return !s || !s.isConnected || getComputedStyle(s).opacity === '0' || s.style.display === 'none';
}, { timeout: 20000 }).catch(() => {});
await sleep(600);

await page.click('.play-btn');
await sleep(1200);
// Es darf KEINE Karte davorliegen. Käme hier die Sackgassen-Karte, würde ein
// blindes Wegtippen „Mischen" auslösen und den Rest des Tests entwerten.
const karte = await page.evaluate(() => document.querySelector('.overlay')?.innerText?.replace(/\n+/g, ' / ') ?? '');
check(!karte, `keine Karte über dem Brett${karte ? ` (stattdessen: ${karte})` : ''}`);

const zustand = await page.evaluate(() => ({
  steine: document.querySelectorAll('.board .tile').length,
  verdeckt: document.querySelectorAll('.board .tile.covered').length,
  motive: [...document.querySelectorAll('.board .tile')].map((t) => t.getAttribute('aria-label')),
}));
console.log(`   Steine ${zustand.steine} · verdeckt ${zustand.verdeckt}`);

check(zustand.steine === 16, `16 Steine übernommen (waren ${zustand.steine})`);
check(zustand.verdeckt === 0, `kein Stein verdeckt (waren ${zustand.verdeckt})`);
check(
  !zustand.motive.some((m) => m?.startsWith('sp-')),
  'kein Spezialstein nachträglich eingesetzt',
);

// Nicht nur rendern — auch ziehen, damit die Logik läuft. Die beiden Klicks
// bewusst in ZWEI Schritten: React verarbeitet sie sonst im selben Durchlauf und
// der zweite sieht die Auswahl des ersten noch nicht.
const klick = (n) => page.evaluate((n) => {
  const paar = [...document.querySelectorAll('.board .tile')]
    .filter((x) => x.getAttribute('aria-label') === 'wan-1');
  paar[n]?.click();
}, n);
await klick(0);
await sleep(250);
check(
  (await page.evaluate(() => document.querySelectorAll('.board .tile.selected').length)) === 1,
  'erster Stein ist ausgewählt',
);
await klick(1);
await sleep(700);
const uebrig = await page.evaluate(() => document.querySelectorAll('.board .tile:not(.removing)').length);
check(uebrig === 14, `Paar entfernt, 14 Steine übrig (waren ${uebrig})`);
check(seitenfehler.length === 0, `keine Seitenfehler${seitenfehler.length ? ': ' + seitenfehler.join(' | ') : ''}`);

await browser.close();
console.log(fails.length ? `\n❌ ${fails.length} Fehler` : '\n✅ alter Spielstand lädt sauber');
process.exit(fails.length ? 1 : 0);

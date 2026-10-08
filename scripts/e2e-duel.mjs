// Ende-zu-Ende-Test des Duells: zwei echte Browser gegen den lokalen Server.
//
//   npx wrangler dev --port 8787          (in einem zweiten Terminal)
//   CHROME=/pfad/zu/chrome node scripts/e2e-duel.mjs [http://127.0.0.1:8787]
//
// Prüft: Einladen über die Oberfläche → Beitritt über den Link → gleicher
// Countdown → Gegnerbalken bewegt sich → genau ein Sieger → Revanche startet
// ein neues Brett → Riichi-Duell läuft an und verteilt verdeckte Hände →
// Verlassen zählt als Aufgabe. Bildschirmfotos landen in $SHOTS (optional).

import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8787';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOTS = process.env.SHOTS ?? null;

let fehler = 0;
const ok = (c, m) => {
  if (!c) {
    fehler++;
    console.log('  ✗ ' + m);
  } else console.log('  ✓ ' + m);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--lang=de-DE'],
});

async function newPlayer(tag) {
  // Eigener Browser-Kontext = eigener Speicher = eigene Spieler-ID.
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 402, height: 874, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'language', { get: () => 'de-DE' });
    Object.defineProperty(navigator, 'languages', { get: () => ['de-DE'] });
  });
  page.on('pageerror', (e) => console.log(`  [${tag}] Seitenfehler: ${e.message}`));
  return page;
}

async function clickText(page, text, sel = 'button') {
  await page.waitForFunction(
    (s, t) => [...document.querySelectorAll(s)].some((b) => b.textContent.includes(t) && !b.disabled),
    { timeout: 15000 },
    sel,
    text,
  );
  await page.evaluate(
    (s, t) => [...document.querySelectorAll(s)].find((b) => b.textContent.includes(t) && !b.disabled).click(),
    sel,
    text,
  );
}

async function shot(page, name) {
  if (!SHOTS) return;
  // Erst nach dem Ladebildschirm fotografieren, sonst zeigt das Bild nur ihn.
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Ein Zug: zwei freie Steine mit gleichem Motiv antippen. Liefert false, wenn keiner da ist. */
async function playPair(page) {
  return page.evaluate(() => {
    // Hängende Auswahl (Tipp während der Sperre verschluckt) erst lösen.
    document.querySelector('.board .tile.selected')?.click();
    const free = [...document.querySelectorAll('.board .tile.free')];
    const by = new Map();
    for (const b of free) {
      const id = b.getAttribute('aria-label');
      // Blumen und Jahreszeiten passen untereinander — Gruppe nach Präfix.
      const g = /^(flower|season)/.test(id) ? id.replace(/\d+$/, '') : id;
      if (!by.has(g)) by.set(g, []);
      by.get(g).push(b);
    }
    for (const list of by.values()) {
      if (list.length >= 2) {
        list[0].click();
        list[1].click();
        return true;
      }
    }
    return false;
  });
}

async function remaining(page) {
  return page.evaluate(() => document.querySelectorAll('.board .tile').length);
}

// ---------------------------------------------------------------------------
console.log('Solitaire-Duell: Einladen, Beitreten, Rennen');
const A = await newPlayer('A');
const B = await newPlayer('B');

await A.goto(BASE, { waitUntil: 'networkidle0' });
await clickText(A, 'Alle Spiele');
await clickText(A, 'Duell', '.game-row');
await clickText(A, 'Freund einladen');
await A.waitForSelector('.duel-code', { timeout: 15000 });
const code = await A.$eval('.duel-code', (e) => e.textContent.trim());
ok(/^[A-Z0-9]{5}$/.test(code), `Code erzeugt: ${code}`);
await shot(A, '1-warteraum');

// B kommt über den Einladungslink (Server leitet auf /?duell=CODE um).
await B.goto(`${BASE}/duell/${code}`, { waitUntil: 'networkidle0' });
ok(new URL(B.url()).search === '', 'Adresse nach Beitritt aufgeräumt');
await Promise.all([A, B].map((p) => p.waitForSelector('.duel-countdown', { timeout: 15000 })));
ok(true, 'beide sehen den Countdown');
await shot(B, '2-countdown');
await Promise.all([A, B].map((p) => p.waitForFunction(() => !document.querySelector('.duel-countdown'), { timeout: 10000 })));

const labels = await Promise.all(
  [A, B].map((p) => p.evaluate(() => [...document.querySelectorAll('.board .tile')].map((b) => b.getAttribute('aria-label')).join(','))),
);
ok(labels[0] === labels[1] && labels[0].length > 0, 'beide haben dasselbe Brett');
const total = await remaining(A);

// A spielt schnell, B langsam. Bei Sackgasse mischt die App selbst.
let schritte = 0;
let bProgressGesehen = false;
while (schritte++ < 300) {
  const ende = await A.$('.duel-result');
  if (ende) break;
  await playPair(A);
  if (schritte % 3 === 0) await playPair(B);
  if (schritte === 8) await shot(B, '2b-rennen');
  await sleep(120);
  if (!bProgressGesehen) {
    bProgressGesehen = await B.evaluate(() => {
      const fill = document.querySelectorAll('.duel-bar-fill.opp')[0];
      return !!fill && parseFloat(fill.style.width) > 0;
    });
  }
}
ok(bProgressGesehen, 'B sieht den Fortschritt von A');
try {
  await Promise.all([A, B].map((p) => p.waitForSelector('.duel-result', { timeout: 60000 })));
} catch (e) {
  for (const [n, p] of [['A', A], ['B', B]]) {
    const st = await p.evaluate(() => ({
      tiles: document.querySelectorAll('.board .tile').length,
      free: [...document.querySelectorAll('.board .tile.free')].map((b) => b.getAttribute('aria-label')).join(' '),
      lock: document.querySelector('.duel-lock')?.textContent ?? '',
    }));
    console.log(`  ${n}:`, JSON.stringify(st));
  }
  if (SHOTS) await A.screenshot({ path: `${SHOTS}/fehler-A.png` });
  throw e;
}
const titel = await Promise.all([A, B].map((p) => p.$eval('.duel-result h2', (e) => e.textContent)));
ok(titel[0] === 'Gewonnen!' && titel[1] === 'Knapp verloren', `genau ein Sieger: A „${titel[0]}", B „${titel[1]}"`);
await shot(A, '3-ergebnis');
ok(total >= 44, `Brett hatte ${total} Steine`);

// Revanche: erst beide, dann neues Brett.
await clickText(A, 'Revanche');
await B.waitForFunction(() => document.body.textContent.includes('Revanche annehmen'), { timeout: 10000 });
ok(true, 'B sieht die Revanche-Anfrage');
await clickText(B, 'Revanche annehmen');
await Promise.all([A, B].map((p) => p.waitForSelector('.duel-countdown', { timeout: 15000 })));
ok(true, 'Revanche startet ein neues Duell');

// Verlassen = Aufgabe
A.on('dialog', (d) => d.accept());
await A.waitForFunction(() => !document.querySelector('.duel-countdown'), { timeout: 10000 });
await A.click('.hud .icon-btn');
await B.waitForSelector('.duel-result', { timeout: 15000 });
const grund = await B.$eval('.duel-result .duel-reason', (e) => e.textContent);
ok(grund.includes('aufgegeben'), `Verlassen zählt als Aufgabe („${grund}")`);
await shot(B, '4-aufgabe');

// ---------------------------------------------------------------------------
console.log('Riichi-Duell: Code-Eingabe, Tisch, verdeckte Hände');
const C = await newPlayer('C');
const D = await newPlayer('D');
await C.goto(BASE, { waitUntil: 'networkidle0' });
await clickText(C, 'Alle Spiele');
await clickText(C, 'Duell', '.game-row');
await clickText(C, 'Riichi 1 gegen 1');
await clickText(C, 'Freund einladen');
await C.waitForSelector('.duel-code');
const code2 = await C.$eval('.duel-code', (e) => e.textContent.trim());

await D.goto(BASE, { waitUntil: 'networkidle0' });
await clickText(D, 'Alle Spiele');
await clickText(D, 'Duell', '.game-row');
await clickText(D, 'Code eingeben');
await D.type('.duel-input', code2.toLowerCase());
await clickText(D, 'Beitreten');
await Promise.all([C, D].map((p) => p.waitForSelector('.m4.riichi.duel .hand .mtile', { timeout: 15000 })));
const haende = await Promise.all([C, D].map((p) => p.$$eval('.seat.bottom .hand .mtile', (l) => l.length)));
ok(haende.every((n) => n >= 13 && n <= 14), `beide haben eine Hand (${haende.join('/')})`);
const backs = await C.$$eval('.seat.top .back', (l) => l.length);
ok(backs >= 13, `Gegnerhand oben nur als Rückseiten (${backs})`);
await shot(C, '5-riichi');

// Ein paar Züge: wer dran ist, wirft den letzten Stein ab.
let abwuerfe = 0;
for (let i = 0; i < 40 && abwuerfe < 6; i++) {
  for (const p of [C, D]) {
    const did = await p.evaluate(() => {
      const tiles = [...document.querySelectorAll('.seat.bottom .hand .mtile.tap')];
      if (!tiles.length) return false;
      tiles[tiles.length - 1].click();
      return true;
    });
    if (did) abwuerfe++;
  }
  await sleep(500);
}
ok(abwuerfe >= 4, `Abwürfe beider Menschen kommen an (${abwuerfe})`);
const teich = await C.$$eval('.pond .mtile', (l) => l.length);
ok(teich >= 4, `Abwürfe liegen im Teich (${teich})`);
await shot(D, '6-riichi-laeuft');

// ---------------------------------------------------------------------------
console.log('Gegen die KI (ohne Server)');
const E = await newPlayer('E');
await E.goto(BASE, { waitUntil: 'networkidle0' });
await clickText(E, 'Alle Spiele');
await clickText(E, 'Duell', '.game-row');
await shot(E, '0-menue');
await clickText(E, 'Gegen KI spielen');
await E.waitForSelector('.duel-countdown', { timeout: 15000 });
await E.waitForFunction(() => !document.querySelector('.duel-countdown'), { timeout: 10000 });
await sleep(9000);
const kiFortschritt = await E.evaluate(() => parseFloat(document.querySelector('.duel-bar-fill.opp')?.style.width ?? '0'));
ok(kiFortschritt > 0, `die KI spielt (${kiFortschritt} %)`);
for (let i = 0; i < 300 && !(await E.$('.duel-result')); i++) {
  await playPair(E);
  await sleep(100);
}
await E.waitForSelector('.duel-result', { timeout: 40000 });
const kiTitel = await E.$eval('.duel-result h2', (e) => e.textContent);
const kiMuenzen = await E.$eval('.duel-result .coins-won', (e) => e.textContent.trim()).catch(() => '');
ok(kiTitel === 'Gewonnen!' && kiMuenzen === '+10', `Sieg gegen die KI mit halben Münzen („${kiTitel}", ${kiMuenzen})`);
await shot(E, '7-ki');

await browser.close();
if (fehler) {
  console.log(`\n${fehler} Fehler`);
  process.exit(1);
}
console.log('\nAlles in Ordnung.');

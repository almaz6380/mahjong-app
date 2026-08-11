// Store-Screenshots erzeugen — fünf Motive × vier Geräteformate × zwei Sprachen.
//
// Bis 1.0.6 entstanden die Bilder von Hand; ab 1.1.0 macht es dieses Skript, weil
// der Tempel-Hintergrund seit dem 11.08.2026 auf ALLEN Bildschirmen liegt und die
// alten Bilder damit den Vorzustand zeigen.
//
// Voraussetzung: `npx vite preview --port 5199` läuft (also der PRODUKTIONS-Build,
// nicht der Dev-Server — sonst landet Vites Fehler-Overlay im Store).
// Aufruf: node scripts/store-screenshots.mjs [ziel]
//   Ziel ist standardmäßig `store/`; die Unterordner entsprechen den bestehenden.
//
// ⚠ Play-Handy-Bilder müssen ≤ 2:1 sein — 1080×2148 passt, die iPhone-1284×2778
// wären zu hoch. Deshalb ein eigenes Format statt einer Skalierung.
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const URL = 'http://127.0.0.1:5199/';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ZIEL = process.argv[2] ?? 'store';

// name → Zielordner, Ansichtsgröße, Pixeldichte. Breite×Dichte muss die vom Store
// erwartete Pixelzahl ergeben.
const GERAETE = [
  { ordner: 'ios-screenshots/iphone65', lang: 'de', w: 428, h: 926, dsf: 3 },
  { ordner: 'ios-screenshots/iphone65-en', lang: 'en', w: 428, h: 926, dsf: 3 },
  { ordner: 'ios-screenshots/ipad13', lang: 'de', w: 1032, h: 1376, dsf: 2 },
  { ordner: 'ios-screenshots/ipad13-en', lang: 'en', w: 1032, h: 1376, dsf: 2 },
  { ordner: 'play-screenshots', lang: 'de', w: 360, h: 716, dsf: 3 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
});

/** Ein frisches Blatt mit gesetztem Fortschritt — je Motiv neu, damit nichts nachhallt. */
async function seite(g) {
  const p = await browser.newPage();
  await p.setViewport({ width: g.w, height: g.h, deviceScaleFactor: g.dsf });
  await p.evaluateOnNewDocument((lang) => {
    // Ein Stand, der die App reich aussehen lässt: genug Münzen für die
    // Design-Zeile, Level 60 (also MIT verdeckten Steinen und Spezialsteinen —
    // genau das, was 1.1.0 zeigen soll), Connect und Pagode angespielt.
    localStorage.setItem('CapacitorStorage.mahjong.progress.v1', JSON.stringify({
      level: 60, coins: 2450, lang, showFacts: false,
      connectLevel: 14, pagodaFloor: 23,
      stats: { bestTimeMs: 142000, dailies: 9, m4Hands: 26, m4Wins: 11, m4BestFaan: 7, modeBest: { memory: 18 } },
    }));
  }, g.lang);
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => {
    const s = document.getElementById('splash');
    return !s || !s.isConnected || getComputedStyle(s).opacity === '0' || s.style.display === 'none';
  }, { timeout: 20000 }).catch(() => {});
  await p.evaluate(() => document.getElementById('splash')?.remove());
  await sleep(900);
  return p;
}

/** Die „Alle Spiele"-Liste öffnen. Die Zeilen tragen keine ID — Reihenfolge zählt. */
const REIHE = { solitaire: 0, connect: 1, m4: 2, riichi: 3, zen: 4, pagoda: 5, album: 6, more: 7 };
async function ausSheet(p, id) {
  await p.click('.allgames-btn');
  await sleep(700);
  await p.evaluate((i) => document.querySelectorAll('.games-sheet .game-row')[i]?.click(), REIHE[id]);
  await sleep(1600);
}

const MOTIVE = [
  { datei: '1-menu.png', tun: async () => {} },
  { datei: '2-board.png', tun: async (p) => { await p.click('.play-btn'); await sleep(1800); } },
  { datei: '3-games.png', tun: async (p) => { await p.click('.allgames-btn'); await sleep(900); } },
  { datei: '4-connect.png', tun: async (p) => ausSheet(p, 'connect') },
  { datei: '5-riichi.png', tun: async (p) => ausSheet(p, 'riichi') },
];

for (const g of GERAETE) {
  const dir = join(ZIEL, g.ordner);
  await mkdir(dir, { recursive: true });
  for (const m of MOTIVE) {
    const p = await seite(g);
    await m.tun(p);
    await sleep(500);
    await p.screenshot({ path: join(dir, m.datei) });
    await p.close();
  }
  console.log(`   ✓ ${g.ordner} (${g.w * g.dsf}×${g.h * g.dsf}, ${g.lang})`);
}

await browser.close();
console.log('\n✅ Screenshots erzeugt');

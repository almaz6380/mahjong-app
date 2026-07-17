// Screenshots + gemessene Steingrößen für Level/Daily/Blitz.
// Voraussetzung: `npm run dev -- --port 5199` läuft.
// Aufruf: node scripts/e2e-boards.mjs [ausgabe-verzeichnis]
import puppeteer from 'puppeteer-core';

const OUT = process.argv[2] ?? '/tmp';
const URL = 'http://localhost:5199/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--lang=de-DE'] });

async function open(level) {
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 930, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument((lvl) => {
    localStorage.setItem('CapacitorStorage.mahjong.progress.v1', JSON.stringify({ level: lvl, coins: 500, lang: 'de' }));
  }, level);
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => {
    const s = document.getElementById('splash');
    return !s || !s.isConnected || getComputedStyle(s).opacity === '0' || s.style.display === 'none';
  }, { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 700));
  return page;
}

async function measure(page, name) {
  await page.waitForSelector('.board-wrap .tile', { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 900));
  const info = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.board .tile')];
    const r = tiles[0].getBoundingClientRect();
    const cols = new Set(tiles.map((t) => Math.round(parseFloat(t.style.left)))).size;
    const rows = new Set(tiles.map((t) => Math.round(parseFloat(t.style.top)))).size;
    return { n: tiles.length, w: Math.round(r.width), h: Math.round(r.height), cols, rows };
  });
  await page.screenshot({ path: `${OUT}/board-${name}.png` });
  console.log(`  ${name.padEnd(10)} ${String(info.n).padStart(3)} Steine · Stein ${info.w}×${info.h} px · ~${info.cols}×${info.rows} Spuren`);
  return info;
}

console.log('\nBretter:');
for (const lvl of [1, 300, 900]) {
  const page = await open(lvl);
  await page.click('.play-btn');
  await measure(page, `level${lvl}`);
  await page.close();
}

// Tages-Challenge
let page = await open(5);
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /täglich|daily/i.test(b.textContent || ''))?.click());
await measure(page, 'daily');
await page.close();

// Zeit-Blitz (über „Alle Spiele" → „Mehr Spiele")
page = await open(5);
await page.click('.allgames-btn');
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => {
  const c = [...document.querySelectorAll('button, [role="button"], a, li, div')].filter((e) => /mehr spiele|more games/i.test(e.textContent || ''));
  c.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
  c[0]?.click();
});
await new Promise((r) => setTimeout(r, 600));
await page.evaluate(() => [...document.querySelectorAll('button, .mode-card')].find((e) => /blitz/i.test(e.textContent || ''))?.click());
await measure(page, 'blitz');
await page.close();

await browser.close();
console.log('');

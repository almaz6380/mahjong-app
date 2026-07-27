// Prüft den Level-Übergang (Regressionstest zu „immer wieder das gleiche Level"):
//   frisch starten -> halb spielen -> Seite neu laden -> fortsetzen -> gewinnen
//   -> „Nächstes Level" -> muss ein NEUES Brett und Level+1 zeigen.
// Voraussetzung: `npm run dev -- --port 5199` läuft.
// Aufruf: node scripts/e2e-level-flow.mjs [ausgabe-verzeichnis]
import puppeteer from 'puppeteer-core';

const URL = 'http://127.0.0.1:5199/';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = process.argv[2] ?? '/tmp';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  // --no-sandbox nur nötig, wenn der Test als root läuft (Container/CI).
  args: ['--lang=de-DE', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
});
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 930, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(() => {
  // Nur beim allerersten Laden setzen – sonst überschreibt der Test den
  // Fortschritt bei jedem Reload und die Persistenz-Prüfung wäre wertlos.
  if (!localStorage.getItem('CapacitorStorage.mahjong.progress.v1'))
    localStorage.setItem('CapacitorStorage.mahjong.progress.v1', JSON.stringify({ level: 1, coins: 500, lang: 'de' }));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (ok, msg) => {
  console.log(`   ${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fails.push(msg);
};

async function waitReady() {
  await page.waitForFunction(() => {
    const s = document.getElementById('splash');
    return !s || !s.isConnected || getComputedStyle(s).opacity === '0' || s.style.display === 'none';
  }, { timeout: 20000 }).catch(() => {});
  await sleep(600);
}

const boardInfo = () =>
  page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.board .tile:not(.removing)')];
    return {
      n: tiles.length,
      sig: tiles.map((t) => `${t.style.left}|${t.style.top}|${t.getAttribute('aria-label')}`).sort().join(','),
      level: document.querySelector('.hud .hanko-chip')?.textContent?.trim(),
      sub: document.querySelector('.hud .sub')?.textContent?.trim(),
    };
  });

const clickPair = () =>
  page.evaluate(() => {
    const key = (id) => (id || '').replace(/^(flower|season)\d+$/, '$1');
    const free = [...document.querySelectorAll('.board .tile.free')];
    const seen = new Map();
    for (const t of free) {
      const f = key(t.getAttribute('aria-label'));
      if (seen.has(f)) { seen.get(f).click(); t.click(); return true; }
      seen.set(f, t);
    }
    return false;
  });

async function solve(maxPairs = 300) {
  for (let i = 0; i < maxPairs; i++) {
    if (await page.$('.overlay .stars')) return true;
    if (!(await clickPair())) {
      const shuffled = await page.evaluate(() => {
        const b = [...document.querySelectorAll('.overlay button, .controls button')].find((x) => /misch/i.test(x.textContent || ''));
        if (b) { b.click(); return true; }
        return false;
      });
      if (!shuffled) return false;
      await sleep(300);
      continue;
    }
    await sleep(90);
  }
  return false;
}

// „Nächstes Level" + evtl. „Wusstest du?"-Karte wegtippen
async function nextLevel() {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.overlay .card button')].find((x) => /weiter|nächst|next/i.test(x.textContent || ''));
    b?.click();
  });
  await sleep(600);
  await page.evaluate(() => document.querySelector('.fact-overlay')?.click());
  await sleep(900);
}

await page.goto(URL, { waitUntil: 'networkidle0' });
await waitReady();

console.log('\n1) Frisch starten');
await page.click('.play-btn');
await page.waitForSelector('.board .tile');
await sleep(500);
const lvl1 = await boardInfo();
console.log(`    Level ${lvl1.level}: ${lvl1.n} Steine · ${lvl1.sub}`);

console.log('2) Vier Paare spielen, dann Seite neu laden');
for (let i = 0; i < 4; i++) { await clickPair(); await sleep(150); }
await sleep(1000);
await page.reload({ waitUntil: 'networkidle0' });
await waitReady();

console.log('3) Fortsetzen und Level zu Ende spielen');
await page.click('.play-btn');
await page.waitForSelector('.board .tile');
await sleep(500);
const resumed = await boardInfo();
check(resumed.n > 0 && resumed.n < lvl1.n, `fortgesetzt mit ${resumed.n} von ${lvl1.n} Steinen`);
check(await solve(), 'Level 1 gelöst');

console.log('4) „Nächstes Level"');
await nextLevel();
const lvl2 = await boardInfo();
console.log(`    Level ${lvl2.level}: ${lvl2.n} Steine · ${lvl2.sub}`);
check(lvl2.level === '2', `Levelnummer ist ${lvl2.level} (erwartet 2)`);
check(lvl2.sig !== resumed.sig, 'Brett ist NICHT das alte, fortgesetzte Brett');
check(lvl2.sig !== lvl1.sig, 'Brett ist nicht identisch mit dem Level-1-Brett');
check(lvl2.n % 2 === 0 && lvl2.n >= 8, `vollständiges Brett (${lvl2.n} Steine)`);
await page.screenshot({ path: `${OUT}/verify-level2.png` });

console.log('5) Weiter zu Level 3');
check(await solve(), 'Level 2 gelöst');
await nextLevel();
const lvl3 = await boardInfo();
console.log(`    Level ${lvl3.level}: ${lvl3.n} Steine · ${lvl3.sub}`);
check(lvl3.level === '3', `Levelnummer ist ${lvl3.level} (erwartet 3)`);
check(lvl3.sig !== lvl2.sig, 'Level-3-Brett unterscheidet sich von Level 2');

console.log('6) Neu laden — Fortschritt muss erhalten bleiben');
await page.reload({ waitUntil: 'networkidle0' });
await waitReady();
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('CapacitorStorage.mahjong.progress.v1') || '{}').level);
check(stored === 3, `gespeichertes Level nach Reload: ${stored}`);

console.log('7) Level 3 gewinnen, „Weiter" NICHT tippen, App neu starten');
await page.click('.play-btn');
await page.waitForSelector('.board .tile');
await sleep(500);
check(await solve(), 'Level 3 gelöst');
await page.reload({ waitUntil: 'networkidle0' });
await waitReady();
const healed = await page.evaluate(() => JSON.parse(localStorage.getItem('CapacitorStorage.mahjong.progress.v1') || '{}').level);
check(healed === 4, `Level nach Neustart: ${healed} (erwartet 4)`);
await page.click('.play-btn');
await page.waitForSelector('.board .tile');
await sleep(500);
const lvl4 = await boardInfo();
console.log(`    Level ${lvl4.level}: ${lvl4.n} Steine · ${lvl4.sub}`);
check(lvl4.level === '4', `Menü startet Level ${lvl4.level} (erwartet 4)`);
check(lvl4.sig !== lvl3.sig, 'neues Brett statt des bereits gelösten');

console.log(fails.length ? `\n❌ ${fails.length} Fehler` : '\n✅ alles grün');
await browser.close();
process.exit(fails.length ? 1 : 0);

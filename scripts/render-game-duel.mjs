// Hub-Icon für „Duell" (src/assets/game-duel.webp) aus vorhandenen
// Stein-Motiven rendern — wie render-game-lawine.mjs, kein KI-Bild.
// Komposition: Drache gegen Phönix, zwei Steine schräg gegeneinander
// gelehnt, dazwischen ein goldener Funke.
//
// Das Bildfeld in der App ist `.game-ico` (44×44, object-fit: contain) —
// das Motiv ist deshalb quadratisch und randfüllend angelegt, Details grob.
//
// Aufruf: node scripts/render-game-lawine.mjs   (CHROME=<pfad> setzen, falls
// kein macOS-Chrome; im Cloud-Container /opt/pw-browsers/chromium)
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const b64 = (p, m) => `data:${m};base64,${readFileSync(join(REPO, p)).toString('base64')}`;
const MARBLE = b64('src/assets/tiles/face-marble.webp', 'image/webp');
const DRACHE = b64('src/assets/tiles/myth1.webp', 'image/webp');
const PHOENIX = b64('src/assets/tiles/myth2.webp', 'image/webp');

const html = `<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:512px;height:512px;overflow:hidden;background:transparent}
.tile{position:absolute;background-image:url(${MARBLE});background-size:cover;background-position:center;
  border-radius:26px;display:flex;align-items:center;justify-content:center;
  box-shadow:0 18px 30px rgba(0,0,0,.45),inset 0 0 0 5px rgba(201,162,39,.9),inset 0 3px 6px rgba(255,255,255,.6)}
.tile img{width:66%;height:66%;object-fit:contain}
.t1{width:214px;height:284px;left:34px;top:170px;transform:rotate(14deg);z-index:2}
.t2{width:214px;height:284px;right:34px;top:170px;transform:rotate(-14deg);z-index:1}
/* Funke zwischen den Steinen: liest sich bei 44 px als „gegeneinander". */
.spark{position:absolute;left:176px;top:10px;width:160px;height:160px;z-index:3;
  filter:drop-shadow(0 0 14px rgba(255,214,90,.9))}
</style>
<div class="tile t1"><img src="${DRACHE}"></div>
<div class="tile t2"><img src="${PHOENIX}"></div>
<svg class="spark" viewBox="0 0 100 100"><path d="M50 0 L59 38 L100 50 L59 62 L50 100 L41 62 L0 50 L41 38 Z" fill="#ffd65a" stroke="#fff6cf" stroke-width="2"/></svg>`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
});
const page = await browser.newPage();
await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
// ⚠ NICHT `networkidle0` — alle Bilder sind data:-URIs (siehe render-app-icon.mjs).
await page.setContent(html, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({
  path: join(REPO, 'src/assets/game-duel.webp'), type: 'webp', quality: 92,
  omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 },
});
await browser.close();
console.log('src/assets/game-duel.webp (512px)');

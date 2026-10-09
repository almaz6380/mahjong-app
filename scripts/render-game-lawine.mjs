// Hub-Icon für „Lawine" (src/assets/game-lawine.webp) aus vorhandenen
// Stein-Motiven rendern — kein KI-Bild, dieselben Zutaten wie das App-Icon
// (Marmor-Fläche + Goldrand + Gemini-Motive), Komposition: drei Steine im
// Fallen, versetzt wie eine kleine Lawine.
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
const KIRSCHE = b64('src/assets/tiles/season1.webp', 'image/webp');
const LATERNE = b64('src/assets/tiles/treasure1.webp', 'image/webp');

const html = `<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:512px;height:512px;overflow:hidden;background:transparent}
.tile{position:absolute;background-image:url(${MARBLE});background-size:cover;background-position:center;
  border-radius:26px;display:flex;align-items:center;justify-content:center;
  box-shadow:0 18px 30px rgba(0,0,0,.45),inset 0 0 0 5px rgba(201,162,39,.9),inset 0 3px 6px rgba(255,255,255,.6)}
.tile img{width:66%;height:66%;object-fit:contain}
/* Drei Steine im Fallen: oben klein und stark gedreht, unten groß und fast
   gelandet — die Diagonale liest sich auch bei 44 px als Rutschen. */
.t1{width:164px;height:218px;right:38px;top:2px;transform:rotate(24deg)}
.t2{width:196px;height:260px;left:186px;top:130px;transform:rotate(-13deg);z-index:2}
.t3{width:224px;height:298px;left:14px;top:212px;transform:rotate(5deg);z-index:3}
</style>
<div class="tile t1"><img src="${LATERNE}"></div>
<div class="tile t2"><img src="${KIRSCHE}"></div>
<div class="tile t3"><img src="${DRACHE}"></div>`;

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
  path: join(REPO, 'src/assets/game-lawine.webp'), type: 'webp', quality: 92,
  omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 },
});
await browser.close();
console.log('src/assets/game-lawine.webp (512px)');

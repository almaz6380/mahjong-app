// App-Icon aus den drei Steinen der Feature-Grafik rendern (Variante C).
//
// Erzeugt:
//   assets/icon-only.png        1024 — volles Quadrat (iOS; keine Transparenz,
//                                      keine runden Ecken — die setzt das System)
//   assets/icon-background.png  1024 — nur der Verlauf (Android, adaptive Ebene)
//   assets/icon-foreground.png  1024 — nur die Steine, transparent, im Schutzbereich
//   store/play-icon-512.png     512  — Play-Store-Eintrag
//   store/play-icon-1024.png    1024 — Reserve
//
// Android beschneidet adaptive Icons außen: Inhalt muss in die mittleren ~66 %.
// Deshalb ist die Vordergrund-Ebene kleiner skaliert als das iOS-Quadrat.
//
// Aufruf: node scripts/render-app-icon.mjs
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const b64 = (p, m) => `data:${m};base64,${readFileSync(join(REPO, p)).toString('base64')}`;
const MARBLE = b64('src/assets/tiles/face-marble.webp', 'image/webp');
const DRACHE = b64('src/assets/tiles/myth1.webp', 'image/webp');
const ZHONG = b64('src/assets/symbol-zhong.webp', 'image/webp');
const MUENZE = b64('src/assets/coin.webp', 'image/webp');

const BG = 'radial-gradient(120% 130% at 30% 22%,#1d5c46 0%,#134536 48%,#0b2c22 100%)';

// Die Steingruppe; `s` skaliert sie (1 = iOS-Vollformat, kleiner für Android).
const gruppe = (s) => `
<div class="grp" style="transform:translate(-50%,-50%) scale(${s})">
  <div class="tile t-l"><img src="${DRACHE}"></div>
  <div class="tile t-r"><img src="${MUENZE}"></div>
  <div class="tile t-c"><img src="${ZHONG}"></div>
</div>`;

const stil = (hintergrund) => `
*{margin:0;padding:0;box-sizing:border-box}
body{width:1024px;height:1024px;overflow:hidden;background:${hintergrund}}
.grp{position:absolute;left:50%;top:50%;width:1024px;height:1024px}
.tile{position:absolute;background-image:url(${MARBLE});background-size:cover;
  background-position:center;border-radius:58px;
  box-shadow:0 34px 64px rgba(0,0,0,.5),inset 0 0 0 9px rgba(201,162,39,.9);
  display:flex;align-items:center;justify-content:center}
.tile img{object-fit:contain}
.t-l{width:330px;height:446px;left:56px;top:330px;transform:rotate(-17deg);opacity:.96}
.t-r{width:330px;height:446px;right:56px;top:330px;transform:rotate(17deg);opacity:.96}
.t-c{width:560px;height:756px;left:232px;top:126px;z-index:2}
.t-l img,.t-r img{width:64%;height:64%}
.t-c img{width:66%;height:66%}
`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
mkdirSync(join(REPO, 'store'), { recursive: true });

async function schuss(html, ziel, groesse = 1024, transparent = false) {
  await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: groesse / 1024 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({
    path: join(REPO, ziel), omitBackground: transparent,
    clip: { x: 0, y: 0, width: 1024, height: 1024 },
  });
  console.log(`  ${ziel} (${groesse}px)`);
}

// iOS / Store: volles Quadrat mit Hintergrund
const voll = `<style>${stil(BG)}</style>${gruppe(1)}`;
await schuss(voll, 'assets/icon-only.png');
await schuss(voll, 'store/play-icon-1024.png');
await schuss(voll, 'store/play-icon-512.png', 512);

// Android: Hintergrund-Ebene (nur Verlauf)
await schuss(`<style>${stil(BG)}</style>`, 'assets/icon-background.png');

// Android: Vordergrund-Ebene, transparent, auf ~66 % Schutzbereich verkleinert
await schuss(`<style>${stil('transparent')}</style>${gruppe(0.66)}`,
             'assets/icon-foreground.png', 1024, true);

await browser.close();
console.log('\nDanach: npx @capacitor/assets generate  (erzeugt alle Plattformgrößen)');

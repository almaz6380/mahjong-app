// Gerenderte Karten (Chromium → transparentes PNG), gemeinsam fuer Reel und Spot.
//
// Warum Chromium und nicht ffmpeg: `drawtext` fehlt im ffmpeg-static-Build
// vollstaendig, und selbst mit dem Filter koennte er die woff2-Schrift nicht
// lesen. `omitBackground` liefert den Alphakanal.
//
// ⚠ Die Abspannkarte ist die MARKE. Sie steht deshalb genau einmal hier und
// nicht je einmal in make-reel.mjs und spot.mjs — zwei Fassungen der Karte
// waeren der Anfang davon, dass Reel und Spot verschieden aussehen.

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserPfad } from './browser.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ASSETS = join(dirname(fileURLToPath(import.meta.url)), 'assets');

export const B = 1080, H = 1920;

export const ABSPANN = {
  titel: 'Mahjong\nRoyale',
  sub: 'Solitaire · Connect · Riichi · 4 Players',
  cta: 'Free on the App Store & Google Play',
};

const css = () => {
  const font = readFileSync(join(ASSETS, 'outfit.woff2')).toString('base64');
  return `
@font-face{font-family:'Outfit';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;background:transparent;font-family:'Outfit',sans-serif;color:#fff}
.mitte{position:absolute;left:70px;width:940px;text-align:center}
.schatten{text-shadow:0 0 30px rgba(6,32,24,.95),-3px -3px 0 #06201a,3px -3px 0 #06201a,-3px 3px 0 #06201a,3px 3px 0 #06201a}`;
};

/**
 * Oeffnet einen Browser und reicht `schuss(html, datei, groesse?)` weiter.
 * Der Browser wird zuverlaessig geschlossen, auch wenn `fn` wirft.
 */
export async function mitBrowser(fn) {
  const stil = css();
  const browser = await chromium.launch({ executablePath: browserPfad() });
  try {
    const page = await browser.newPage({ viewport: { width: B, height: H } });
    const schuss = async (html, datei, groesse) => {
      if (groesse) await page.setViewportSize(groesse);
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>${stil}</style>${html}`,
        { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      writeFileSync(datei, await page.screenshot({ type: 'png', omitBackground: true }));
    };
    return await fn(schuss, page);
  } finally {
    await browser.close();
  }
}

/** Der deckende Abspann: Logo, Name, Modi, goldener Knopf. */
export async function abspannKarte(schuss, datei) {
  const logo = readFileSync(join(ASSETS, 'logo.png')).toString('base64');
  await schuss(
    `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#123f2e,#0b2a1e 60%,#06201a)"></div>
     <img src="data:image/png;base64,${logo}" style="position:absolute;left:390px;top:545px;width:300px;height:300px">
     <div class="mitte" style="top:930px;font-size:104px;font-weight:800;line-height:1.05">
       ${ABSPANN.titel.split('\n').join('<br>')}</div>
     <div class="mitte" style="top:1200px;font-size:36px;font-weight:500;opacity:.8">${ABSPANN.sub}</div>
     <div style="position:absolute;left:130px;top:1330px;width:820px;padding:32px 0;border-radius:999px;
                 text-align:center;font-size:38px;font-weight:700;color:#06201a;
                 background:linear-gradient(100deg,#ffe07a,#f5b301)">${ABSPANN.cta}</div>`,
    datei, { width: B, height: H });
}

// Play-Feature-Grafik (1024×500) je Sprache rendern.
//
// Warum je Sprache: Play zeigt Nutzern ohne eigene Sprachfassung die Grafik der
// Standardsprache. Solange es nur die deutsche gab, stand „4 Spieler" auch im
// japanischen und brasilianischen Eintrag.
//
// Rezept: HTML mit eingebetteten src/assets-Bildern (data:-URIs, weil das
// gerenderte Dokument keinen Server hat) + Inter-woff2 → puppeteer-core mit
// System-Chrome, viewport 1024×500 bei dsf 1, screenshot mit clip.
//
// Aufruf: node scripts/render-feature-graphic.mjs [ausgabe-verzeichnis]
//         (Standard: store/feature-graphics/)
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] ?? join(REPO, 'store', 'feature-graphics');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Untertitel je Sprache. „Solitaire", „Riichi" und „Connect" sind Modusnamen
// und bleiben; nur die Spielerzahl wird übersetzt.
const UNTERTITEL = {
  'de-DE': 'Solitaire · Riichi · Connect · 4 Spieler',
  'en-US': 'Solitaire · Riichi · Connect · 4 Players',
  'es-ES': 'Solitaire · Riichi · Connect · 4 jugadores',
  'pt-BR': 'Solitaire · Riichi · Connect · 4 jogadores',
  'fr-FR': 'Solitaire · Riichi · Connect · 4 joueurs',
  'it-IT': 'Solitaire · Riichi · Connect · 4 giocatori',
  'ja-JP': 'ソリティア · リーチ · コネクト · 4人対戦',
};

const b64 = (p, mime) => `data:${mime};base64,${readFileSync(join(REPO, p)).toString('base64')}`;
const FONT = b64('src/assets/fonts/inter.woff2', 'font/woff2');
const MARBLE = b64('src/assets/tiles/face-marble.webp', 'image/webp');
const DRACHE = b64('src/assets/tiles/myth1.webp', 'image/webp');
const ZHONG = b64('src/assets/symbol-zhong.webp', 'image/webp');
const MUENZE = b64('src/assets/coin.webp', 'image/webp');

const html = (untertitel, jp) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Inter;src:url(${FONT}) format('woff2');font-weight:100 900;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1024px;height:500px;overflow:hidden;font-family:Inter,-apple-system,sans-serif;
  background:radial-gradient(120% 140% at 18% 30%,#1d5c46 0%,#134536 45%,#0d3227 100%)}
.wrap{position:relative;width:1024px;height:500px}
.text{position:absolute;left:74px;top:104px}
h1{font-size:78px;font-weight:800;line-height:.98;letter-spacing:-1.5px;color:#f4f1e8}
h1 .gold{background:linear-gradient(180deg,#f0d68a,#c9a227);-webkit-background-clip:text;
  -webkit-text-fill-color:transparent}
.rule{width:104px;height:5px;border-radius:3px;margin:26px 0 18px;
  background:linear-gradient(90deg,#e8cf86,#b8941f)}
.sub{font-size:27px;font-weight:700;color:#e8cf86;letter-spacing:${jp ? 0 : .2}px;
  white-space:nowrap;display:inline-block}
.tiles{position:absolute;right:58px;top:50%;transform:translateY(-50%);width:430px;height:400px}
.tile{position:absolute;width:186px;height:250px;border-radius:22px;background-image:url(${MARBLE});
  background-size:cover;background-position:center;
  box-shadow:0 26px 48px rgba(0,0,0,.42),inset 0 0 0 3px rgba(201,162,39,.85);
  display:flex;align-items:center;justify-content:center}
.tile img{width:60%;height:60%;object-fit:contain}
.t-l{left:0;top:78px;transform:rotate(-9deg)}
.t-r{right:0;top:78px;transform:rotate(9deg)}
.t-c{left:122px;top:36px;z-index:2;width:196px;height:266px}
.t-c img{width:52%;height:52%}
</style><div class=wrap>
<div class=text><h1>Mahjong<br><span class=gold>Royale</span></h1>
<div class=rule></div><div class=sub>${untertitel}</div></div>
<div class=tiles>
  <div class="tile t-l"><img src="${DRACHE}"></div>
  <div class="tile t-r"><img src="${MUENZE}"></div>
  <div class="tile t-c"><img src="${ZHONG}"></div>
</div></div>`;

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });

// Der Untertitel darf nicht unter die Steine laufen: Textspalte endet dort,
// wo der linke Stein beginnt. Schriftgröße so weit verkleinern, bis es passt.
const MAX_BREITE = 452;

for (const [loc, sub] of Object.entries(UNTERTITEL)) {
  await page.setContent(html(sub, loc === 'ja-JP'), { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  const groesse = await page.evaluate((max) => {
    const el = document.querySelector('.sub');
    let px = 27;
    while (px > 14 && el.getBoundingClientRect().width > max) {
      px -= 0.5;
      el.style.fontSize = px + 'px';
    }
    return { px, breite: Math.round(el.getBoundingClientRect().width) };
  }, MAX_BREITE);
  if (groesse.breite > MAX_BREITE) {
    console.error(`  ${loc}  PASST NICHT (${groesse.breite}px bei ${groesse.px}px Schrift)`);
    process.exitCode = 1;
    continue;
  }
  const ziel = join(OUT, `feature-${loc}.png`);
  await page.screenshot({ path: ziel, clip: { x: 0, y: 0, width: 1024, height: 500 } });
  console.log(`  ${loc}  →  ${groesse.breite}px bei ${groesse.px}px Schrift  →  ${ziel}`);
}
await browser.close();
console.log('\nFertig. Hochladen mit: python3 scripts/upload-feature-graphics.py');

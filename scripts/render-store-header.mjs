// App-Store-Kopfzeile („Header" der Produktseite, neu seit WWDC26) je Sprache.
//
// Apple zeigt die Kopfzeile oben auf der Produktseite und in den Suchergebnissen.
// Die genauen Maße und Beschnittregeln waren beim Bau nicht dokumentiert —
// deshalb ist der Aufbau MITTIG und beschnittfest: Schriftzug, Steine und
// Modusleiste liegen in der mittleren Zone, links und rechts ist nur Foto.
// So überlebt das Motiv auch einen Beschnitt auf 4:3 oder quadratisch.
//
// Gleiches Rezept wie render-feature-graphic.mjs (data:-URIs, Inter-woff2,
// puppeteer-core). Gerendert wird 1920×1080 CSS-Pixel bei dsf 2 → 3840×2160.
//
// Aufruf: CHROME=… node scripts/render-store-header.mjs [ausgabe-verzeichnis]
//         (Standard: store/app-store-header/)
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] ?? join(REPO, 'store', 'app-store-header');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1920;
const H = 1080;
const DSF = Number(process.env.DSF ?? 2);
// FORMAT=png: verlustfrei als PNG (für die Kopfzeile verlangt Apple PNG in genau
// 5244×2950 — dafür mit DSF=3 rendern und danach skalieren, siehe unten).
const PNG = process.env.FORMAT === 'png';

// Die Modusnamen so, wie sie in der App unter „Alle Spiele" stehen
// (menu.* in i18n.ts bzw. src/locales/*.ts).
const MODI = {
  'de-DE': 'Solitaire · Duell · Lawine · Riichi · Connect',
  'en-US': 'Solitaire · Duel · Avalanche · Riichi · Connect',
  'es-ES': 'Solitaire · Duelo · Avalancha · Riichi · Connect',
  'pt-BR': 'Solitaire · Duelo · Avalanche · Riichi · Connect',
  'fr-FR': 'Solitaire · Duel · Avalanche · Riichi · Connect',
  'it-IT': 'Solitaire · Duello · Valanga · Riichi · Connect',
  'ja-JP': 'ソリティア · 対戦 · 雪崩 · リーチ · コネクト',
};

const b64 = (p, mime) => `data:${mime};base64,${readFileSync(join(REPO, p)).toString('base64')}`;
const FONT = b64('src/assets/fonts/inter.woff2', 'font/woff2');
const MARBLE = b64('src/assets/tiles/face-marble.webp', 'image/webp');
const DRACHE = b64('src/assets/tiles/myth1.webp', 'image/webp');
const ZHONG = b64('src/assets/symbol-zhong.webp', 'image/webp');
const MUENZE = b64('src/assets/coin.webp', 'image/webp');
const TEMPEL = b64('src/assets/home-temple.webp', 'image/webp');

const html = (modi, jp) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Inter;src:url(${FONT}) format('woff2');font-weight:100 900;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:Inter,-apple-system,sans-serif;background:#121e1d}
.wrap{position:relative;width:${W}px;height:${H}px;overflow:hidden}
.foto{position:absolute;inset:0;background:url(${TEMPEL}) 50% 24%/cover no-repeat}
/* Mitte leicht abgedunkelt fuer die Schrift, Raender kraeftiger (Vignette),
   unten in die Grundfarbe der App auslaufend. */
.schleier{position:absolute;inset:0;background:
  radial-gradient(60% 70% at 50% 46%, rgba(9,30,24,.38) 0%, rgba(9,30,24,.62) 70%, rgba(9,30,24,.82) 100%),
  linear-gradient(180deg, rgba(18,30,29,0) 60%, rgba(18,30,29,.85) 100%)}
.mitte{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:1100px;
  display:flex;flex-direction:column;align-items:center;z-index:3}
/* Schatten als filter am ganzen Schriftzug: text-shadow laege beim
   Goldverlauf (background-clip:text) HINTER der Fuellung und machte das Gold oliv. */
h1{font-size:118px;font-weight:800;letter-spacing:-2.5px;color:#f4f1e8;white-space:nowrap;
  filter:drop-shadow(0 6px 22px rgba(4,18,14,.75))}
h1 .gold{background:linear-gradient(180deg,#fbe6a2 0%,#e9c55a 55%,#c9a227 100%);-webkit-background-clip:text;
  -webkit-text-fill-color:transparent}
.tiles{position:relative;width:780px;height:420px;margin:26px 0 30px}
.tile{position:absolute;width:250px;height:336px;border-radius:30px;background:url(${MARBLE}) center/cover;
  box-shadow:0 34px 64px rgba(0,0,0,.5),inset 0 0 0 4px rgba(201,162,39,.88);
  display:flex;align-items:center;justify-content:center}
.tile img{width:60%;height:60%;object-fit:contain}
.t-l{left:10px;top:58px;transform:rotate(-10deg)}
.t-r{right:10px;top:58px;transform:rotate(10deg)}
.t-c{left:255px;top:4px;z-index:2;width:270px;height:362px}
.t-c img{width:52%;height:52%}
.rule{width:150px;height:6px;border-radius:3px;margin-bottom:22px;
  background:linear-gradient(90deg,#e8cf86,#b8941f)}
.modi{font-size:44px;font-weight:700;color:#e8cf86;letter-spacing:${jp ? 0 : .3}px;white-space:nowrap;
  text-shadow:0 3px 16px rgba(4,18,14,.85)}
</style><div class=wrap><div class=foto></div><div class=schleier></div>
<div class=mitte>
  <h1>Mahjong <span class=gold>Royale</span></h1>
  <div class=tiles>
    <div class="tile t-l"><img src="${DRACHE}"></div>
    <div class="tile t-r"><img src="${MUENZE}"></div>
    <div class="tile t-c"><img src="${ZHONG}"></div>
  </div>
  <div class=rule></div>
  <div class=modi>${modi}</div>
</div></div>`;

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: [...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: DSF });

// Modusleiste darf die mittlere Zone (1100 px) nicht verlassen — sonst schnitte
// ein 4:3-Beschnitt die Ränder ab.
const MAX_BREITE = 1100;
for (const [loc, modi] of Object.entries(MODI)) {
  // ⚠ NICHT networkidle0 (siehe render-feature-graphic.mjs).
  await page.setContent(html(modi, loc === 'ja-JP'), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  const groesse = await page.evaluate((max) => {
    const el = document.querySelector('.modi');
    let px = 44;
    while (px > 24 && el.getBoundingClientRect().width > max) {
      px -= 1;
      el.style.fontSize = px + 'px';
    }
    return { px, breite: Math.round(el.getBoundingClientRect().width) };
  }, MAX_BREITE);
  const ziel = join(OUT, `header-${loc}.${PNG ? 'png' : 'jpg'}`);
  // JPEG für die In-App-Event-Fassung (ein Foto als PNG wiegt gut 4 MB); PNG
  // für die Kopfzeile, weil Apple dort nur PNG annimmt.
  await page.screenshot(PNG
    ? { path: ziel, type: 'png', clip: { x: 0, y: 0, width: W, height: H } }
    : { path: ziel, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: W, height: H } });
  console.log(`  ${loc}  →  ${groesse.breite}px bei ${groesse.px}px Schrift  →  ${ziel}`);
}
await browser.close();

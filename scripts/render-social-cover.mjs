// Titelbild für die Facebook-Seite (1640×624).
//
// ⚠ Der Grund für das mittige Layout: Facebook zeigt dasselbe Bild in zwei
// sehr verschiedenen Seitenverhältnissen. Am Rechner 820×312 (2,63:1), am
// Handy rund 640×360 (1,78:1) — und zwar als MITTIGER Ausschnitt. Aus 1640
// Punkten Breite bleiben am Handy also nur `624 × 1,78 ≈ 1110` übrig, das
// sind 68 %; je 265 Punkte links und rechts fallen weg.
//
// Die Play-Feature-Grafik (render-feature-graphic.mjs) taugt deshalb NICHT als
// Vorlage: Dort steht die Schrift ganz links und die Steine stehen ganz rechts
// — genau das, was der Handy-Ausschnitt abschneidet. Hier sitzt stattdessen
// alles als eine Gruppe in der Mitte, innerhalb der 1110er Zone.
//
// Aufruf: node scripts/render-social-cover.mjs [ausgabe-verzeichnis]
//         (Standard: store/social/)
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserPfad } from './reel/browser.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] ?? join(REPO, 'store', 'social');

const B = 1640, H = 624;
const SICHER = Math.round(H * 16 / 9); // 1110 — was am Handy uebrig bleibt

const b64 = (p, mime) => `data:${mime};base64,${readFileSync(join(REPO, p)).toString('base64')}`;
const FONT = b64('src/assets/fonts/inter.woff2', 'font/woff2');
const MARBLE = b64('src/assets/tiles/face-marble.webp', 'image/webp');
const DRACHE = b64('src/assets/tiles/myth1.webp', 'image/webp');
const ZHONG = b64('src/assets/symbol-zhong.webp', 'image/webp');
const MUENZE = b64('src/assets/coin.webp', 'image/webp');
const TEMPEL = b64('src/assets/home-temple.webp', 'image/webp');

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Inter;src:url(${FONT}) format('woff2');font-weight:100 900;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${B}px;height:${H}px;overflow:hidden;font-family:Inter,-apple-system,sans-serif;
  background:radial-gradient(120% 160% at 50% 30%,#1d5c46 0%,#134536 45%,#0d3227 100%)}
.wrap{position:relative;width:${B}px;height:${H}px;overflow:hidden}
.foto{position:absolute;inset:0;background-image:url(${TEMPEL});background-size:cover;
  background-position:50% 24%;background-repeat:no-repeat}
/* Schleier mittig dichter: dort steht die Schrift. Nach aussen offener, damit
   der Tempel am Rechner sichtbar bleibt — dort ist mehr Bild zu sehen. */
.schleier{position:absolute;inset:0;background:
  radial-gradient(72% 120% at 50% 50%, rgba(9,30,24,.80) 0%, rgba(9,30,24,.66) 55%, rgba(9,30,24,.34) 100%)}

/* Die Gruppe steht mittig und bleibt innerhalb der ${SICHER}px des Handy-Ausschnitts. */
.lockup{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;
  display:flex;align-items:center;gap:64px;width:${SICHER}px;justify-content:center}

.tiles{position:relative;width:352px;height:330px;flex:0 0 auto}
.tile{position:absolute;width:150px;height:202px;border-radius:18px;background-image:url(${MARBLE});
  background-size:cover;background-position:center;
  box-shadow:0 22px 42px rgba(0,0,0,.45),inset 0 0 0 3px rgba(201,162,39,.85);
  display:flex;align-items:center;justify-content:center}
.tile img{width:60%;height:60%;object-fit:contain}
.t-l{left:0;top:74px;transform:rotate(-9deg)}
.t-r{right:0;top:74px;transform:rotate(9deg)}
.t-c{left:98px;top:38px;z-index:2;width:158px;height:214px}
.t-c img{width:52%;height:52%}

.text{flex:0 0 auto}
h1{font-size:82px;font-weight:800;line-height:.96;letter-spacing:-1.8px;color:#f4f1e8;
  text-shadow:0 4px 24px rgba(4,18,14,.8)}
h1 .gold{background:linear-gradient(180deg,#f0d68a,#c9a227);-webkit-background-clip:text;
  -webkit-text-fill-color:transparent}
.rule{width:104px;height:5px;border-radius:3px;margin:24px 0 16px;
  background:linear-gradient(90deg,#e8cf86,#b8941f)}
.sub{font-size:26px;font-weight:700;color:#e8cf86;letter-spacing:.2px;white-space:nowrap;
  text-shadow:0 2px 12px rgba(4,18,14,.85)}
</style><div class=wrap>
<div class=foto></div><div class=schleier></div>
<div class=lockup>
  <div class=tiles>
    <div class="tile t-l"><img src="${DRACHE}"></div>
    <div class="tile t-r"><img src="${MUENZE}"></div>
    <div class="tile t-c"><img src="${ZHONG}"></div>
  </div>
  <div class=text>
    <h1>Mahjong<br><span class=gold>Royale</span></h1>
    <div class=rule></div>
    <div class=sub>Solitaire · Riichi · Connect · 4 Players</div>
  </div>
</div></div>`;

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? browserPfad(),
  headless: 'new',
  args: [...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
});
const page = await browser.newPage();
await page.setViewport({ width: B, height: H, deviceScaleFactor: 1 });
// ⚠ NICHT networkidle0 — alle Bilder sind data:-URIs, es gibt nie Netzverkehr.
await page.setContent(html, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => document.fonts.ready);

// Gegenprobe statt Vertrauen: Der SICHTBARE Inhalt muss in den Handy-Ausschnitt
// passen — und mit Luft, nicht auf Kante.
//
// ⚠ Hier NICHT `.lockup` messen: Der Kasten ist absichtlich so breit wie die
// Zone selbst und liegt damit per Definition genau auf der Kante. Gemessen
// gehoeren die tatsaechlich gemalten Kinder (Steine und Textblock); dazwischen
// steht nur Abstand.
const LUFT = 24;
const pruef = await page.evaluate((sicher) => {
  const teile = [...document.querySelectorAll('.tiles, .text')].map((e) => e.getBoundingClientRect());
  const rand = (window.innerWidth - sicher) / 2;
  return {
    links: Math.round(Math.min(...teile.map((r) => r.left))),
    rechts: Math.round(Math.max(...teile.map((r) => r.right))),
    zoneVon: Math.round(rand),
    zoneBis: Math.round(window.innerWidth - rand),
  };
}, SICHER);
if (pruef.links < pruef.zoneVon + LUFT || pruef.rechts > pruef.zoneBis - LUFT) {
  console.error(`  Inhalt ${pruef.links}–${pruef.rechts} braucht ${LUFT}px Luft in der Handy-Zone `
    + `${pruef.zoneVon}–${pruef.zoneBis} — Gruppe schmaler machen`);
  process.exitCode = 1;
}

const ziel = join(OUT, 'facebook-cover.png');
await page.screenshot({ path: ziel, clip: { x: 0, y: 0, width: B, height: H } });
await browser.close();
console.log(`  ${B}×${H}  Inhalt ${pruef.links}–${pruef.rechts}, Handy-Zone ${pruef.zoneVon}–${pruef.zoneBis}  →  ${ziel}`);

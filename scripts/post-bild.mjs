#!/usr/bin/env node
// Bildposts fuer Mahjong Royale — 1080×1350 (Feed) aus echtem Spielbrett.
//
//   npx vite preview --port 5199 --host 127.0.0.1 &
//   CHROMIUM_PFAD=/opt/pw-browsers/chromium node scripts/post-bild.mjs \
//       --format paar-standbild --level 34
//   … --format figur-galerie --level 40,88,150,260
//
// Kostet nichts. Das Brett wird NICHT nachgebaut, sondern aus der laufenden
// App abfotografiert — ein nachgezeichnetes Brett waere sofort ein anderes
// Spiel, und die Steine tragen ihre Verlaeufe ueber SVG-Referenzen.
//
// ⚠ Die Freistellung uebernimmt die Regeln aus record-solitaire.mjs, und die
// sind teuer erkauft:
//   · Der Aufnahme-Browser ist bewusst KEIN Touch-Geraet. Mit hasTouch
//     greift @media (hover:hover) nicht mehr und die Kacheln verlieren ihren
//     Ausblendeffekt — genau den, der das Material sehenswert macht.
//   · Freigestellt wird ueber `.hud` und `.controls`, NIE ueber den
//     Element-Selektor `header`: auf gleicher Ebene haengen die SVG-Defs aus
//     main.tsx, auf die jeder Stein per url(#gold) verweist.
//   · `.app` NICHT zur Flexbox machen — dabei kollabiert die Breite und das
//     Brett schrumpft auf einen Streifen.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserPfad } from './reel/browser.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..');
const ASSETS = join(HIER, 'reel', 'assets');

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const FORMAT = arg('format', 'paar-standbild');
const LEVEL = arg('level', '34');
const NAME = arg('name', null);
const SEED = Number(arg('seed', 1));
const OUT = join(WURZEL, arg('out', 'out/posts'));
const SERVER = process.env.REEL_SERVER ?? 'http://127.0.0.1:5199';

const B = 1080, H = 1350;

// --- Texte ------------------------------------------------------------------
// Englisch wie im Reel-Generator: ein Kanal, groesster Markt.
//
// ⚠ Der Abspann sagt „free on iOS & Android". Das stimmt fuer Mahjong Royale
// (beide Stores seit 29.7.2026) und NICHT fuer die anderen Apps im Portfolio.
const FORMATE = {
  'paar-standbild': {
    haken: 'Spot the pair',
    unter: 'Answer in the comments 👇',
    hashtags: ['mahjong', 'mahjongsolitaire', 'puzzlegame', 'brainteaser', 'spotthedifference'],
    caption: (o) => `Two of these tiles are a pair. Can you find them? 👀\n\n`
      + `Careful — any flower matches any other flower, and any season any other `
      + `season. They do not have to look identical.\n\n`
      + `Level ${o.level}\n\n`
      + `Mahjong Royale — free on iOS & Android.`,
  },
  'figur-galerie': {
    haken: 'Every level is a shape',
    unter: '370 of them. None a reskin.',
    hashtags: ['mahjong', 'mahjongsolitaire', 'leveldesign', 'puzzlegame', 'gamedesign'],
    caption: (o) => `Dragon, turtle, butterfly, lantern, crown, bridge — every one of `
      + `the 370 levels is an actual built figure, not a variation of the same board. 🀄\n\n`
      + `Shown: levels ${o.level}\n\n`
      + `Mahjong Royale — free on iOS & Android.`,
  },
};

if (!FORMATE[FORMAT]) {
  console.error(`✗ unbekanntes Format: ${FORMAT}\n  Bekannt: ${Object.keys(FORMATE).join(', ')}`);
  process.exit(1);
}

// --- Brett abfotografieren --------------------------------------------------
async function brettBild(browser, level) {
  // Kein hasTouch — siehe Kopfkommentar. Grosszuegiges Fenster, damit das
  // Brett nicht am Rand abgeschnitten wird.
  const ctx = await browser.newContext({
    viewport: { width: 900, height: 1400 },
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();

  // Die FIGUR ist pro Level deterministisch (so steht es im Kopf von
  // figures.ts), die STEINVERTEILUNG nicht: engine.ts mischt mit Math.random.
  // Ohne Seed zeigt derselbe Level bei jedem Lauf andere Steine — und dann
  // laesst sich ein Post aus seiner Ledger-Zeile nicht mehr nachbauen.
  // engine.ts nimmt zwar einen Rng entgegen, die App ruft es aber mit dem
  // Vorgabewert. Deshalb wird Math.random vor dem Laden der App ersetzt.
  await page.addInitScript(([lvl, seed]) => {
    let s = seed >>> 0;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    localStorage.setItem('CapacitorStorage.mahjong.progress.v1', JSON.stringify({
      level: lvl, coins: 500, lang: 'en', showFacts: false, sound: false,
    }));
  }, [Number(level), SEED]);

  await page.goto(SERVER, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.click('.play-btn').catch(() => {});
  await page.waitForSelector('.board .tile', { timeout: 15000 });

  await page.addStyleTag({
    // Die Tempelfotos liegen auf html/body/.app, nicht auf der Seite selbst —
    // omitBackground allein entfernt sie deshalb NICHT. Ohne dieses Abraeumen
    // sitzt im fertigen Post ein hartkantiges Rechteck Tempelfoto auf dem
    // Kartenverlauf. Die Steine sollen frei stehen.
    content: `.hud, .controls, .ach-toast { display: none !important; }
              .app { padding-top: 0 !important; padding-bottom: 0 !important; }
              html, body, .app, .board-wrap, .board, .board-scale {
                background: none !important; background-image: none !important;
                background-color: transparent !important; }
              body { overflow: hidden !important; }`,
  });
  await page.waitForTimeout(500);

  const el = await page.$('.board-scale');
  // omitBackground laesst den Tempelhintergrund weg — die Karte bringt ihren
  // eigenen mit, sonst saehe man zwei Hintergruende uebereinander.
  const bild = await el.screenshot({ omitBackground: true });
  const steine = await page.$$eval('.board .tile', (n) => n.length);
  await ctx.close();
  return { bild: `data:image/png;base64,${bild.toString('base64')}`, steine };
}

// --- Karte ------------------------------------------------------------------
function baueHtml({ bilder, haken, unter }) {
  const font = readFileSync(join(ASSETS, 'outfit.woff2')).toString('base64');
  const logo = readFileSync(join(ASSETS, 'logo.png')).toString('base64');
  const galerie = bilder.length > 1;

  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Outfit';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;overflow:hidden}
body{font-family:'Outfit',system-ui,sans-serif;color:#f4ecd8;
  /* Verlauf 1:1 aus dem Reel-Abspann (make-reel.mjs) — eine Bildsprache */
  background:linear-gradient(160deg,#123f2e,#0b2a1e 60%,#06201a);
  display:flex;flex-direction:column;padding:56px;position:relative}
.kopf{display:flex;align-items:center;gap:16px;position:relative;z-index:3}
.kopf img{width:52px;height:52px;border-radius:12px}
.kopf span{font-weight:700;letter-spacing:.28em;font-size:24px;color:#e6b74a}
.haken{position:relative;margin-top:26px;font-size:64px;font-weight:800;line-height:1.06;letter-spacing:-.02em;z-index:2}
.unter{position:relative;margin-top:12px;font-size:32px;font-weight:600;color:#ffd76a;z-index:2}
/* overflow:hidden ist Pflicht, nicht Kosmetik: Das Brett kommt als sehr hohes
   Element-Foto und deckte ohne die Begrenzung die Ueberschrift zu.
   min-height:0 allein reicht bei verschachtelten Flexboxen nicht. */
.buehne{flex:1 1 0;min-height:0;overflow:hidden;position:relative;z-index:1;
  display:${galerie ? 'grid' : 'flex'};
  ${galerie ? 'grid-template-columns:1fr 1fr;gap:18px;' : 'align-items:center;justify-content:center;'}
  margin:24px 0 8px}
.buehne .feld{display:flex;align-items:center;justify-content:center;
  min-height:0;min-width:0;height:100%;width:100%;overflow:hidden;
  ${galerie ? 'background:rgba(244,236,216,.05);border:1px solid rgba(244,236,216,.1);border-radius:18px;padding:14px' : ''}}
.buehne img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;
  filter:drop-shadow(0 18px 40px rgba(0,0,0,.45))}
.fuss{display:flex;justify-content:space-between;align-items:center;font-size:24px;
  color:rgba(244,236,216,.62);z-index:2}
.fuss .cta{color:#06201a;font-weight:700;border-radius:999px;padding:12px 26px;
  background:linear-gradient(100deg,#ffe07a,#f5b301)}
</style>
<div class="kopf"><img src="data:image/png;base64,${logo}"><span>MAHJONG ROYALE</span></div>
<div class="haken">${haken}</div>
<div class="unter">${unter}</div>
<div class="buehne">${bilder.map((b) => `<div class="feld"><img src="${b}"></div>`).join('')}</div>
<div class="fuss"><span>Solitaire · Connect · Riichi</span>
  <span class="cta">Free on iOS &amp; Android</span></div>`;
}

// --- Lauf -------------------------------------------------------------------
const level = LEVEL.split(',').map((s) => s.trim());
const browser = await chromium.launch({ executablePath: browserPfad() });

const aufnahmen = [];
for (const l of level) {
  process.stdout.write(`  Brett Level ${l} …\n`);
  aufnahmen.push(await brettBild(browser, l));
}

const f = FORMATE[FORMAT];
const seite = await browser.newPage({ viewport: { width: B, height: H }, deviceScaleFactor: 1 });
await seite.setContent(baueHtml({ bilder: aufnahmen.map((a) => a.bild), haken: f.haken, unter: f.unter }),
  { waitUntil: 'load' });
await seite.evaluate(() => document.fonts.ready);

mkdirSync(OUT, { recursive: true });
const basis = NAME ?? `mahjong-${FORMAT}-lvl${level.join('_')}-s${SEED}`;
const ziel = join(OUT, `${basis}.jpg`);
await seite.screenshot({ path: ziel, type: 'jpeg', quality: 92 });
await browser.close();

const o = { level: level.join(', '), steine: aufnahmen.map((a) => a.steine).join(', ') };
writeFileSync(join(OUT, `${basis}.txt`),
`# ${basis}.jpg

## Caption (kopieren)

${f.caption(o)}

## Hashtags

${f.hashtags.map((h) => `#${h}`).join(' ')}

## Beim Hochladen

- Keinen Store-Link in die Caption (drueckt die Auslieferung), nur "link in bio".
- TikTok als BUSINESS-Konto, Instagram als Creator-Konto.
- Auf Instagram den Haken fuer Facebook mitnehmen — die Mahjong-Zielgruppe ist
  dort aelter und der Wettbewerb geringer.

## Inhalt

- Format: ${FORMAT}
- Level ${o.level} · ${o.steine} Steine im Bild
`);

console.log(`✓ ${ziel}`);
console.log(`  ${B}×${H} · Level ${o.level} · ${o.steine} Steine`);

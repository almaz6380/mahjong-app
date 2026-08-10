#!/usr/bin/env node
// Nimmt echtes Solitaire-Gameplay als Hochkantvideo auf (1080×1920, 30 fps).
//
//   node scripts/reel/record-solitaire.mjs [--level 12] [--lang en] [--paare 14]
//                                          [--out out/reels] [--server http://localhost:5199]
//
// Voraussetzung: `npm run build && npx vite preview --port 5199` laeuft,
// dazu einmalig `npm i --no-save playwright ffmpeg-static`.
//
// ⚠ Aufgenommen wird ueber CDP-Screencast, NICHT ueber Playwrights
// recordVideo: Letzteres nimmt in Viewport-Groesse auf (360×640) und
// skaliert hoch — das Ergebnis ist matschig. Der Screencast liefert die
// Bilder in Geraeteaufloesung, also echte 1080×1920.
//
// ⚠ Der Browser laeuft BEWUSST nicht als Touch-Geraet. Auf Touch schaltet
// styles.css saemtliche Stein-Animationen ab (siehe CLAUDE.md, iOS-Ruckeln) —
// die Steine wuerden schlagartig verschwinden statt auszublenden, und genau
// dieses Ausblenden ist der Reiz des Formats.

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const FFMPEG = require('ffmpeg-static');

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');

const arg = (n, s) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? s : process.argv[i + 1];
};
const LEVEL = Number(arg('level', 12));
const LANG = arg('lang', 'en');
const PAARE = Number(arg('paare', 14));
const SERVER = arg('server', 'http://localhost:5199');
const OUT = join(WURZEL, arg('out', 'out/reels'));
const FPS = 30;

const BREITE = 360, HOEHE = 640, DSF = 3;

mkdirSync(OUT, { recursive: true });
const TMP = join(OUT, '.frames');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// Gleiche Regel wie src/game/tiles.ts: alle Blumen passen zueinander,
// alle Jahreszeiten ebenso, sonst zaehlt die Steinsorte.
const MATCH_KEY = `(id) => id.startsWith('flower') ? 'flower'
                        : id.startsWith('season') ? 'season' : id`;

const browser = await chromium.launch(
  process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
);
// isMobile/hasTouch absichtlich NICHT gesetzt — sonst greift @media (hover:hover)
// nicht und die Steine verschwinden ohne Ausblende.
const ctx = await browser.newContext({
  viewport: { width: BREITE, height: HOEHE },
  deviceScaleFactor: DSF,
  reducedMotion: 'no-preference',
});
const page = await ctx.newPage();

await page.addInitScript(([lvl, lang]) => {
  localStorage.setItem('CapacitorStorage.mahjong.progress.v1', JSON.stringify({
    level: lvl, coins: 500, lang, showFacts: false, sound: false,
  }));
}, [LEVEL, LANG]);

await page.goto(SERVER, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.click('.play-btn').catch(() => {});
await page.waitForSelector('.board .tile', { timeout: 15000 });

// Spiel-Chrome ausblenden: Kopfzeile (`header.hud`) und Bedienleiste
// (`nav.controls`) lenken vom Brett ab, und "Undo/Hint/Shuffle" haben in einer
// Werbung nichts verloren. Die Klassennamen stammen aus src/ui/GameScreen.tsx —
// geraten hatte ich vorher `.bottom-bar`, und die Leiste blieb stehen.
//
// ⚠ Nicht per Element-Selektor `header` ausblenden: Auf gleicher Ebene haengen
// die SVG-Definitionen aus main.tsx (`TileDefs`), auf die jeder Stein per
// url(#gold) verweist.
await page.addStyleTag({
  content: `
    .hud, .controls { display: none !important; }
    .app { padding-top: 0 !important; padding-bottom: 0 !important; }
    body { overflow: hidden !important; }
  `,
});

// ⚠ `.app` NICHT zu einer Flexbox machen, um das Brett zu zentrieren — dabei
// kollabiert die Breite, das Brett schrumpft auf einen schmalen Streifen.
// Stattdessen nur den Wrapper mittig setzen und das Brett um sich selbst
// vergroessern: Board.tsx deckelt seine Skalierung bei 1.85, weil in der App
// Kopf und Leiste Platz brauchen — die sind hier weg, also ist Luft.
await page.waitForTimeout(400);
await page.evaluate(() => {
  const wrap = document.querySelector('.board-wrap');
  const el = document.querySelector('.board-scale');
  if (!wrap || !el) return;
  const r = el.getBoundingClientRect();
  const f = Math.min(window.innerWidth * 0.94 / r.width, window.innerHeight * 0.80 / r.height);
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  wrap.style.height = '100dvh';
  if (f > 1.02) {
    el.style.transformOrigin = 'center center';
    el.style.zoom = f.toFixed(3);   // zoom statt transform: rechnet das Layout mit
  }
});
await page.waitForTimeout(900);

// ---------------------------------------------------------------------------
// Aufnahme ueber CDP
// ---------------------------------------------------------------------------
const cdp = await ctx.newCDPSession(page);
const bilder = [];
let n = 0;

cdp.on('Page.screencastFrame', async (f) => {
  const datei = join(TMP, `${String(n++).padStart(5, '0')}.jpg`);
  writeFileSync(datei, Buffer.from(f.data, 'base64'));
  bilder.push({ datei, t: f.metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});

await cdp.send('Page.startScreencast', {
  format: 'jpeg', quality: 92, maxWidth: BREITE * DSF, maxHeight: HOEHE * DSF, everyNthFrame: 1,
});

// ---------------------------------------------------------------------------
// Spielen: freies Paar suchen, beide Steine antippen, kurz warten.
// ---------------------------------------------------------------------------
async function freiesPaar() {
  return page.evaluate(`(() => {
    const mk = ${MATCH_KEY};
    const frei = [...document.querySelectorAll('.board .tile.free')];
    const nach = new Map();
    for (const el of frei) {
      const k = mk(el.getAttribute('aria-label'));
      const l = nach.get(k) ?? [];
      l.push(el);
      nach.set(k, l);
    }
    for (const [, l] of nach) {
      if (l.length >= 2) {
        // Zwei Steine, die weit auseinander liegen, sind im Video besser zu
        // verfolgen als zwei benachbarte.
        l.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        const r1 = l[0].getBoundingClientRect(), r2 = l[l.length - 1].getBoundingClientRect();
        return [
          { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2 },
          { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 },
        ];
      }
    }
    return null;
  })()`);
}

let gespielt = 0;
await page.waitForTimeout(600);   // Ruhe vor dem ersten Zug

for (let i = 0; i < PAARE; i++) {
  const paar = await freiesPaar();
  if (!paar) { console.log(`  kein Paar mehr frei nach ${gespielt} Zuegen`); break; }
  await page.mouse.click(paar[0].x, paar[0].y);
  await page.waitForTimeout(260);        // kurze Pause: der erste Stein leuchtet auf
  await page.mouse.click(paar[1].x, paar[1].y);
  await page.waitForTimeout(430);        // Ausblende + Atempause
  gespielt++;
}
await page.waitForTimeout(900);          // Nachklang am Ende

await cdp.send('Page.stopScreencast').catch(() => {});
await page.waitForTimeout(400);
await browser.close();

if (!bilder.length) { console.error('✗ keine Bilder aufgenommen'); process.exit(1); }

// ---------------------------------------------------------------------------
// Frames mit ihren echten Zeitstempeln zu konstanten 30 fps machen
// ---------------------------------------------------------------------------
const t0 = bilder[0].t;
const zeilen = [];
for (let i = 0; i < bilder.length; i++) {
  const dauer = (i + 1 < bilder.length ? bilder[i + 1].t - bilder[i].t : 1 / FPS);
  zeilen.push(`file '${bilder[i].datei}'`, `duration ${Math.max(1 / 120, dauer).toFixed(4)}`);
}
zeilen.push(`file '${bilder[bilder.length - 1].datei}'`);   // concat-Demuxer braucht das letzte Bild doppelt
const liste = join(TMP, 'liste.txt');
writeFileSync(liste, zeilen.join('\n'));

const ziel = join(OUT, `mahjong-solitaire-lvl${LEVEL}-${LANG}.mp4`);
await new Promise((res, rej) => {
  const p = spawn(FFMPEG, [
    '-y', '-f', 'concat', '-safe', '0', '-i', liste,
    '-vf', `fps=${FPS},scale=${BREITE * DSF}:${HOEHE * DSF}:flags=lanczos`,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', ziel,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (c) => (c === 0 ? res() : rej(new Error(err.slice(-1200)))));
});

rmSync(TMP, { recursive: true, force: true });
const dauer = (bilder[bilder.length - 1].t - t0).toFixed(1);
console.log(`✓ ${ziel}`);
console.log(`  ${gespielt} Paare · ${bilder.length} Bilder · ${dauer} s Rohmaterial`);

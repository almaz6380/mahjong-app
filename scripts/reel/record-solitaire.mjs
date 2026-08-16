#!/usr/bin/env node
// Nimmt echtes Solitaire-Gameplay als Hochkantvideo auf (1080×1920, 30 fps).
//
//   node scripts/reel/record-solitaire.mjs [--level 12] [--lang en] [--paare 14]
//                                          [--out out/reels] [--server http://localhost:5199]
//                                          [--nur-brett]
//
// Voreinstellung ist die Aufnahme des GANZEN Bildschirms — mit Kopfzeile
// (Level, Muenzen) und Bedienleiste. Das sieht aus wie eine echte
// Bildschirmaufnahme vom Handy und wirkt dadurch glaubwuerdiger als ein
// freigestelltes Brett. `--nur-brett` blendet beides aus.
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
import { browserPfad } from './browser.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FFMPEG = require('ffmpeg-static');

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');

const arg = (n, s) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? s : process.argv[i + 1];
};
const LEVEL = Number(arg('level', 12));
const LANG = arg('lang', 'en');
// Voreinstellung hoch genug, um das Brett WIRKLICH leer zu spielen. Die
// Schleife bricht von selbst ab, sobald kein Paar mehr frei liegt — der Wert
// ist also eine Obergrenze, keine Vorgabe. Ein Reel, das mitten im halb
// geraeumten Brett aufhoert, laesst den Zuschauer ohne Aufloesung zurueck;
// der Sieg-Bildschirm (Ensō, Sterne, Muenzen) ist der eigentliche Schluss.
const PAARE = Number(arg('paare', 40));
const SERVER = arg('server', 'http://localhost:5199');
const NUR_BRETT = process.argv.includes('--nur-brett');
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

const browser = await chromium.launch({ executablePath: browserPfad() });
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

// Platz fuer die Statusleiste des Handys reservieren. Ohne das saesse die
// spaeter eingeblendete Uhrzeit auf der Kopfzeile der App — auf einem echten
// Geraet haelt die App diesen Bereich ueber die Safe Area frei, im Browser
// gibt es die nicht.
// Der Erfolgs-Hinweis („Award unlocked") haengt an
// `env(safe-area-inset-top)` — im Browser ist das 0, also klebt er oben und
// ueberlappt die spaeter eingeblendete Statusleiste. Auf einem echten iPhone
// sitzt er darunter; hier wird derselbe Abstand von Hand gesetzt.
await page.addStyleTag({
  content: `.app { padding-top: 52px !important; padding-bottom: 26px !important; }
            .ach-toast { top: 64px !important; }`,
});
await page.waitForTimeout(300);

// Nur auf Wunsch freistellen. Standard ist der ganze Bildschirm: Kopfzeile
// und Bedienleiste gehoeren zu einer echten Bildschirmaufnahme dazu.
//
// ⚠ Falls doch freigestellt wird: die echten Klassen sind `.hud` und
// `.controls`. NICHT per Element-Selektor `header` — auf gleicher Ebene
// haengen die SVG-Definitionen aus main.tsx (`TileDefs`), auf die jeder Stein
// per url(#gold) verweist. Und `.app` NICHT zu einer Flexbox machen, um das
// Brett zu zentrieren: dabei kollabiert die Breite und das Brett schrumpft
// auf einen schmalen Streifen.
if (NUR_BRETT) {
  await page.addStyleTag({
    content: `
      .hud, .controls { display: none !important; }
      .app { padding-top: 0 !important; padding-bottom: 0 !important; }
      body { overflow: hidden !important; }
    `,
  });
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
    if (f > 1.02) { el.style.transformOrigin = 'center center'; el.style.zoom = f.toFixed(3); }
  });
}
await page.waitForTimeout(900);

// ---------------------------------------------------------------------------
// Aufnahme ueber CDP
// ---------------------------------------------------------------------------
const cdp = await ctx.newCDPSession(page);
const bilder = [];
let n = 0;
// Nullpunkt fuer alle Ereigniszeiten: der Moment, in dem das ERSTE Bild
// eintrifft. Der Zeitstempel des jeweils letzten Bildes taugt dafuer nicht —
// der Screencast liefert nur bei Bildaenderung, in einer Wartepause bleibt er
// stehen und ein Klick bekaeme die Zeit des letzten Bildwechsels.
let wand0 = null;

cdp.on('Page.screencastFrame', async (f) => {
  if (wand0 === null) wand0 = Date.now() / 1000;
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

// Jeder Klick wird mit seinem Zeitstempel mitgeschrieben, damit make-reel.mjs
// die Klaenge des Spiels exakt daraufsetzen kann. Der Screencast liefert nur
// Bild — der Ton entsteht spaeter neu, und ohne diese Liste muesste er raten.
const klicks = [];      // { t, art: 'tap' | 'match' }
const jetzt = () => (wand0 === null ? null : Date.now() / 1000 - wand0);

// Die Rampe muss sich an der ECHTEN Paarzahl des Bretts ausrichten, nicht an
// der Obergrenze `--paare`: Sonst laeuft sie bei einem Deckel von 40 nur bis
// zur Haelfte durch und das Video bleibt gleichfoermig langsam.
const zuege = Math.min(PAARE, await page.evaluate(
  () => document.querySelectorAll('.board .tile').length / 2) || PAARE);

// Das Tempo zieht an: erst ruhig, dann immer schneller. Ein gleichmaessiger
// Rhythmus wirkt im Feed wie ein Bildschirmschoner — die Beschleunigung ist
// das, was jemanden bis zum Ende schauen laesst.
for (let i = 0; i < PAARE; i++) {
  const paar = await freiesPaar();
  if (!paar) { console.log(`  kein Paar mehr frei nach ${gespielt} Zuegen`); break; }
  const t = zuege > 1 ? Math.min(1, i / (zuege - 1)) : 1;   // 0 am Anfang, 1 am Ende
  // Letztes Paar: bewusst ein Atemzug statt des schnellsten Zugs. Alles zieht
  // an, dann haelt es kurz, dann loest es sich — der Halt ist das, was die
  // Aufloesung ueberhaupt als Aufloesung lesbar macht. Ohne ihn endet das
  // Video einfach, statt anzukommen.
  const letzter = zuege > 1 && i === zuege - 1;
  const vor = letzter ? 620 : Math.round(300 - 190 * t);   // 300 ms → 110 ms
  const nach = Math.round(520 - 350 * t);             // 520 ms → 170 ms
  await page.mouse.click(paar[0].x, paar[0].y);
  klicks.push({ t: jetzt(), art: 'tap' });            // erster Stein: nur Tick
  await page.waitForTimeout(vor);                     // erster Stein leuchtet auf
  await page.mouse.click(paar[1].x, paar[1].y);
  klicks.push({ t: jetzt(), art: 'match' });          // zweiter Stein: Paar loest sich
  await page.waitForTimeout(nach);                    // Ausblende + Atempause
  gespielt++;
}

// Ist das Brett leer, blendet GameScreen die Sieg-Zeremonie ein (`.overlay`
// mit `.card`): Ensō zeichnet sich, Sterne kommen, die Muenzen zaehlen hoch.
// Das dauert rund drei Sekunden und ist der Schluss des Reels — also warten,
// statt sofort abzuschneiden. Bleibt das Brett stehen (Sackgasse), reicht ein
// kurzer Nachklang.
const gewonnen = await page.waitForSelector('.overlay .card', { timeout: 2500 })
  .then(() => true).catch(() => false);
// Zeitpunkt des Siegs festhalten, damit make-reel.mjs den Klang GENAU dorthin
// legen kann. Geschaetzt („etwa vier Sekunden vor Schluss") sitzt er daneben,
// und ein Klang neben dem Bild ist schlimmer als gar keiner.
const siegBei = gewonnen ? jetzt() : null;
await page.waitForTimeout(gewonnen ? 3800 : 900);
if (gewonnen) console.log('  Brett leer — Sieg-Zeremonie mit aufgenommen');
else console.log('  ⚠ kein Sieg — das Reel endet ohne Aufloesung');

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

// Beipackzettel fuer make-reel.mjs. Liegt neben der mp4, gleicher Name.
writeFileSync(ziel.replace(/\.mp4$/, '.json'), JSON.stringify({
  level: LEVEL, lang: LANG, paare: gespielt,
  dauer: Number(dauer),
  siegBei: siegBei == null ? null : Number(siegBei.toFixed(2)),
  klicks: klicks.filter((k) => k.t != null)
    .map((k) => ({ t: Number(k.t.toFixed(3)), art: k.art })),
}, null, 2));

console.log(`✓ ${ziel}`);
console.log(`  ${gespielt} Paare · ${bilder.length} Bilder · ${dauer} s Rohmaterial`);
if (siegBei != null) console.log(`  Sieg bei ${siegBei.toFixed(2)} s`);

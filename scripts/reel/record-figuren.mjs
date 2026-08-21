#!/usr/bin/env node
// Greift je Level EIN sauberes Bild des frischen Bretts ab — Rohmaterial fuer
// das Figuren-Reel („370 levels, no two boards alike").
//
//   npx vite preview --port 5199 --host 127.0.0.1     # muss laufen
//   node scripts/reel/record-figuren.mjs
//
// ⚠ Kein Screencast und kein Spielen. Hier wird nichts BEWEGT gezeigt, sondern
// verglichen: Der Reiz des Reels ist die wechselnde Silhouette, und dafuer
// braucht es ruhige Standbilder. Das ist ausdruecklich etwas anderes als die
// Diashow, an der Match-3 im Modi-Reel gescheitert ist — dort war die
// Standbildfolge ein Fehler (der Modus animiert nicht), hier ist der Takt die
// Form.

import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserPfad } from './browser.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const SERVER = arg('server', 'http://127.0.0.1:5199');
const OUT = join(WURZEL, arg('out', 'out/reels/figuren'));
// ⚠ Die Sprache der Oberflaeche gehoert zum Material, nicht zum Zufall: Fuer
// eine Kampagne in DE/AT ist eine englische Bedienleiste im Bild ein Bruch.
const LANG = arg('lang', 'en');
const BREITE = 360, HOEHE = 640, DSF = 3;

// Die Levelauswahl. ⚠ Dichter am Anfang als am Ende: Zwischen Level 1 und 50
// aendert sich die Form in jedem Schritt sichtbar, zwischen 300 und 370 kaum
// noch. Linear verteilt waere die zweite Haelfte des Reels eine Wiederholung.
//
// ⚠ Die Liste ist nur ein VORSCHLAG — welche Level tatsaechlich aufgenommen
// werden, entscheidet die Figurenpruefung unten: `figureForLevel()` ist
// deterministisch, und zwei Level koennen dieselbe Figur tragen. Ein Reel, das
// zweimal dasselbe Brett zeigt, widerlegt genau die Behauptung, die es
// aufstellt.
export const LEVEL = [
  1, 3, 5, 8, 12, 16, 21, 27, 34, 42, 51, 61, 72, 84, 97,
  111, 126, 142, 159, 177, 196, 216, 237, 259, 282, 306, 331, 357, 370,
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: browserPfad() });
const daten = [];
try {
  const ctx = await browser.newContext({
    viewport: { width: BREITE, height: HOEHE },
    deviceScaleFactor: DSF,
    reducedMotion: 'reduce',   // keine Einblende-Animation im Standbild
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);

  const gesehen = new Set();
  for (const level of LEVEL) {
    // ⚠ Der Stand muss VOR dem Laden gesetzt sein, und zwar bei jedem
    // Durchgang neu — `addInitScript` gilt pro Kontext, nicht pro Navigation,
    // deshalb wird der Wert hier direkt geschrieben und dann neu geladen.
    await page.goto(SERVER, { waitUntil: 'domcontentloaded' });
    await page.evaluate(([l, sp]) => {
      localStorage.setItem('CapacitorStorage.mahjong.progress.v1', JSON.stringify({
        level: l, coins: 500, lang: sp, showFacts: false, sound: false,
      }));
    }, [level, LANG]);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);

    await page.click('.play-btn');
    await page.waitForSelector('.board .tile', { timeout: 15000 });
    // Das Brett faehrt gestaffelt ein; erst danach steht die Silhouette.
    await page.waitForTimeout(1400);

    const info = await page.evaluate(() => ({
      steine: document.querySelectorAll('.board .tile').length,
      kopf: document.querySelector('.mode-head .level, .score')?.textContent ?? '',
    }));

    // Doppelte Figuren aussortieren — erkannt an der Steinzahl UND der
    // Belegung, nicht am Level: Zwei Level mit gleicher Steinzahl koennen
    // verschiedene Formen haben.
    const form = await page.evaluate(() => [...document.querySelectorAll('.board .tile')]
      .map((t) => t.getAttribute('style')?.match(/left:\s*([\d.]+)px;\s*top:\s*([\d.]+)px/)?.slice(1).join(','))
      .filter(Boolean).sort().join('|'));
    const schluessel = form || `n${info.steine}`;
    if (gesehen.has(schluessel)) {
      console.log(`  — Level ${level}: gleiche Figur wie zuvor, uebersprungen`);
      continue;
    }
    gesehen.add(schluessel);

    const datei = join(OUT, `lvl${String(level).padStart(3, '0')}.png`);
    writeFileSync(datei, await page.screenshot({ type: 'png' }));
    daten.push({ level, steine: info.steine, datei });
    console.log(`  ✓ Level ${level}: ${info.steine} Steine`);
  }
} finally {
  await browser.close().catch(() => {});
}

writeFileSync(join(OUT, 'figuren.json'), JSON.stringify(daten, null, 2));
console.log(`\n${daten.length} Bretter → ${OUT}`);
if (daten.length) {
  const s = daten.map((d) => d.steine);
  console.log(`Steine ${Math.min(...s)} … ${Math.max(...s)}`);
}
console.log('Naechster Schritt: Kontaktbogen ansehen — sind die Formen wirklich verschieden?');

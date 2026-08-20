#!/usr/bin/env node
// Nimmt die verschiedenen Spielmodi auf — je einen kurzen, BEWEGTEN Ausschnitt
// fuer das Modi-Reel.
//
//   npx vite preview --port 5199 --host 127.0.0.1     # muss laufen
//   node scripts/reel/record-modi.mjs                 # alle
//   node scripts/reel/record-modi.mjs --nur connect   # einen
//
// ⚠ EIN MODUS, DER SICH NICHT BEWEGT, IST WERTLOS. Der Reiz des Reels ist,
// dass sechs offensichtlich VERSCHIEDENE Spiele nacheinander laufen; ein
// Standbild dazwischen liest sich als Ladefehler. Jeder Antrieb unten ist an
// Einzelbildern geprueft — wer einen Modus dazunimmt, prueft ihn genauso.
//
// Technik wie record-solitaire.mjs: CDP-Screencast statt Playwrights
// recordVideo (das nimmt in Viewport-Groesse auf und skaliert hoch — matschig).

import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
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

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const SERVER = arg('server', 'http://127.0.0.1:5199');
const OUT = join(WURZEL, arg('out', 'out/reels/modi'));
const NUR = arg('nur', null);
const BREITE = 360, HOEHE = 640, DSF = 3, FPS = 30;

// --- Die Modi ---------------------------------------------------------------
// `hin(page)`  navigiert von der Startseite zum Modus und wartet, bis er steht.
// `spiel(page)` treibt ihn fuer die Aufnahmedauer an.
//
// Navigationswege (aus App.tsx): Die Startseite hat einen Play-Knopf fuers
// Solitaire und ein Blatt „Alle Spiele" (`.game-row`) fuer Connect, 4-Spieler
// und Riichi. Die sieben Bonus-Spiele haengen eine Ebene tiefer im
// Modi-Bildschirm (`.mode-card`).
const warte = (p, ms) => p.waitForTimeout(ms);

// Reihenfolge im Blatt (App.tsx, `gameItems`) — NICHT raten, sie ist die
// Klickreihenfolge und aendert sich, wenn dort ein Eintrag dazukommt.
const BLATT = { solitaire: 0, connect: 1, m4: 2, riichi: 3, zen: 4, pagoda: 5, album: 6, mehr: 7 };
// Reihenfolge im Modi-Bildschirm (ModesScreen.tsx, `CARDS`).
const KARTE = { tilematch: 0, blitz: 1, dimensions: 2, merge: 3, match3: 4, memory: 5, sudoku: 6 };

// ⚠ Menue-Knoepfe werden per JS geklickt, nicht mit der Maus. Das Blatt
// „Alle Spiele" hat acht Zeilen in einem 640-px-Fenster; die unteren liegen
// AUSSERHALB des sichtbaren Bereichs, und Playwright weigert sich dort zu
// klicken („element is outside of the viewport") — auch nach seinem eigenen
// Scroll-Versuch. Genau daran ist der erste Lauf haengengeblieben, und zwar
// nicht bei der Modus-Karte, sondern schon bei der Zeile „Mehr".
// `el.click()` loest den React-Handler direkt aus, ohne Geometriepruefung.
// Fuers SPIEL bleibt es bei echten Mausklicks — dort zaehlt die Position.
async function jsKlick(page, sel, nr) {
  const ok = await page.evaluate(([s, i]) => {
    const el = document.querySelectorAll(s)[i];
    if (!el) return false;
    el.click();
    return true;
  }, [sel, nr]);
  if (!ok) throw new Error(`${sel} Nr. ${nr} nicht gefunden`);
}

/** Blatt „Alle Spiele" oeffnen und einen Eintrag antippen. */
async function ausBlatt(page, schluessel) {
  await page.click('.allgames-btn');
  await page.waitForSelector('.game-row', { timeout: 8000 });
  // ⚠ Grosszuegig warten. Das Blatt faehrt animiert herein; ein Klick per JS
  // kommt zwar an, aber der Bildschirmwechsel dahinter braucht seine Zeit.
  // Mit 400 ms fiel Dimensions sporadisch durch („waitForSelector Timeout"),
  // obwohl derselbe Weg von Hand einwandfrei laeuft — ein reines Rennen.
  await warte(page, 700);
  await jsKlick(page, '.game-row', BLATT[schluessel]);
}

/** Ueber „Mehr" in den Modi-Bildschirm und dort eine Karte antippen. */
async function ausModi(page, schluessel) {
  await ausBlatt(page, 'mehr');
  await page.waitForSelector('.mode-card', { timeout: 10000 });
  await warte(page, 700);
  await jsKlick(page, '.mode-card', KARTE[schluessel]);
}

export const MODI = {
  solitaire: {
    titel: 'Solitaire',
    sek: 6,
    hin: async (page) => {
      await page.click('.play-btn');
      await page.waitForSelector('.board .tile', { timeout: 15000 });
    },
    spiel: (page) => brettSpielen(page, 9),
  },

  connect: {
    titel: 'Connect',
    sek: 6,
    hin: async (page) => {
      await ausBlatt(page, 'connect');
      await page.waitForSelector('.connect-tile', { timeout: 15000 });
    },
    // ⚠ Der Reiz von Connect ist die gezeichnete Verbindungslinie
    // (`.connect-path`, SVG-Polyline). Sie erscheint NUR bei einem gueltigen
    // Zug — zwei gleiche Steine mit einem Weg ueber hoechstens zwei Ecken.
    // Blind zu klicken ergibt fast nie etwas: Die erste Fassung probierte
    // gleiche Steine paarweise durch und brachte in 8,8 s Aufnahme ZWEI Zuege
    // zustande — gemessen Ø0,24 Bildaenderung, also praktisch ein Standbild.
    // Deshalb wird der Weg jetzt vorher im Browser gerechnet (dieselbe BFS wie
    // `canConnect`), und jeder Klick ist ein Treffer.
    spiel: (page) => connectSpielen(page, 12),
  },

  match3: {
    titel: 'Match 3',
    sek: 5,
    hin: async (page) => {
      await ausModi(page, 'match3');
      await page.waitForSelector('.m3-cell', { timeout: 10000 });
    },
    // ⚠ Match-3 ANIMIERT NICHT. `tap()` in Match3Screen.tsx setzt mit
    // `setGrid(res.grid)` das fertig aufgeloeste Brett in EINEM Schritt —
    // kein Platzen, kein Nachrutschen (die CSS-Regel `.m3-cell.clear` ist
    // verwaist, die Klasse wird nie gesetzt). Der Screencast liefert deshalb
    // rund ein Bild je Zug, genau wie bei 2048.
    // Das heisst: Der Modus traegt sich NUR ueber die Schlagzahl. Ein
    // ungueltiger Tausch federt bloss zurueck und kostet einen Zug ohne
    // Bildwechsel — blind zu tippen ergab Ø0,10, also nichts. Also wird der
    // Tausch vorher gerechnet (dieselbe Regel wie `findMatches`) und schnell
    // gesetzt: viele gueltige Zuege dicht hintereinander lesen sich als Takt.
    spiel: (page) => match3Spielen(page, 14),
  },

  dimensions: {
    titel: '3D Dimensions',
    sek: 5,
    hin: async (page) => {
      await ausModi(page, 'dimensions');
      // ⚠ NICHT auf `.dim-scene` warten. Die Szene ist da, hat aber KEINE
      // eigene Flaeche — ihre Steine sind absolut in einem 3D-Raum gesetzt,
      // also meldet Playwright sie als „hidden" und `waitForSelector` (das
      // von Haus aus auf SICHTBAR wartet) laeuft in den Zeitgeber. Ein
      // `count()` auf denselben Wahlausdruck liefert derweil 1, was die
      // Fehlersuche lange in die Irre gefuehrt hat. Ein Stein hat Flaeche.
      await page.waitForSelector('.dim-tile', { timeout: 10000 });
    },
    // ⚠ Hier stand zuerst 2048. Es reagiert zwar auf die Pfeiltasten (geprueft),
    // ANIMIERT ABER NICHT: Jeder Zug ist ein Sprung, der Screencast liefert
    // deshalb rund EIN Bild je Zug und das Ergebnis waere eine Diashow. Der
    // Screencast liefert nur bei Bildaenderung — ein Modus muss sich also
    // fliessend bewegen, nicht nur seinen Zustand wechseln.
    // Dimensions dreht seine Szene und ist damit das Gegenteil.
    spiel: (page) => dimDrehen(page),
  },

  memory: {
    titel: 'Memory',
    sek: 6,
    hin: async (page) => {
      await ausModi(page, 'memory');
      await page.waitForSelector('.mem-cell', { timeout: 10000 });
    },
    // Der beste Modus fuers Bild, und zwar aus einem technischen Grund: Die
    // Karte dreht sich wirklich (`.mem-inner`, rotateY mit Uebergang), der
    // Screencast bekommt also fortlaufend Bilder statt eines Sprungs. Auf
    // `.tile` waere dieselbe Drehung verboten (iOS-Ruckeln) — `.mem-cell` ist
    // kein `.tile`, deshalb darf sie hier stehen.
    spiel: (page) => memorySpielen(page, 7),
  },

  riichi: {
    titel: 'Riichi',
    sek: 5,
    hin: async (page) => {
      await ausBlatt(page, 'riichi');
      await page.waitForSelector('.m4 .mtile, .m4 .back', { timeout: 15000 });
    },
    // ⚠ Die KI faehrt NICHT von allein los. `useRiichi` plant `aiTurn` erst,
    // nachdem der Mensch abgeworfen hat — beim Aufschlagen des Tisches liegen
    // 14 antippbare Steine da und es passiert nichts (im ersten Lauf kam
    // genau EIN Bild heraus). Nach jedem Abwurf ziehen die drei KI-Spieler
    // sichtbar nach: Steine wandern in den Ablagestapel, die Hand wird neu
    // sortiert. Geprueft: 4 von 4 Abwuerfen aendern das Bild.
    spiel: async (page) => {
      for (let i = 0; i < 4; i++) {
        const n = await page.locator('.mtile.tap').count();
        if (n) await jsKlick(page, '.mtile.tap', Math.floor(n / 2)).catch(() => {});
        await warte(page, 1500);
      }
    },
  },

  blitz: {
    titel: 'Time Blitz',
    sek: 5,
    hin: async (page) => {
      await ausModi(page, 'blitz');
      await page.waitForSelector('.board .tile', { timeout: 10000 });
    },
    // Blitz nutzt dieselbe Brett-Oberflaeche wie das Solitaire, also greift
    // dieselbe Paarsuche. Sichtbarer Unterschied ist der Countdown-Balken
    // (`.blitz-bar`), der von allein leerlaeuft.
    spiel: (page) => brettSpielen(page, 8),
  },
};

// --- Antriebe ---------------------------------------------------------------
// Gleiche Regel wie src/game/tiles.ts: alle Blumen passen zueinander, alle
// Jahreszeiten ebenso, sonst zaehlt die Steinsorte.
const MATCH_KEY = `(id) => id.startsWith('flower') ? 'flower'
                        : id.startsWith('season') ? 'season' : id`;

/** Freie Paare auf einem Solitaire-artigen Brett antippen. */
async function brettSpielen(page, zuege) {
  for (let i = 0; i < zuege; i++) {
    const paar = await page.evaluate(`(() => {
      const mk = ${MATCH_KEY};
      const frei = [...document.querySelectorAll('.board .tile.free')];
      const nach = new Map();
      for (const el of frei) {
        const k = mk(el.getAttribute('aria-label'));
        (nach.get(k) ?? nach.set(k, []).get(k)).push(el);
      }
      for (const [, l] of nach) {
        if (l.length >= 2) {
          const r1 = l[0].getBoundingClientRect(), r2 = l[l.length - 1].getBoundingClientRect();
          return [{ x: r1.left + r1.width / 2, y: r1.top + r1.height / 2 },
                  { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 }];
        }
      }
      return null;
    })()`);
    if (!paar) return;
    await page.mouse.click(paar[0].x, paar[0].y);
    await warte(page, 230);
    await page.mouse.click(paar[1].x, paar[1].y);
    await warte(page, 330);
  }
}

/**
 * Connect: den gueltigen Zug VORHER rechnen, dann genau ihn klicken.
 *
 * Das Brett laesst sich vollstaendig aus dem DOM zurueckgewinnen —
 * ConnectScreen rendert JEDE Zelle als `.connect-cell` und legt nur bei
 * belegten Feldern einen `.connect-tile` hinein. Damit stehen Raster,
 * Belegung und (ueber das innere Markup) die Steinsorte fest, und die BFS
 * aus connect.ts laesst sich nachbauen: hoechstens zwei Kurven, Weg nur
 * ueber leere Felder, Ziel selbst passierbar.
 *
 * ⚠ Der Rand zaehlt mit. `canConnect` laeuft ueber ein Brett, das aussen
 * einen Ring leerer Felder hat (`inner()` in connect.ts) — ein Weg darf also
 * aussen herum. Der DOM zeigt genau dieses gepolsterte Raster, deshalb
 * stimmt der Nachbau, solange man W aus `gridTemplateColumns` nimmt und
 * nicht aus der Zahl der sichtbaren Steine.
 */
async function connectSpielen(page, zuege) {
  for (let z = 0; z < zuege; z++) {
    const paar = await page.evaluate(`(() => {
      const zellen = [...document.querySelectorAll('.connect-cell')];
      if (!zellen.length) return null;
      const grid = zellen[0].parentElement;
      const W = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const H = Math.ceil(zellen.length / W);
      // -1 = leer, sonst eine Zahl je Steinsorte (Markup als Schluessel)
      const sorten = new Map();
      const g = zellen.map((z) => {
        const t = z.querySelector('.connect-tile');
        if (!t) return -1;
        const k = t.innerHTML;
        if (!sorten.has(k)) sorten.set(k, sorten.size);
        return sorten.get(k);
      });
      const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
      const frei = (i, ziel) => i === ziel || g[i] === -1;
      const verbindbar = (a, b) => {
        if (a === b || g[a] === -1 || g[a] !== g[b]) return false;
        const gesehen = new Set(), q = [];
        const key = (c, d, t) => (c * 4 + d) * 3 + t;
        for (let d = 0; d < 4; d++) {
          const r = ((a / W) | 0) + DIRS[d][0], c = (a % W) + DIRS[d][1];
          if (r < 0 || c < 0 || r >= H || c >= W) continue;
          const n = r * W + c;
          if (!frei(n, b)) continue;
          gesehen.add(key(n, d, 0)); q.push([n, d, 0]);
        }
        for (let h = 0; h < q.length; h++) {
          const [cell, dir, kurven] = q[h];
          if (cell === b) return true;
          for (let d = 0; d < 4; d++) {
            const k2 = kurven + (d === dir ? 0 : 1);
            if (k2 > 2) continue;
            const r = ((cell / W) | 0) + DIRS[d][0], c = (cell % W) + DIRS[d][1];
            if (r < 0 || c < 0 || r >= H || c >= W) continue;
            const n = r * W + c;
            if (!frei(n, b)) continue;
            const kk = key(n, d, k2);
            if (gesehen.has(kk)) continue;
            gesehen.add(kk); q.push([n, d, k2]);
          }
        }
        return false;
      };
      // Nach Sorte gruppieren und das erste verbindbare Paar zurueckgeben —
      // als Position UNTER den sichtbaren Steinen, denn geklickt wird
      // '.connect-tile' und dessen Zaehlung ueberspringt leere Felder.
      const nach = new Map();
      g.forEach((v, i) => { if (v >= 0) (nach.get(v) ?? nach.set(v, []).get(v)).push(i); });
      const steinNr = new Map();
      let s = 0;
      g.forEach((v, i) => { if (v >= 0) steinNr.set(i, s++); });
      for (const [, liste] of nach)
        for (let x = 0; x < liste.length; x++)
          for (let y = x + 1; y < liste.length; y++)
            if (verbindbar(liste[x], liste[y]))
              return [steinNr.get(liste[x]), steinNr.get(liste[y])];
      return null;
    })()`);
    if (!paar) return;
    await jsKlick(page, '.connect-tile', paar[0]).catch(() => {});
    await warte(page, 150);
    await jsKlick(page, '.connect-tile', paar[1]).catch(() => {});
    // 260 ms laeuft die Pfad-Animation (`setTimeout` in ConnectScreen.tsx),
    // erst danach verschwindet das Paar. Weniger Pause schneidet die Linie ab
    // — und die Linie IST das Erkennungszeichen des Modus.
    await warte(page, 430);
  }
}

/**
 * Dimensions: an der Szene ziehen, damit sich der Wuerfel dreht, und
 * zwischendurch freie Steine antippen. Die Drehung allein traegt schon —
 * sie ist die einzige fortlaufende Bewegung in der ganzen Sammlung.
 */
async function dimDrehen(page) {
  // ⚠ Die Szene laesst sich NICHT ziehen — sie dreht ueber zwei Knoepfe in der
  // Fussleiste, je 45 Grad (`setRot(r ± 45)` in DimensionsScreen.tsx). Die
  // erste Fassung hat mit der Maus gezogen und damit gar nichts ausgeloest:
  // keine Bildaenderung, keine Bilder, Modus durchgefallen.
  // Reihenfolge der Knoepfe: 0 = ⟲, 1 = Tipp, 2 = Mischen, 3 = ⟳.
  // `.dim-scene` hat `transition: transform 0.4s` — die Drehung laeuft also
  // fluessig und liefert reichlich Bilder.
  //
  // IMMER IN EINE RICHTUNG, und die Pause nur wenig laenger als die
  // Uebergangszeit: So entsteht eine fast durchgehende Drehung um die eigene
  // Achse. Hin und her zu drehen (die erste Fassung) sah aus, als suche
  // jemand etwas, statt das Brett vorzufuehren.
  for (let i = 0; i < 9; i++) {
    await jsKlick(page, '.mode-foot button', 3).catch(() => {});
    await warte(page, 470);
  }
}

/**
 * Memory, fehlerfrei gespielt.
 *
 * ⚠ Die Karte liegt verdeckt, ihr Gesicht steht aber trotzdem im DOM
 * (`.mem-face` wird nur weggedreht, nicht weggelassen). Damit laesst sich das
 * passende Paar auslesen und gezielt antippen — im Bild sieht das nach einem
 * Spieler mit gutem Gedaechtnis aus. Zufaellig zu tippen waere ebenfalls
 * Bewegung, aber ein Reel, in dem nichts zusammenpasst, verkauft nichts.
 *
 * Gepaart wird ueber `faceId` (nicht ueber matchKey) — genauso wertet
 * MemoryScreen.tsx. Verdeckte Nachbarn koennen blockiert sein (`.blockiert`,
 * ab Level 13 liegt etwas darueber); die bleiben aussen vor.
 */
async function memorySpielen(page, paare) {
  for (let p = 0; p < paare; p++) {
    const paar = await page.evaluate(`(() => {
      const offen = [...document.querySelectorAll('.mem-cell')];
      const nach = new Map();
      offen.forEach((el, i) => {
        if (el.classList.contains('done') || el.classList.contains('blockiert')) return;
        const k = el.querySelector('.mem-face')?.innerHTML;
        if (!k) return;
        (nach.get(k) ?? nach.set(k, []).get(k)).push(i);
      });
      for (const [, l] of nach) if (l.length >= 2) return [l[0], l[1]];
      return null;
    })()`);
    if (!paar) return;
    await jsKlick(page, '.mem-cell', paar[0]).catch(() => {});
    await warte(page, 320);
    await jsKlick(page, '.mem-cell', paar[1]).catch(() => {});
    await warte(page, 620);
  }
}

/**
 * Match-3: den gueltigen Tausch vorher rechnen (dieselbe Regel wie
 * `findMatches` in logic.ts — drei Gleiche waagerecht oder senkrecht).
 * Ein ungueltiger Tausch federt zurueck und aendert das Bild NICHT; blind
 * getippt kam so gut wie nie ein Treffer zustande.
 */
async function match3Spielen(page, zuege) {
  for (let z = 0; z < zuege; z++) {
    const zug = await page.evaluate(`(() => {
      const zellen = [...document.querySelectorAll('.m3-cell')];
      if (!zellen.length) return null;
      const W = getComputedStyle(zellen[0].parentElement).gridTemplateColumns.split(' ').length;
      const H = Math.ceil(zellen.length / W);
      const sorten = new Map();
      const g = zellen.map((z) => {
        const k = z.innerHTML;
        if (!sorten.has(k)) sorten.set(k, sorten.size);
        return sorten.get(k);
      });
      const trefferQ = (gr) => {
        for (let r = 0; r < H; r++) for (let c = 0; c + 2 < W; c++) {
          const i = r * W + c;
          if (gr[i] >= 0 && gr[i] === gr[i + 1] && gr[i] === gr[i + 2]) return true;
        }
        for (let c = 0; c < W; c++) for (let r = 0; r + 2 < H; r++) {
          const i = r * W + c;
          if (gr[i] >= 0 && gr[i] === gr[i + W] && gr[i] === gr[i + 2 * W]) return true;
        }
        return false;
      };
      // Alle Nachbartausche durchprobieren; der erste, der eine Reihe bildet,
      // wird genommen.
      for (let i = 0; i < g.length; i++) {
        for (const j of [i + 1, i + W]) {
          if (j >= g.length) continue;
          if (j === i + 1 && (i % W) === W - 1) continue;   // nicht ueber den Rand
          const n = g.slice();
          [n[i], n[j]] = [n[j], n[i]];
          if (trefferQ(n)) return [i, j];
        }
      }
      return null;
    })()`);
    if (!zug) return;
    await jsKlick(page, '.m3-cell', zug[0]).catch(() => {});
    await warte(page, 120);
    await jsKlick(page, '.m3-cell', zug[1]).catch(() => {});
    await warte(page, 260);
  }
}

// --- Aufnahme ---------------------------------------------------------------
async function aufnehmen(name, modus) {
  const TMP = join(OUT, `.frames-${name}`);
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });

  const browser = await chromium.launch({ executablePath: browserPfad() });
  try {
    return await aufnehmenMit(browser, name, modus, TMP);
  } finally {
    // ⚠ ZWINGEND im finally. Vorher stand `browser.close()` nur am Ende des
    // Gutfalls: Scheiterte ein Modus, blieb Chromium offen, und der Lauf
    // wirkte danach „haengend" — die Zusammenfassung war laengst gedruckt,
    // node kam wegen des offenen Prozesses nur nicht mehr zum Ende. Genau
    // das hat Dimensions 3D faelschlich als unaufnehmbar erscheinen lassen
    // und einen halben Abend gekostet.
    await browser.close().catch(() => {});
  }
}

async function aufnehmenMit(browser, name, modus, TMP) {
  // isMobile/hasTouch bewusst NICHT gesetzt — sonst greift @media (hover:hover)
  // nicht und die Steine verschwinden ohne Ausblende.
  const ctx = await browser.newContext({
    viewport: { width: BREITE, height: HOEHE },
    deviceScaleFactor: DSF,
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  // ⚠ Kurzes Zeitlimit. Playwrights 30-s-Vorgabe laesst einen fehlgeschlagenen
  // Klick den ganzen Lauf blockieren, statt ihn zu melden.
  page.setDefaultTimeout(8000);
  await page.addInitScript(() => {
    localStorage.setItem('CapacitorStorage.mahjong.progress.v1', JSON.stringify({
      level: 24, coins: 500, lang: 'en', showFacts: false, sound: false,
      connectLevel: 3,
    }));
  });

  await page.goto(SERVER, { waitUntil: 'networkidle' });
  await warte(page, 2000);
  await modus.hin(page);

  // Platz fuer die spaeter eingeblendete Statusleiste (siehe
  // record-solitaire.mjs — im Browser gibt es keine Safe Area).
  await page.addStyleTag({
    content: `.app, .mode-play, .m4 { padding-top: 52px !important; padding-bottom: 26px !important; }
              .ach-toast { top: 64px !important; }`,
  });
  await warte(page, 700);

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

  await modus.spiel(page);
  await warte(page, 500);
  await cdp.send('Page.stopScreencast').catch(() => {});
  await warte(page, 300);

  if (bilder.length < 10) { console.error(`  ✗ ${name}: nur ${bilder.length} Bilder`); return null; }

  const zeilen = [];
  for (let i = 0; i < bilder.length; i++) {
    const d = i + 1 < bilder.length ? bilder[i + 1].t - bilder[i].t : 1 / FPS;
    zeilen.push(`file '${bilder[i].datei}'`, `duration ${Math.max(1 / 120, d).toFixed(4)}`);
  }
  zeilen.push(`file '${bilder[bilder.length - 1].datei}'`);
  const liste = join(TMP, 'liste.txt');
  writeFileSync(liste, zeilen.join('\n'));

  const ziel = join(OUT, `${name}.mp4`);
  await new Promise((res, rej) => {
    const p = spawn(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', liste,
      '-vf', `fps=${FPS},scale=${BREITE * DSF}:${HOEHE * DSF}:flags=lanczos`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', ziel],
    { stdio: ['ignore', 'ignore', 'pipe'] });
    let e = ''; p.stderr.on('data', (d) => { e += d; });
    p.on('close', (c) => (c === 0 ? res() : rej(new Error(e.slice(-1200)))));
  });
  rmSync(TMP, { recursive: true, force: true });
  const sek = (bilder[bilder.length - 1].t - bilder[0].t).toFixed(1);
  console.log(`  ✓ ${name}: ${bilder.length} Bilder, ${sek} s`);
  return ziel;
}

mkdirSync(OUT, { recursive: true });
const auswahl = NUR ? { [NUR]: MODI[NUR] } : MODI;
if (NUR && !MODI[NUR]) {
  console.error(`✗ unbekannter Modus: ${NUR}\n  Bekannt: ${Object.keys(MODI).join(', ')}`);
  process.exit(1);
}
let fehler = 0;
for (const [name, modus] of Object.entries(auswahl)) {
  console.log(`${name} …`);
  try { if (!await aufnehmen(name, modus)) fehler++; }
  catch (e) { console.error(`  ✗ ${name}: ${e.message.split('\n')[0]}`); fehler++; }
}
console.log(`\n${Object.keys(auswahl).length - fehler} von ${Object.keys(auswahl).length} aufgenommen → ${OUT}`);
console.log('Naechster Schritt: je Modus einen Kontaktbogen ansehen — bewegt sich wirklich etwas?');

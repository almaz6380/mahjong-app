// Gerenderte Karten (Chromium → transparentes PNG), gemeinsam fuer Reel und Spot.
//
// Warum Chromium und nicht ffmpeg: `drawtext` fehlt im ffmpeg-static-Build
// vollstaendig, und selbst mit dem Filter koennte er die woff2-Schrift nicht
// lesen. `omitBackground` liefert den Alphakanal.
//
// ⚠ Die Abspannkarte ist die MARKE. Sie steht deshalb genau einmal hier und
// nicht je einmal in make-reel.mjs und spot.mjs — zwei Fassungen der Karte
// waeren der Anfang davon, dass Reel und Spot verschieden aussehen.
//
// ⚠ GENAU DAS WAR BIS ZUM 21.08.2026 TROTZDEM DER FALL: `make-reel.mjs` trug
// eine zweite, Zeichen fuer Zeichen gleiche Fassung inline (`TEXTE.outro*`).
// Aufgefallen ist es erst, als der Abspann geaendert werden sollte — die 20
// Charge-Reels haetten stumm den alten behalten. Geteilt wird jetzt das
// MARKUP (`abspannHtml()`), nicht der Renderer: make-reel.mjs bringt seinen
// eigenen Browser mit, und den umzubauen waere ein Risiko ohne Gewinn.
// Wer die Karte anfasst, fasst sie hier an — sonst nirgends.

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
  claim: "The coolest mahjong app you've ever played — let's give it a try.",
};

// --- Store-Badges -----------------------------------------------------------
// ⚠ NICHT NACHZEICHNEN. Apple untersagt in den Marketing-Richtlinien
// ausdruecklich, das Badge nachzubauen, Google ebenso; ein selbstgemalter
// schwarzer Knopf mit Apfel waere eine Markenverletzung, auch wenn er
// identisch aussieht. Die Dateien unter `assets/badges/` sind unveraendert
// von developer.apple.com bzw. play.google.com.
//
// ⚠ Die beiden sind nicht gleich gebaut: Apples SVG ist 119,66×40 und randlos,
// Googles PNG 646×250 mit einem einbelichteten durchsichtigen Rand von 41 px
// auf allen vier Seiten (nachgemessen). Auf dieselbe DATEIhoehe skaliert wirkt
// Google spuerbar kleiner, weil ein Sechstel seiner Hoehe leerer Rand ist.
// Deshalb wird ueber die SICHTBARE Flaeche (564×168) gerechnet und der Rand
// weggeschnitten. Beide Richtlinien verlangen gleiche Hoehe nebeneinander.
const G_RAND = 41, G_INHALT_B = 564, G_INHALT_H = 168;

const b64 = (datei, typ) =>
  `data:${typ};base64,${readFileSync(join(ASSETS, datei)).toString('base64')}`;

/** Beide Badges nebeneinander, auf gleiche sichtbare Hoehe gebracht. */
export function badges(hoehe, oben, abstand = 34) {
  const f = hoehe / G_INHALT_H;
  const gb = Math.round(G_INHALT_B * f), gr = Math.round(G_RAND * f);
  return `<div style="position:absolute;left:0;top:${oben}px;width:${B}px;display:flex;
                      justify-content:center;align-items:center;gap:${abstand}px">
    <img src="${b64('badges/apple-app-store.svg', 'image/svg+xml')}"
         style="height:${hoehe}px;display:block">
    <span style="display:inline-block;position:relative;overflow:hidden;
                 width:${gb}px;height:${hoehe}px">
      <img src="${b64('badges/google-play.png', 'image/png')}"
           style="position:absolute;left:${-gr}px;top:${-gr}px;
                  width:${gb + 2 * gr}px;height:${hoehe + 2 * gr}px;display:block">
    </span>
  </div>`;
}

// ⚠ `logo.png` ist zu 100 % DECKEND und bringt seinen eigenen Gruenton mit
// (#164D3C, nachgemessen), waehrend der Kartenverlauf dunkler ist. Bis zum
// 21.08.2026 stand deshalb in JEDEM Abspann ein sichtbar hellerer Kasten
// hinter dem Logo. Nicht freistellen: Das Bild IST das App-Icon, und ein Icon
// darf eine eigene Flaeche haben. Runde Ecken und ein Schatten machen daraus
// ein Icon statt einer Panne.
const ikone = (groesse, links, oben) =>
  `<img src="${b64('logo.png', 'image/png')}"
        style="position:absolute;left:${links}px;top:${oben}px;
               width:${groesse}px;height:${groesse}px;
               border-radius:${Math.round(groesse * 0.225)}px;
               box-shadow:0 18px 44px rgba(0,0,0,.45)">`;

/**
 * Das Markup der Abspannkarte — die eine Quelle fuer alle Bauskripte.
 *
 * Aufbau (Josefs Wahl vom 21.08.2026, Variante „B"): Icon → Name → Modus-Zeile
 * → Spruch → beide Store-Badges. Die Schriftgroessen sind gegenueber der alten
 * Karte kleiner, weil mit Spruch UND Modus-Zeile zwei Textbloecke mehr auf
 * derselben Flaeche stehen.
 */
export function abspannHtml() {
  return `<div style="position:absolute;inset:0;
            background:linear-gradient(160deg,#123f2e,#0b2a1e 60%,#06201a)"></div>
    ${ikone(270, 405, 420)}
    <div class="mitte" style="top:750px;font-size:94px;font-weight:800;line-height:1.05">
      ${ABSPANN.titel.split('\n').join('<br>')}</div>
    <div class="mitte" style="top:1000px;font-size:34px;font-weight:500;opacity:.75">
      ${ABSPANN.sub}</div>
    <div class="mitte" style="top:1090px;font-size:40px;font-weight:600;line-height:1.3;opacity:.92">
      ${ABSPANN.claim}</div>
    ${badges(104, 1400)}`;
}

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

/** Der deckende Abspann: Icon, Name, Modi, Spruch, beide Store-Badges. */
export async function abspannKarte(schuss, datei) {
  await schuss(abspannHtml(), datei, { width: B, height: H });
}

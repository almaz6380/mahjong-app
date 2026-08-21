#!/usr/bin/env node
// Vorschau: drei Anordnungen der Abspannkarte nebeneinander.
//
//   node scripts/reel/abspann-varianten.mjs
//
// Nur zum Ansehen und Entscheiden — die gewaehlte Fassung wandert danach nach
// `karten.mjs`. Kein Video: Die Entscheidung braucht keine 20 Sekunden Film.

import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mitBrowser, B, H } from './karten.mjs';
import { lauf } from './ffmpeg.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');
const ASSETS = join(HIER, 'assets');
const OUT = join(WURZEL, 'out/reels/abspann');

const CLAIM = "The coolest mahjong app you've ever played — let's give it a try.";
const TITEL = 'Mahjong<br>Royale';
const SUB = 'Solitaire · Connect · Riichi · 4 Players';

const b64 = (p, typ) => `data:${typ};base64,${readFileSync(p).toString('base64')}`;

const logo = b64(join(ASSETS, 'logo.png'), 'image/png');

// ⚠ `logo.png` ist zu 100 % DECKEND und bringt seinen eigenen Gruenton mit
// (#164D3C, nachgemessen) — der Verlauf der Karte ist dunkler. Bisher stand
// deshalb in jedem Abspann ein sichtbar hellerer Kasten hinter dem Logo.
// Nicht freistellen: Das Bild IST das App-Icon, und ein Icon darf eine eigene
// Flaeche haben. Es bekommt runde Ecken und einen Schatten und liest sich
// damit als Icon statt als Fehler.
const ikone = (groesse, links, oben) =>
  `<img src="${logo}" style="position:absolute;left:${links}px;top:${oben}px;
     width:${groesse}px;height:${groesse}px;border-radius:${Math.round(groesse * 0.225)}px;
     box-shadow:0 18px 44px rgba(0,0,0,.45)">`;
const apple = b64(join(ASSETS, 'badges', 'apple-app-store.svg'), 'image/svg+xml');
const google = b64(join(ASSETS, 'badges', 'google-play.png'), 'image/png');

// ⚠ Die beiden Badges sind NICHT gleich gebaut. Apples SVG ist 119,66×40 und
// randlos; Googles PNG ist 646×250 mit einem einbelichteten, durchsichtigen
// Rand von 41 px auf allen vier Seiten (nachgemessen). Skaliert man beide auf
// dieselbe Dateihoehe, wirkt Google spuerbar kleiner, weil ein Sechstel seiner
// Hoehe leerer Rand ist. Deshalb wird Googles Rand hier weggeschnitten und
// ueber die SICHTBARE Flaeche (564×168) skaliert.
//
// Nachgezeichnet wird keines von beiden: Apple untersagt das in den
// Marketing-Richtlinien ausdruecklich, Google ebenso. Die Dateien sind
// unveraendert von developer.apple.com bzw. play.google.com.
const G_RAND = 41, G_INHALT_B = 564, G_INHALT_H = 168;

function badges(hoehe, abstand = 34) {
  const f = hoehe / G_INHALT_H;
  const gb = Math.round(G_INHALT_B * f), gr = Math.round(G_RAND * f);
  return `<div style="position:absolute;left:0;width:${B}px;display:flex;
                      justify-content:center;align-items:center;gap:${abstand}px">
    <img src="${apple}" style="height:${hoehe}px;display:block">
    <span style="display:inline-block;position:relative;overflow:hidden;
                 width:${gb}px;height:${hoehe}px">
      <img src="${google}" style="position:absolute;left:${-gr}px;top:${-gr}px;
           width:${gb + 2 * gr}px;height:${hoehe + 2 * gr}px;display:block">
    </span>
  </div>`;
}

const grund = `<div style="position:absolute;inset:0;
  background:linear-gradient(160deg,#123f2e,#0b2a1e 60%,#06201a)"></div>`;

// A — der Spruch ERSETZT die Modus-Zeile.
const A = `${grund}
  ${ikone(300, 390, 470)}
  <div class="mitte" style="top:850px;font-size:104px;font-weight:800;line-height:1.05">${TITEL}</div>
  <div class="mitte" style="top:1135px;font-size:44px;font-weight:600;line-height:1.32;opacity:.92">${CLAIM}</div>
  ${badges(108).replace('position:absolute;', 'position:absolute;top:1420px;')}`;

// B — Modus-Zeile UND Spruch. Alles eine Spur kleiner, sonst wird es eng.
const B_ = `${grund}
  ${ikone(270, 405, 420)}
  <div class="mitte" style="top:750px;font-size:94px;font-weight:800;line-height:1.05">${TITEL}</div>
  <div class="mitte" style="top:1000px;font-size:34px;font-weight:500;opacity:.75">${SUB}</div>
  <div class="mitte" style="top:1090px;font-size:40px;font-weight:600;line-height:1.3;opacity:.92">${CLAIM}</div>
  ${badges(104).replace('position:absolute;', 'position:absolute;top:1400px;')}`;

// C — der Spruch IST die Karte, kein Titel.
const C = `${grund}
  ${ikone(300, 390, 500)}
  <div class="mitte" style="top:900px;font-size:74px;font-weight:800;line-height:1.16">${CLAIM}</div>
  ${badges(112).replace('position:absolute;', 'position:absolute;top:1430px;')}`;

mkdirSync(OUT, { recursive: true });
const dateien = [];
await mitBrowser(async (schuss) => {
  for (const [name, html] of [['A', A], ['B', B_], ['C', C]]) {
    const f = join(OUT, `abspann-${name}.png`);
    await schuss(html, f, { width: B, height: H });
    dateien.push(f);
  }
  // Die Badges einzeln, um ihre sichtbare Hoehe nachmessen zu koennen.
  await schuss(`<div style="position:absolute;inset:0">${badges(96).replace('position:absolute;', 'position:absolute;top:100px;')}</div>`,
    join(OUT, 'badges-nur.png'), { width: B, height: 400 });
});

// Vergleichsbild: die drei nebeneinander, beschriftet.
await lauf(['-y', ...dateien.flatMap((f) => ['-i', f]),
  '-filter_complex',
  '[0]scale=520:-1[a];[1]scale=520:-1[b];[2]scale=520:-1[c];'
  + '[a][b][c]hstack=inputs=3,pad=iw:ih+70:0:70:color=#f3ece1[v]',
  '-map', '[v]', '-frames:v', '1', join(OUT, 'vergleich.png')]);

console.log(`✓ ${OUT}`);
for (const f of dateien) console.log(`  ${f}`);
console.log(`  ${join(OUT, 'vergleich.png')}`);

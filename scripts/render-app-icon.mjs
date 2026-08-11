// App-Icon aus den drei Steinen der Feature-Grafik rendern (Variante C).
//
// Erzeugt:
//   assets/icon-only.png        1024 — volles Quadrat (iOS; keine Transparenz,
//                                      keine runden Ecken — die setzt das System)
//   assets/icon-background.png  1024 — nur der Verlauf (Android, adaptive Ebene)
//   assets/icon-foreground.png  1024 — nur die Steine, transparent, im Schutzbereich
//   store/play-icon-512.png     512  — Play-Store-Eintrag
//   store/play-icon-1024.png    1024 — Reserve
//
// Android beschneidet adaptive Icons außen: Inhalt muss in die mittleren ~66 %.
// Deshalb ist die Vordergrund-Ebene kleiner skaliert als das iOS-Quadrat.
//
// Aufruf: node scripts/render-app-icon.mjs
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const b64 = (p, m) => `data:${m};base64,${readFileSync(join(REPO, p)).toString('base64')}`;
const TEMPEL = b64('src/assets/home-temple.webp', 'image/webp');
const MARBLE = b64('src/assets/tiles/face-marble.webp', 'image/webp');
const DRACHE = b64('src/assets/tiles/myth1.webp', 'image/webp');
const ZHONG = b64('src/assets/symbol-zhong.webp', 'image/webp');
const MUENZE = b64('src/assets/coin.webp', 'image/webp');

const BG = 'radial-gradient(120% 130% at 30% 22%,#1d5c46 0%,#134536 48%,#0b2c22 100%)';

// --- Tempel-Hintergrund (seit 11.08.2026) -----------------------------------
// Dasselbe Motiv, das seit 1.1.0 hinter allen Bildschirmen der App liegt
// (src/assets/home-temple.webp) — damit Icon und App dieselbe Welt zeigen.
//
// ⚠ Die Steingruppe steht auf TILES = 0.80 statt formatfüllend. Bei voller
// Größe belegt sie rund 85 % der Fläche und verdeckt vom Motiv praktisch alles;
// erst geschrumpft bleibt der Tempel sichtbar.
//
// Der Bildausschnitt ist so gewählt, dass die Pagode links oben im
// Schutzbereich liegt — Androids adaptive Maske beschneidet die
// Hintergrund-Ebene rundum, was zu weit außen liegt, ist mal da und mal weg.
const TILES = 0.80;

const FOTO = `
<div style="position:absolute;inset:0;
  background-image:url(${TEMPEL});background-size:190% auto;background-position:34% 22%;
  filter:saturate(1.15) contrast(1.05)"></div>`;

// Ohne diese beiden Schichten säuft der Stein-Stapel im Nebel ab: unten
// abdunkeln, damit die Steine eine Kante behalten, und die Ränder leicht
// vignettieren, damit das Icon in jeder Maske geschlossen wirkt.
const TIEFE = `
<div style="position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(11,44,34,.10) 0%,rgba(11,44,34,.30) 55%,rgba(11,44,34,.72) 100%)"></div>
<div style="position:absolute;inset:0;
  background:radial-gradient(78% 78% at 50% 44%,transparent 42%,rgba(8,32,25,.55) 100%)"></div>`;

const SZENE = FOTO + TIEFE;

// Die Steingruppe; `s` skaliert sie (TILES = iOS-Format, kleiner für Android).
const gruppe = (s) => `
<div class="grp" style="transform:translate(-50%,-50%) scale(${s})">
  <div class="tile t-l"><img src="${DRACHE}"></div>
  <div class="tile t-r"><img src="${MUENZE}"></div>
  <div class="tile t-c"><img src="${ZHONG}"></div>
</div>`;

const stil = (hintergrund) => `
*{margin:0;padding:0;box-sizing:border-box}
body{width:1024px;height:1024px;overflow:hidden;background:${hintergrund}}
.grp{position:absolute;left:50%;top:50%;width:1024px;height:1024px}
.tile{position:absolute;background-image:url(${MARBLE});background-size:cover;
  background-position:center;border-radius:58px;
  box-shadow:0 34px 64px rgba(0,0,0,.5),inset 0 0 0 9px rgba(201,162,39,.9);
  display:flex;align-items:center;justify-content:center}
.tile img{object-fit:contain}
.t-l{width:330px;height:446px;left:56px;top:330px;transform:rotate(-17deg);opacity:.96}
.t-r{width:330px;height:446px;right:56px;top:330px;transform:rotate(17deg);opacity:.96}
.t-c{width:560px;height:756px;left:232px;top:126px;z-index:2}
.t-l img,.t-r img{width:64%;height:64%}
.t-c img{width:66%;height:66%}
`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  // --no-sandbox nur nötig, wenn der Lauf als root passiert (Container/CI).
  args: [...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
});
const page = await browser.newPage();
mkdirSync(join(REPO, 'store'), { recursive: true });

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// ⚠ NICHT `networkidle0`: Alle Bilder stecken als data:-URI im HTML, es gibt
// also nie Netzverkehr, auf den zu warten wäre. Beim ERSTEN setContent löst es
// trotzdem aus, beim zweiten auf derselben Seite nicht mehr — der Lauf bleibt
// dann 30 s hängen und bricht ab, nachdem das erste Bild schon geschrieben ist.
async function schuss(html, ziel, groesse = 1024, transparent = false) {
  await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: groesse / 1024 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await warte(400); // Verläufe und clip-paths sind sonst gelegentlich halb gemalt
  await page.screenshot({
    path: join(REPO, ziel), omitBackground: transparent,
    clip: { x: 0, y: 0, width: 1024, height: 1024 },
  });
  console.log(`  ${ziel} (${groesse}px)`);
}

// iOS / Store: volles Quadrat mit Hintergrund
const voll = `<style>${stil(BG)}</style>${SZENE}${gruppe(TILES)}`;
await schuss(voll, 'assets/icon-only.png');
await schuss(voll, 'store/play-icon-1024.png');
await schuss(voll, 'store/play-icon-512.png', 512);

// Android: Hintergrund-Ebene — Verlauf UND Szene. Die Berge sind breite Formen
// und vertragen den Beschnitt; läge die Szene in der Vordergrund-Ebene, würde
// sie mitsamt den Steinen auf 66 % geschrumpft und säße als Miniatur mittig.
await schuss(`<style>${stil(BG)}</style>${SZENE}`, 'assets/icon-background.png');

// Android: Vordergrund-Ebene, transparent, auf ~66 % Schutzbereich verkleinert.
// TILES muss mit hinein, sonst stünden die Steine auf Android größer als im
// iOS-Quadrat und die Berge verschwänden wieder dahinter.
await schuss(`<style>${stil('transparent')}</style>${gruppe(TILES * 0.66)}`,
             'assets/icon-foreground.png', 1024, true);

await browser.close();
console.log('\nDanach: npx @capacitor/assets generate  (erzeugt alle Plattformgrößen)');

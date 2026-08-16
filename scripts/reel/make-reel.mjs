#!/usr/bin/env node
// Baut aus einer Gameplay-Aufnahme ein fertiges Reel: Hook, Spiel, Abspann, Ton.
//
//   node scripts/reel/record-solitaire.mjs --level 12 --paare 18
//   node scripts/reel/make-reel.mjs [--clip out/reels/mahjong-solitaire-lvl12-en.mp4]
//
// Kostet nichts. Klänge und Schrift liegen in scripts/reel/assets/.
//
// Warum ein Hook: Ohne die erste Frage ist das Ganze ein hübscher
// Bildschirmschoner. Die Aufforderung mitzuraten erzeugt Kommentare, und
// Kommentare erzeugen Auslieferung.

import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spurRendern } from './synth.mjs';
import { FORMATE, fakten, captionText } from './formate.mjs';
import { browserPfad } from './browser.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FFMPEG = require('ffmpeg-static');

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');
const ASSETS = join(HIER, 'assets');

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const CLIP = join(WURZEL, arg('clip', 'out/reels/mahjong-solitaire-lvl12-en.mp4'));
const FORMAT = arg('format', 'paar');
const NAME = arg('name', null);            // Dateiname ohne Endung
const FAKT_NR = Number(arg('fakt', 0));    // welcher Fakt beim Format `fakt`
const OUT = join(WURZEL, arg('out', 'out/reels'));
const TMP = join(OUT, '.bau');
const B = 1080, H = 1920, FPS = 30;

if (!FORMATE[FORMAT]) {
  console.error(`✗ unbekanntes Format: ${FORMAT}\n  Bekannt: ${Object.keys(FORMATE).join(', ')}`);
  process.exit(1);
}
const HOOK_SEK = FORMATE[FORMAT].hookSek;
const OUTRO_SEK = 4.2;

// Ueberblendzeit zum Abspann. Der Hartschnitt war der Grund, warum das Reel am
// Ende „abgehackt" wirkte: Das halb geraeumte Brett verschwand von einem Bild
// aufs naechste hinter dem deckenden Abspann.
// (Die frueher hier stehende `BLENDE_SPIEL` ist mit dem Hook-Vorspann
// entfallen — es gibt keinen Schnitt vom Hook ins Spiel mehr.)
const BLENDE_ABSPANN = 0.55;

// Beim Format `fakt` traegt die Unterzeile den Fakt selbst — deshalb wird er
// hier schon geladen, er bestimmt den Text der Eingangskarte.
const FAKT = FORMAT === 'fakt' ? fakten()[FAKT_NR % fakten().length] : null;

const TEXTE = {
  hook: FORMATE[FORMAT].hook,
  hookSub: FORMATE[FORMAT].hookSub ?? (FAKT ? FAKT.en : ''),
  outroTitel: 'Mahjong\nRoyale',
  outroSub: 'Solitaire · Connect · Riichi · 4 Players',
  outroCta: 'Free on the App Store & Google Play',
};

if (!existsSync(CLIP)) {
  console.error(`✗ Aufnahme fehlt: ${CLIP}\n  Erst record-solitaire.mjs laufen lassen.`);
  process.exit(1);
}
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const lauf = (args) => new Promise((res, rej) => {
  const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (c) => (c === 0 ? res() : rej(new Error(err.slice(-1500)))));
});

// Laenge messen — ffprobe liegt diesem Container nicht bei, es gibt nur
// ffmpeg-static. `lauf()` taugt dafuer nicht: ffmpeg beendet sich hier mit
// Code 1, weil kein Ausgabeziel angegeben ist.
const dauerVon = (datei) => new Promise((res) => {
  const p = spawn(FFMPEG, ['-hide_banner', '-i', datei]);
  let e = ''; p.stderr.on('data', (d) => { e += d; });
  p.on('close', () => {
    const m = e.match(/Duration: (\d+):(\d+):(\d+\.?\d*)/);
    res(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0);
  });
});

// --- Karten als transparente PNG ------------------------------------------
// Wie im Anigosha-Generator: Chromium rendert, weil ffmpeg-drawtext kein woff2
// kann. omitBackground liefert den Alphakanal.
async function karten() {
  const font = readFileSync(join(ASSETS, 'outfit.woff2')).toString('base64');
  const logo = readFileSync(join(ASSETS, 'logo.png')).toString('base64');
  const css = `
@font-face{font-family:'Outfit';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;background:transparent;font-family:'Outfit',sans-serif;color:#fff}
.mitte{position:absolute;left:70px;width:940px;text-align:center}
.schatten{text-shadow:0 0 30px rgba(6,32,24,.95),-3px -3px 0 #06201a,3px -3px 0 #06201a,-3px 3px 0 #06201a,3px 3px 0 #06201a}`;

  const browser = await chromium.launch({ executablePath: browserPfad() });
  const page = await browser.newPage({ viewport: { width: B, height: H } });

  const schuss = async (html, datei) => {
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style>${html}`,
      { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    writeFileSync(datei, await page.screenshot({ type: 'png', omitBackground: true }));
  };

  // Der Text braucht eine eigene dunkle Flaeche. Nur Kontur und Schlagschatten
  // reichen auf den hellen Steinen nicht — die Unterzeile war dort faktisch
  // unlesbar. Das Band laeuft oben und unten weich aus, damit es nicht wie ein
  // aufgeklebter Balken wirkt.
  // Der Block wird per Flexbox zentriert statt auf feste Pixel gesetzt: Beim
  // Format `fakt` traegt die Unterzeile einen ganzen Satz ueber mehrere
  // Zeilen, bei `paar` nur vier Woerter. Feste Positionen wuerden bei einem
  // der beiden Faelle immer danebenliegen.
  const titelGroesse = TEXTE.hook.length > 22 ? 88 : 106;
  await schuss(
    // Ganzflaechige Abdunklung: Sie lag frueher als `eq=brightness` auf dem
    // eingefrorenen Standbild. Seit die Karte ueber dem LAUFENDEN Spiel liegt,
    // gehoert sie ins Bild — so verschwindet sie zusammen mit der Karte in
    // einer einzigen Blende, statt als zweite Ebene nachgezogen zu werden.
    `<div style="position:absolute;inset:0;background:rgba(6,32,26,.34)"></div>
     <div style="position:absolute;left:0;top:900px;width:${B}px;height:720px;
                 background:linear-gradient(180deg,rgba(6,32,26,0),rgba(6,32,26,.82) 18%,
                            rgba(6,32,26,.88) 50%,rgba(6,32,26,.82) 82%,rgba(6,32,26,0))"></div>
     <div style="position:absolute;left:70px;top:900px;width:940px;height:720px;display:flex;
                 flex-direction:column;align-items:center;justify-content:center;
                 text-align:center;gap:38px">
       <div class="schatten" style="font-size:${titelGroesse}px;font-weight:800;line-height:1.06">
         ${TEXTE.hook.split('\n').join('<br>')}</div>
       ${TEXTE.hookSub ? `<div style="font-size:40px;font-weight:600;color:#ffd76a;line-height:1.34">
         ${TEXTE.hookSub}</div>` : ''}
     </div>`,
    join(TMP, 'hook.png'));

  // Der Abspann ist deckend — er soll das Brett ersetzen, nicht überlagern.
  await schuss(
    `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#123f2e,#0b2a1e 60%,#06201a)"></div>
     <img src="data:image/png;base64,${logo}" style="position:absolute;left:390px;top:545px;width:300px;height:300px">
     <div class="mitte" style="top:930px;font-size:104px;font-weight:800;line-height:1.05">
       ${TEXTE.outroTitel.split('\n').join('<br>')}</div>
     <div class="mitte" style="top:1200px;font-size:36px;font-weight:500;opacity:.8">${TEXTE.outroSub}</div>
     <div style="position:absolute;left:130px;top:1330px;width:820px;padding:32px 0;border-radius:999px;
                 text-align:center;font-size:38px;font-weight:700;color:#06201a;
                 background:linear-gradient(100deg,#ffe07a,#f5b301)">${TEXTE.outroCta}</div>`,
    join(TMP, 'outro.png'));

  // Statusleiste des Handys: Uhrzeit links, Empfang/WLAN/Akku rechts, unten
  // der Home-Indikator. Damit liest sich das Video als echte Aufnahme vom
  // Geraet und nicht als abgefilmter Browser.
  const balken = (h) => `<div style="width:6px;height:${h}px;background:#fff;border-radius:2px"></div>`;
  await schuss(
    `<div style="position:absolute;left:0;top:0;width:${B}px;height:156px">
       <div style="position:absolute;left:96px;top:46px;font-size:46px;font-weight:600;letter-spacing:.01em">9:41</div>
       <div style="position:absolute;right:96px;top:58px;display:flex;align-items:flex-end;gap:8px">
         ${balken(14)}${balken(20)}${balken(26)}${balken(32)}
         <svg width="36" height="30" viewBox="0 0 36 30" style="margin-left:10px">
           <path d="M18 25.5a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" fill="#fff"/>
           <path d="M9.5 16.5a12 12 0 0117 0" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round"/>
           <path d="M3.5 10a20.5 20.5 0 0129 0" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round"/>
         </svg>
         <svg width="54" height="28" viewBox="0 0 54 28" style="margin-left:10px">
           <rect x="1.5" y="3" width="44" height="22" rx="6" stroke="#fff" stroke-width="2.6" fill="none" opacity=".65"/>
           <rect x="5" y="6.5" width="33" height="15" rx="3.5" fill="#fff"/>
           <path d="M49 10.5v7a4 4 0 000-7z" fill="#fff" opacity=".65"/>
         </svg>
       </div>
     </div>
     <div style="position:absolute;left:${(B - 420) / 2}px;top:${H - 46}px;width:420px;height:14px;
                 border-radius:999px;background:#fff;opacity:.92"></div>`,
    join(TMP, 'status.png'));

  await browser.close();
}

console.log('Karten rendern …');
await karten();

// --- Abspann ----------------------------------------------------------------
console.log('Abspann bauen …');
await lauf([
  '-y', '-loop', '1', '-t', String(OUTRO_SEK), '-i', join(TMP, 'outro.png'),
  '-vf', `fps=${FPS},format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', join(TMP, 'outro.mp4'),
]);

// --- Gameplay + Hook als Overlay -------------------------------------------
// ⚠ Hier steckt die wichtigste Lehre des Formats: Der Hook war bis zum
// 16.08.2026 ein VORSPANN — das erste Bild der Aufnahme eingefroren, Karte
// darueber, 1,6 bis 3,6 Sekunden lang. Auf TikTok und in Reels entscheidet
// sich in der ersten Sekunde, ob weitergewischt wird, und ein Standbild ist
// genau das Muster, bei dem gewischt wird. Beim Format `fakt` waren es 3,6
// Sekunden ohne jede Bewegung. Damit faellt die durchschnittliche
// Wiedergabedauer, und die ist der Faktor, an dem die Plattform entscheidet,
// ob ein Video ueber die erste Testgruppe hinauskommt.
//
// Jetzt laeuft das Spiel ab Bild 1 und die Karte liegt DARUEBER: Lesezeit und
// Bewegung gleichzeitig statt nacheinander. Die Karte blendet nach HOOK_SEK
// weg und gibt das Brett frei. Nebenbei wird jedes Reel um HOOK_SEK kuerzer,
// was der Abspielrate ebenfalls hilft.
//
// Reihenfolge der Ebenen: Spiel → Hook-Karte → Statusleiste. Die Leiste liegt
// ganz oben, weil sie zum Geraet gehoert und nicht zum Bild.
console.log('Gameplay + Hook …');
await lauf([
  '-y', '-i', CLIP,
  '-loop', '1', '-i', join(TMP, 'hook.png'),
  '-loop', '1', '-i', join(TMP, 'status.png'),
  '-filter_complex',
  `[0:v]scale=${B}:${H}[g];`
  // Der Alpha-Fade allein blendet die Karte aus; ein `enable`-Fenster braucht
  // es nicht. Wichtig ist nur, dass der Alpha wirklich auf 0 laeuft — das
  // Standbild liegt danach unsichtbar weiter im Filtergraphen.
  + `[1:v]format=rgba,fade=t=in:st=0.10:d=0.35:alpha=1,`
  + `fade=t=out:st=${HOOK_SEK.toFixed(2)}:d=0.45:alpha=1[k];`
  + `[g][k]overlay=0:0:shortest=1[gk];`
  + `[gk][2:v]overlay=0:0:shortest=1,fps=${FPS}[v]`,
  '-map', '[v]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-an',
  join(TMP, 'spiel.mp4'),
]);

// --- Zusammenschneiden ------------------------------------------------------
// Nur noch EINE Blende: Spiel → Abspann. Die Blende vom Hook ins Spiel ist
// entfallen, seit der Hook als Overlay im Spiel selbst liegt (siehe oben) —
// es gibt keinen Schnitt mehr, an dem etwas ueberblendet werden muesste.
//
// Bewusst `xfade` statt des concat-Demuxers: concat kann nur stumpf
// aneinanderhaengen, und genau das war zu sehen. `xfade` kostet ein
// Neukodieren, dafuer loest sich das Brett in den Abspann auf, statt von ihm
// verdeckt zu werden.
console.log('Blenden setzen …');
const spielDauer = await dauerVon(join(TMP, 'spiel.mp4'));
const versatz2 = spielDauer - BLENDE_ABSPANN;
const dauer = spielDauer + OUTRO_SEK - BLENDE_ABSPANN;

await lauf([
  '-y', '-i', join(TMP, 'spiel.mp4'), '-i', join(TMP, 'outro.mp4'),
  '-filter_complex',
  // `fadeblack` statt `fade`: Sieg-Karte und Abspann tragen beide viel Text an
  // aehnlicher Stelle — eine direkte Kreuzblende legt sie uebereinander und
  // beides wird unleserlich. Der kurze Weg ueber Schwarz liest sich als
  // gewollter Schnitt.
  `[0:v][1:v]xfade=transition=fadeblack:duration=${BLENDE_ABSPANN}:offset=${versatz2.toFixed(3)},`
  + `format=yuv420p,fps=${FPS}[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'stumm.mp4'),
]);

// --- Ton --------------------------------------------------------------------
// Musikteppich leise, damit in der App noch ein Trending-Sound darüberpasst.
// Whoosh auf den Hook, Sting auf den Abspann.
console.log('Ton mischen …');
const sfx = (n) => join(ASSETS, 'sfx', `${n}.aac`);
const ms = (s) => Math.round(Math.max(0, s) * 1000);
const outroAb = Math.max(0, dauer - OUTRO_SEK);   // = Beginn der Abspann-Blende

// Die Klaenge des Spiels. Sie sind der eigentliche Reiz des Formats: 19 Steine
// in einem Rhythmus, der mit dem Tempo anzieht. Die Aufnahme liefert nur Bild
// (CDP-Screencast), also wird die Spur aus den mitgeschriebenen Klickzeiten neu
// erzeugt — mit demselben Synth wie in der App (synth.mjs).
let beiblatt = {};
try { beiblatt = JSON.parse(readFileSync(CLIP.replace(/\.mp4$/, '.json'), 'utf8')); } catch { /* optional */ }
// Das Gameplay beginnt jetzt bei 0 — es gibt keinen Vorspann mehr, der die
// Klickzeiten nach hinten schoebe. ⚠ Diese Zeile war der Grund, warum der
// Umbau des Hooks nicht nur eine Frage der Optik ist: Bliebe hier ein Versatz
// stehen, laegen alle Steinklaenge um HOOK_SEK hinter dem Bild.
const versatzSpiel = 0;

const ereignisse = (beiblatt.klicks ?? [])
  .map((k) => ({ t: versatzSpiel + k.t, klang: k.art }));
if (beiblatt.siegBei != null) {
  ereignisse.push({ t: versatzSpiel + beiblatt.siegBei, klang: 'win', vol: 1.25 });
}

const spuren = [
  // Musikteppich leise, damit in der App noch ein Trending-Sound darüberpasst.
  // Die Einblende nimmt ihm den Anfangs-Knacks.
  `[0:a]atrim=0:${dauer.toFixed(2)},volume=0.10,afade=t=in:st=0:d=1.0[bed]`,
  `[1:a]adelay=100|100,volume=0.55[w]`,
  `[2:a]adelay=${ms(outroAb)}|${ms(outroAb)},volume=0.7[o]`,
];
const namen = ['[bed]', '[w]', '[o]'];
const eingaben = ['-i', sfx('bett'), '-i', sfx('whoosh'), '-i', sfx('outro')];

if (ereignisse.length) {
  const spielSpur = join(TMP, 'spielklang.wav');
  spurRendern(ereignisse, dauer + 1.5, spielSpur);
  eingaben.push('-i', spielSpur);
  spuren.push(`[3:a]volume=1.0[spiel]`);
  namen.push('[spiel]');
  console.log(`  ${beiblatt.klicks.length} Steinklaenge${beiblatt.siegBei != null ? ' + Sieg' : ''}`);
} else {
  console.log('  ⚠ keine Klickzeiten im Beipackzettel — Reel bleibt ohne Spielklang');
}

await lauf([
  '-y', ...eingaben,
  '-filter_complex',
  spuren.join(';') + ';'
  + `${namen.join('')}amix=inputs=${namen.length}:normalize=0:dropout_transition=0,`
  + `alimiter=limit=0.89:level=disabled,`
  // Laengere Schlussblende: 1 s riss den Klang mitten aus dem Sting.
  + `afade=t=out:st=${Math.max(0, dauer - 1.6).toFixed(2)}:d=1.6[a]`,
  '-map', '[a]', '-t', dauer.toFixed(2), '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
  join(TMP, 'ton.m4a'),
]);

const basis = NAME ?? `mahjong-${FORMAT}-lvl${beiblatt.level ?? '?'}-EN`;
const ziel = join(OUT, `${basis}.mp4`);
await lauf([
  '-y', '-i', join(TMP, 'stumm.mp4'), '-i', join(TMP, 'ton.m4a'),
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest',
  '-movflags', '+faststart', ziel,
]);

// Caption + Hashtags daneben. Auf dem Handy gibt es keinen Dateimanager und
// keine Lust, sich Text auszudenken — die Datei ist zum Kopieren gedacht.
writeFileSync(join(OUT, `${basis}.txt`), captionText(FORMAT, {
  datei: `${basis}.mp4`,
  level: beiblatt.level ?? '?',
  paare: beiblatt.paare ?? '?',
  spielSek: (beiblatt.dauer ?? 0).toFixed(0),
  gesamtSek: dauer.toFixed(0),
  fakt: FAKT ? FAKT.en : null,
}));

rmSync(TMP, { recursive: true, force: true });
console.log(`\n✓ ${ziel}  (${(statSync(ziel).size / 1024 / 1024).toFixed(1)} MB, ${dauer.toFixed(1)} s)`);
console.log(`✓ ${join(OUT, `${basis}.txt`)}`);

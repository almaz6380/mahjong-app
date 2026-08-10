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

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const FFMPEG = require('ffmpeg-static');

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');
const ASSETS = join(HIER, 'assets');

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const CLIP = join(WURZEL, arg('clip', 'out/reels/mahjong-solitaire-lvl12-en.mp4'));
const OUT = join(WURZEL, 'out/reels');
const TMP = join(OUT, '.bau');
const B = 1080, H = 1920, FPS = 30;

const HOOK_SEK = 1.8;
const OUTRO_SEK = 3.0;

const TEXTE = {
  hook: 'Can you spot\nthe pair?',
  hookSub: 'Only 1 in 10 finds it in time',
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

  const browser = await chromium.launch(
    process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
  );
  const page = await browser.newPage({ viewport: { width: B, height: H } });

  const schuss = async (html, datei) => {
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style>${html}`,
      { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    writeFileSync(datei, await page.screenshot({ type: 'png', omitBackground: true }));
  };

  await schuss(
    `<div class="mitte schatten" style="top:1120px;font-size:104px;font-weight:800;line-height:1.08">
       ${TEXTE.hook.split('\n').join('<br>')}</div>
     <div class="mitte schatten" style="top:1400px;font-size:38px;font-weight:600;opacity:.9">
       ${TEXTE.hookSub}</div>`,
    join(TMP, 'hook.png'));

  // Der Abspann ist deckend — er soll das Brett ersetzen, nicht überlagern.
  await schuss(
    `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#123f2e,#0b2a1e 60%,#06201a)"></div>
     <img src="data:image/png;base64,${logo}" style="position:absolute;left:390px;top:430px;width:300px;height:300px">
     <div class="mitte" style="top:800px;font-size:104px;font-weight:800;line-height:1.05">
       ${TEXTE.outroTitel.split('\n').join('<br>')}</div>
     <div class="mitte" style="top:1070px;font-size:36px;font-weight:500;opacity:.8">${TEXTE.outroSub}</div>
     <div style="position:absolute;left:130px;top:1200px;width:820px;padding:32px 0;border-radius:999px;
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

// --- Hook: erstes Bild der Aufnahme einfrieren, Karte darüber ---------------
console.log('Hook bauen …');
await lauf(['-y', '-i', CLIP, '-frames:v', '1', join(TMP, 'standbild.png')]);
await lauf([
  '-y', '-loop', '1', '-t', String(HOOK_SEK), '-i', join(TMP, 'standbild.png'),
  '-loop', '1', '-t', String(HOOK_SEK), '-i', join(TMP, 'hook.png'),
  '-loop', '1', '-t', String(HOOK_SEK), '-i', join(TMP, 'status.png'),
  '-filter_complex',
  // Das Brett wird abgedunkelt, damit die Frage liest, wer nur kurz hinsieht.
  // Die Statusleiste liegt UEBER der Abdunklung — sie gehoert zum Geraet,
  // nicht zum Bild.
  `[0:v]scale=${B}:${H},eq=brightness=-0.10[bg];`
  + `[1:v]format=rgba,fade=t=in:st=0.15:d=0.3:alpha=1[k];`
  + `[bg][k]overlay=0:0[m];[m][2:v]overlay=0:0,fps=${FPS}[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  '-pix_fmt', 'yuv420p', join(TMP, 'hook.mp4'),
]);

// --- Abspann ----------------------------------------------------------------
console.log('Abspann bauen …');
await lauf([
  '-y', '-loop', '1', '-t', String(OUTRO_SEK), '-i', join(TMP, 'outro.png'),
  '-vf', `fps=${FPS},format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', join(TMP, 'outro.mp4'),
]);

// --- Gameplay vereinheitlichen ---------------------------------------------
await lauf([
  '-y', '-i', CLIP, '-loop', '1', '-i', join(TMP, 'status.png'),
  '-filter_complex', `[0:v]scale=${B}:${H}[g];[g][1:v]overlay=0:0:shortest=1,fps=${FPS}[v]`,
  '-map', '[v]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-an',
  join(TMP, 'spiel.mp4'),
]);

// --- Zusammenschneiden ------------------------------------------------------
const liste = join(TMP, 'liste.txt');
writeFileSync(liste, ['hook.mp4', 'spiel.mp4', 'outro.mp4']
  .map((f) => `file '${join(TMP, f)}'`).join('\n'));
await lauf(['-y', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', join(TMP, 'stumm.mp4')]);

// Gesamtlänge messen — ffprobe liegt diesem Container nicht bei.
const dauer = await new Promise((res) => {
  const p = spawn(FFMPEG, ['-hide_banner', '-i', join(TMP, 'stumm.mp4')]);
  let e = ''; p.stderr.on('data', (d) => { e += d; });
  p.on('close', () => {
    const m = e.match(/Duration: (\d+):(\d+):(\d+\.?\d*)/);
    res(m ? Number(m[2]) * 60 + Number(m[3]) : 0);
  });
});

// --- Ton --------------------------------------------------------------------
// Musikteppich leise, damit in der App noch ein Trending-Sound darüberpasst.
// Whoosh auf den Hook, Sting auf den Abspann.
console.log('Ton mischen …');
const sfx = (n) => join(ASSETS, 'sfx', `${n}.aac`);
const outroAb = Math.max(0, dauer - OUTRO_SEK);
await lauf([
  '-y', '-i', sfx('bett'), '-i', sfx('whoosh'), '-i', sfx('outro'),
  '-filter_complex',
  `[0:a]atrim=0:${dauer.toFixed(2)},volume=0.10[bed];`
  + `[1:a]adelay=100|100,volume=0.55[w];`
  + `[2:a]adelay=${Math.round(outroAb * 1000)}|${Math.round(outroAb * 1000)},volume=0.7[o];`
  + `[bed][w][o]amix=inputs=3:normalize=0:dropout_transition=0,`
  + `alimiter=limit=0.89:level=disabled,`
  + `afade=t=out:st=${Math.max(0, dauer - 1).toFixed(2)}:d=1.0[a]`,
  '-map', '[a]', '-t', dauer.toFixed(2), '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
  join(TMP, 'ton.m4a'),
]);

const ziel = join(OUT, 'mahjong-reel-01-spot-the-pair-EN.mp4');
await lauf([
  '-y', '-i', join(TMP, 'stumm.mp4'), '-i', join(TMP, 'ton.m4a'),
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest',
  '-movflags', '+faststart', ziel,
]);

rmSync(TMP, { recursive: true, force: true });
console.log(`\n✓ ${ziel}  (${(statSync(ziel).size / 1024 / 1024).toFixed(1)} MB, ${dauer.toFixed(1)} s)`);

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
import { spurRendern, melodie } from './synth.mjs';
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

// --musik aus|dezent|voll — damit sich Fassungen zum Vergleichen bauen lassen,
// ohne den Code anzufassen. `aus` ist der Stand vor dem 16.08.2026.
//
// ⚠ Warum der Teppich ueberhaupt so leise war: Er lag auf 0,10, „damit in der
// App noch ein Trending-Sound darueberpasst". Chart-Musik ist fuer ein
// gewerbliches Konto aber nicht lizenziert — der Sound kommt also nie, und die
// Reels liefen praktisch ohne Musik. Die eigene Melodie (synth.mjs) fuellt die
// Luecke und gehoert uns.
// Die Faktoren stehen auf gemessenen Einzelspuren: Spielklang −27,4 LUFS,
// Melodie −32,0 LUFS. Die Melodie sitzt damit von sich aus 4,6 dB unter den
// Steinen — ein stuetzender Teppich. `voll` hebt sie auf Augenhoehe.
//
// ⚠ Den GESAMTPEGEL des fertigen Reels nicht als Probe nehmen. Er aendert sich
// zwischen `aus` und `dezent` nur um 0,4 LUFS, und das verleitet zu dem
// Fehlschluss, die Melodie sei nicht da (genau darauf bin ich am 16.08.2026
// hereingefallen und habe die Stufen unnoetig hochgezogen). Integrated LUFS
// misst die Gesamtlautheit, und die bestimmen die Transienten der Steinklaenge
// und die Sieg-Fanfare — ein leiser Dauerton darunter bewegt sie kaum, egal wie
// deutlich er zu hoeren ist. Aussagekraeftig ist allein das VERHAELTNIS der
// einzeln gerenderten Spuren.
// Standard `voll` — von Josef am 16.08.2026 aus den drei Hoerproben gewaehlt.
const MUSIK = arg('musik', 'voll');
const PEGEL = { aus: { bett: 0.10, mel: 0 }, dezent: { bett: 0.24, mel: 1.0 }, voll: { bett: 0.34, mel: 1.8 } };
if (!PEGEL[MUSIK]) {
  console.error(`✗ unbekannte Musikstufe: ${MUSIK}\n  Bekannt: ${Object.keys(PEGEL).join(', ')}`);
  process.exit(1);
}

// Fortschrittsbalken oben. ⚠ Bewusst ein BALKEN und keine Zahl: Das Spiel
// zeigt die Paarzahl in der Kopfzeile bereits an, eine zweite Zahl waere
// Dopplung — und zwischen Brettunterkante (~y 1590) und Bedienleiste (~y 1670)
// sind nur rund 80 px frei, zu wenig fuer etwas Lesbares. Der Balken liegt in
// der Luecke zwischen Statusleiste und Kopfzeile und kostet keine Brettflaeche.
const BALKEN_Y = 128, BALKEN_H = 12;

if (!FORMATE[FORMAT]) {
  console.error(`✗ unbekanntes Format: ${FORMAT}\n  Bekannt: ${Object.keys(FORMATE).join(', ')}`);
  process.exit(1);
}
// --- Vorspann ---------------------------------------------------------------
// Kurze Filmszene vor dem Spiel (Junge und Sensei im Tempel, mit kie.ai
// erzeugt, Modell veo3_lite, 9:16).
//
// ⚠ Der Vorspann ERSETZT das eingefrorene Standbild hinter der Hook-Karte,
// er kommt NICHT zusaetzlich davor. Sonst kostete er 2–3 Sekunden genau dort,
// wo im Feed entschieden wird, ob jemand bleibt. So kostet er nichts: Statt
// eines Standbilds liegt bewegtes Material unter demselben Text.
//
// ⚠ Und er traegt KEINE Statusleiste. Der Rest des Reels gibt sich als
// Handy-Aufnahme; der Vorspann ist bewusst Film. Der Schnitt auf das Geraet
// ist damit ein Bruch mit Absicht — und die Steine des Sensei gehen in das
// Brett der App ueber, was die Bruecke zwischen Film und Spiel schlaegt.
//
// --vorspann aus   schaltet ihn ab
// --vorspann <datei>  waehlt eine andere Szene
const VORSPANN_STD = join(ASSETS, 'vorspann', 'sensei-spiel.mp4');
const VORSPANN_ARG = arg('vorspann', null);
const VORSPANN = VORSPANN_ARG === 'aus' ? null
  : (VORSPANN_ARG ? join(WURZEL, VORSPANN_ARG)
    : (existsSync(VORSPANN_STD) ? VORSPANN_STD : null));
const VORSPANN_SEK = 2.4;   // laenger als eine Hook-Karte: bewegtes Bild will gesehen werden

if (VORSPANN_ARG && VORSPANN_ARG !== 'aus' && !existsSync(VORSPANN)) {
  console.error(`✗ Vorspann nicht gefunden: ${VORSPANN}`);
  process.exit(1);
}

// Der Vorspann bestimmt die Laenge des ersten Abschnitts — alle Zeitrechnungen
// unten haengen an HOOK_SEK und ziehen damit von selbst nach.
const HOOK_SEK = VORSPANN ? VORSPANN_SEK : FORMATE[FORMAT].hookSek;
const OUTRO_SEK = 4.2;

// Ueberblendzeiten. Der Hartschnitt war der Grund, warum das Reel am Ende
// „abgehackt" wirkte: Das halb geraeumte Brett verschwand von einem Bild aufs
// naechste hinter dem deckenden Abspann. Die Blende zum Abspann ist bewusst
// laenger als die zum Spiel — dort endet etwas, hier faengt nur etwas an.
const BLENDE_SPIEL = 0.35;
const BLENDE_ABSPANN = 0.55;

// Beim Format `fakt` traegt die Unterzeile den Fakt selbst — deshalb wird er
// hier schon geladen, er bestimmt den Text der Eingangskarte.
const FAKT = FORMAT === 'fakt' ? fakten()[FAKT_NR % fakten().length] : null;

// Beipackzettel der Aufnahme: Klickzeiten, Siegzeitpunkt, Paarzahl. Wird frueh
// geladen, weil sowohl der Fortschrittsbalken (Bild) als auch Melodie und
// Steinklaenge (Ton) daraus entstehen.
let beiblatt = {};
try { beiblatt = JSON.parse(readFileSync(CLIP.replace(/\.mp4$/, '.json'), 'utf8')); } catch { /* optional */ }
const TREFFER = (beiblatt.klicks ?? []).filter((k) => k.art === 'match');

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
    `<div style="position:absolute;left:0;top:900px;width:${B}px;height:720px;
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

  // Fortschrittsbalken: zwei Bilder, Spur und Fuellung.
  //
  // ⚠ Zwei Sackgassen liegen hinter dieser Loesung, beide am ffmpeg-Build:
  // (1) `drawtext` gibt es hier gar nicht (`-filters` listet ihn nicht, trotz
  //     libfreetype) — eine Zahl per Filter einzublenden ist also unmoeglich.
  // (2) `crop` kennt in diesem Build kein `eval`, seine Position steht damit
  //     ab Start fest. Ein Streifen mit einer Zeile je Stand, aus dem man die
  //     passende herausschneidet, faellt deshalb aus.
  // `overlay` wertet seine Position dagegen pro Bild aus (`eval` steht auf
  // `frame`). Darum faehrt die volle Leiste von links herein und wird vom
  // Bildrand beschnitten — sichtbar waechst sie damit von 0 auf vollen Balken.
  if (TREFFER.length >= 2) {
    await page.setViewportSize({ width: B, height: BALKEN_H });
    await schuss(
      `<div style="position:absolute;inset:0;background:rgba(255,255,255,.16)"></div>`,
      join(TMP, 'balken-spur.png'));
    await schuss(
      `<div style="position:absolute;inset:0;background:linear-gradient(90deg,#e8cf86,#f5b301)"></div>`,
      join(TMP, 'balken-fuell.png'));
  }

  await browser.close();
}

console.log('Karten rendern …');
await karten();

// --- Hook: erstes Bild der Aufnahme einfrieren, Karte darüber ---------------
console.log('Hook bauen …');
if (VORSPANN) {
  // Filmszene als Untergrund. Der Ton der Szene wird verworfen (`-an`) — die
  // gesamte Tonspur des Reels entsteht weiter unten aus einem Guss.
  console.log(`  Vorspann: ${VORSPANN.split('/').pop()}`);
  await lauf([
    '-y', '-t', String(VORSPANN_SEK), '-i', VORSPANN,
    '-loop', '1', '-t', String(VORSPANN_SEK), '-i', join(TMP, 'hook.png'),
    '-filter_complex',
    // `increase` + Beschnitt statt Verzerren: Die Szene ist 720×1280, also
    // dasselbe Seitenverhaeltnis — der Beschnitt ist ein Sicherheitsnetz,
    // falls je eine Szene mit anderem Format dazukommt.
    `[0:v]scale=${B}:${H}:force_original_aspect_ratio=increase,crop=${B}:${H},`
    + `eq=brightness=-0.10[bg];`
    + `[1:v]format=rgba,fade=t=in:st=0.35:d=0.4:alpha=1[k];`
    + `[bg][k]overlay=0:0,fps=${FPS}[v]`,
    '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    '-pix_fmt', 'yuv420p', join(TMP, 'hook.mp4'),
  ]);
} else {
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
}

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
// Bewusst `xfade` statt des concat-Demuxers: concat kann nur stumpf
// aneinanderhaengen, und genau das war zu sehen. `xfade` kostet ein
// Neukodieren, dafuer geht das abgedunkelte Hook-Standbild weich ins helle
// Spiel ueber (sonst springt die Helligkeit) und das Brett loest sich in den
// Abspann auf, statt von ihm verdeckt zu werden.
console.log('Blenden setzen …');
const spielDauer = await dauerVon(join(TMP, 'spiel.mp4'));
const versatz1 = HOOK_SEK - BLENDE_SPIEL;
const zwischen = HOOK_SEK + spielDauer - BLENDE_SPIEL;   // Laenge nach der ersten Blende
const versatz2 = zwischen - BLENDE_ABSPANN;
const dauer = zwischen + OUTRO_SEK - BLENDE_ABSPANN;

const spielAb = HOOK_SEK - BLENDE_SPIEL;          // dort beginnt das Gameplay
const spielBis = Math.max(0, dauer - OUTRO_SEK);  // dort beginnt der Abspann
const balkenDa = existsSync(join(TMP, 'balken-fuell.png'));

// Anteil geraeumter Paare als Ausdruck ueber die Zeit: Die Summe der
// erfuellten `gte(t,…)` ist genau die Zahl der bis dahin geraeumten Paare.
// Die Fuellung sitzt bei x = B*(anteil-1), ragt also anfangs komplett links
// aus dem Bild und schiebt sich mit jedem Paar weiter herein.
const anteil = `(${TREFFER.map((k) => `gte(t,${(spielAb + k.t).toFixed(3)})`).join('+')})/${TREFFER.length}`;
const nurSpiel = `enable='between(t,${spielAb.toFixed(2)},${spielBis.toFixed(2)})'`;

await lauf([
  '-y', '-i', join(TMP, 'hook.mp4'), '-i', join(TMP, 'spiel.mp4'), '-i', join(TMP, 'outro.mp4'),
  // ⚠ `-loop 1` ist noetig, damit die Standbilder eine Zeitachse bekommen.
  // Ohne das liegen sie bei t=0 fest und der Ausdruck ergaebe immer 0.
  ...(balkenDa ? [
    '-loop', '1', '-t', dauer.toFixed(2), '-i', join(TMP, 'balken-spur.png'),
    '-loop', '1', '-t', dauer.toFixed(2), '-i', join(TMP, 'balken-fuell.png'),
  ] : []),
  '-filter_complex',
  `[0:v][1:v]xfade=transition=fade:duration=${BLENDE_SPIEL}:offset=${versatz1.toFixed(3)}[a];`
  // `fadeblack` statt `fade`: Sieg-Karte und Abspann tragen beide viel Text an
  // aehnlicher Stelle — eine direkte Kreuzblende legt sie uebereinander und
  // beides wird unleserlich. Der kurze Weg ueber Schwarz liest sich als
  // gewollter Schnitt.
  + `[a][2:v]xfade=transition=fadeblack:duration=${BLENDE_ABSPANN}:offset=${versatz2.toFixed(3)}[b];`
  + (balkenDa
    ? `[b][3:v]overlay=0:${BALKEN_Y}:${nurSpiel}[sp];`
      + `[sp][4:v]overlay=x='${B}*(${anteil}-1)':y=${BALKEN_Y}:${nurSpiel},`
    : `[b]`)
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
const versatzSpiel = HOOK_SEK - BLENDE_SPIEL;   // dort beginnt das Gameplay im fertigen Reel

const ereignisse = (beiblatt.klicks ?? [])
  .map((k) => ({ t: versatzSpiel + k.t, klang: k.art }));
if (beiblatt.siegBei != null) {
  ereignisse.push({ t: versatzSpiel + beiblatt.siegBei, klang: 'win', vol: 1.25 });
}

const spuren = [
  // Teppich-Pegel je Stufe (--musik). Die Einblende nimmt ihm den Anfangs-Knacks.
  `[0:a]atrim=0:${dauer.toFixed(2)},volume=${PEGEL[MUSIK].bett},afade=t=in:st=0:d=1.0[bed]`,
  `[1:a]adelay=100|100,volume=0.55[w]`,
  `[2:a]adelay=${ms(outroAb)}|${ms(outroAb)},volume=0.7[o]`,
];
const namen = ['[bed]', '[w]', '[o]'];
const eingaben = ['-i', sfx('bett'), '-i', sfx('whoosh'), '-i', sfx('outro')];

if (ereignisse.length) {
  const spielSpur = join(TMP, 'spielklang.wav');
  spurRendern(ereignisse, dauer + 1.5, spielSpur);
  eingaben.push('-i', spielSpur);
  spuren.push(`[${namen.length}:a]volume=1.0[spiel]`);
  namen.push('[spiel]');
  console.log(`  ${beiblatt.klicks.length} Steinklaenge${beiblatt.siegBei != null ? ' + Sieg' : ''}`);
} else {
  console.log('  ⚠ keine Klickzeiten im Beipackzettel — Reel bleibt ohne Spielklang');
}

// Eigene Melodie auf den ECHTEN Zugzeiten. Das Spiel zieht von 820 ms auf
// 280 ms je Zug an (record-solitaire.mjs); sitzt die Musik auf denselben
// Zeitpunkten, beschleunigt sie von selbst mit. Ein eigenes Metrum wuerde
// dagegen gegen das Bild laufen — und genau das faellt auf.
if (PEGEL[MUSIK].mel > 0 && TREFFER.length >= 2) {
  const mel = melodie(
    TREFFER.map((k) => ({ ...k, t: versatzSpiel + k.t })),
    beiblatt.siegBei != null ? versatzSpiel + beiblatt.siegBei : null,
  );
  const melSpur = join(TMP, 'melodie.wav');
  spurRendern(mel, dauer + 2.0, melSpur);
  eingaben.push('-i', melSpur);
  spuren.push(`[${namen.length}:a]volume=${PEGEL[MUSIK].mel.toFixed(2)}[mel]`);
  namen.push('[mel]');
  console.log(`  Melodie: ${mel.length} Toene, Stufe „${MUSIK}“`);
} else if (PEGEL[MUSIK].mel === 0) {
  console.log('  Melodie: aus');
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

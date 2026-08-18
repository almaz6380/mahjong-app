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
import { VORSPAENNE } from './vorspaenne.mjs';

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

// --- Vorspann ---------------------------------------------------------------
// Nahaufnahme aus einem kie.ai-Clip: eine Hand legt einen Mahjong-Stein ab und
// zieht sich zurueck. Danach blendet das Bild auf das Spielbrett.
//
// ⚠ Warum das hier funktioniert, waehrend der erste Anlauf mit den Tempel-Szenen
// gescheitert ist: Damals lag die Hook-Karte UEBER einer Filmszene, zu der sie
// nichts sagte, und Film und flache App-Oberflaeche haben kein gemeinsames
// Motiv — eine Blende dazwischen verlangsamt denselben Bruch nur. Hier laeuft
// der Vorspann VOR der Hook-Karte, und beide Seiten zeigen dasselbe: Mahjong-
// Steine, formatfuellend. Das ist ein Match-Cut.
//
// ⚠ Die Zeiten sind AUSGEMESSEN, nicht geschaetzt — deshalb liegt in
// `vorspaenne.mjs` eine TABELLE und nicht ein Dateiname. Ein Clip ohne Eintrag
// laesst sich nicht verwenden, und genau das ist der Zweck: Ein frueherer
// Schnitt bei 2,4 s riss mitten in die Bewegung („der Uebergang ist zu
// schnell"), weil er geraten war. Messen mit `messe-vorspann.mjs`.
const VORSPANN_BLENDE = 0.6;
const VORSPANN_NAME = arg('vorspann', 'steine-legen');
const VORSPANN = VORSPANN_NAME === 'aus' ? null : VORSPAENNE[VORSPANN_NAME];
if (VORSPANN_NAME !== 'aus' && !VORSPANN) {
  console.error(`✗ unbekannter Vorspann: ${VORSPANN_NAME}\n`
    + `  Bekannt: ${Object.keys(VORSPAENNE).join(', ')}, aus\n`
    + `  Ein neuer Clip braucht erst seinen gemessenen Schnittpunkt in VORSPAENNE.`);
  process.exit(1);
}
const VORSPANN_DATEI = VORSPANN ? join(ASSETS, 'vorspann', `${VORSPANN_NAME}.mp4`) : null;
if (VORSPANN && !existsSync(VORSPANN_DATEI)) {
  console.error(`✗ Vorspann-Clip fehlt: ${VORSPANN_DATEI}`);
  process.exit(1);
}

// ⚠ DIE Stelle, an der dieser Umbau schiefgehen kann. Der Ton der Reels sitzt
// auf mitgeschriebenen Klickzeiten aus dem Beipackzettel; ein Vorspann schiebt
// die gesamte Zeitachse nach hinten. Deshalb gibt es genau EINE Konstante
// dafuer, und sie wird ueberall addiert — Blenden, Balken, Steinklaenge,
// Melodie, Whoosh. Ein zweiter Rechenweg driftet frueher oder spaeter, und
// zwar so, dass es beim fluechtigen Ansehen kaum auffaellt.
const VOR_VERSATZ = VORSPANN ? VORSPANN.sek - VORSPANN_BLENDE : 0;

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
const HOOK_SEK = FORMATE[FORMAT].hookSek;
const OUTRO_SEK = 4.2;

// ⚠ `hookSek` sagt, wie lange die Frage STEHT — die Blendzeit gehoert oben
// drauf, nicht abgezogen. Das war beim Einbau des Vorspanns falsch: Die Karte
// behielt ihre 1,3 s, von denen nun 0,6 s Einblende und 0,35 s Ausblende
// abgingen. Sie stand damit noch 0,35 s statt 0,95 s, und der Text blendete
// mitten in der Kreuzblende ein — Film, Brett und Schrift lagen gleichzeitig
// uebereinander, dann war es vorbei. Genau das hat Josef als „abrupt" gesehen.
// Der Wert in FORMATE ist fuer eine Karte OHNE eingehende Blende bemessen
// („1,9 s waren zu lang"); mit Vorspann muss die Blende dazukommen.
const HOOK_LANG = HOOK_SEK + (VORSPANN ? VORSPANN_BLENDE : 0);

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
await lauf(['-y', '-i', CLIP, '-frames:v', '1', join(TMP, 'standbild.png')]);
await lauf([
  '-y', '-loop', '1', '-t', String(HOOK_LANG), '-i', join(TMP, 'standbild.png'),
  '-loop', '1', '-t', String(HOOK_LANG), '-i', join(TMP, 'hook.png'),
  '-loop', '1', '-t', String(HOOK_LANG), '-i', join(TMP, 'status.png'),
  '-filter_complex',
  // Das Brett wird abgedunkelt, damit die Frage liest, wer nur kurz hinsieht.
  // Die Statusleiste liegt UEBER der Abdunklung — sie gehoert zum Geraet,
  // nicht zum Bild.
  `[0:v]scale=${B}:${H},eq=brightness=-0.10[bg];`
  // ⚠ Der Text erscheint NACH der Blende, nicht darin. Sonst sieht man Film,
  // Brett und Schrift gleichzeitig — ein Brei, der sich schlagartig aufloest.
  // So entsteht ein Zweitakt: erst wechselt das Material, dann kommt die Frage.
  + `[1:v]format=rgba,fade=t=in:st=${(VOR_VERSATZ ? VORSPANN_BLENDE + 0.15 : 0.15).toFixed(2)}:d=0.3:alpha=1[k];`
  + `[bg][k]overlay=0:0[m];[m][2:v]overlay=0:0,fps=${FPS}[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  '-pix_fmt', 'yuv420p', join(TMP, 'hook.mp4'),
]);

// --- Vorspann-Segment -------------------------------------------------------
// Bild und Ton getrennt: Das Bild geht per `xfade` in die Videokette, der Ton
// als eigener Eingang in die Mischung — sonst muesste die Tonspur durch
// dieselbe Blende und wuerde dort mitverrechnet.
//
// ⚠ Kein `zoompan`. Der Clip bringt seine eigene, sehr ruhige Bewegung mit;
// eine zusaetzliche Fahrt darueber hat den Einstieg hastig wirken lassen.
if (VORSPANN) {
  console.log(`Vorspann schneiden … (${VORSPANN_NAME}, ${VORSPANN.ab}–${(VORSPANN.ab + VORSPANN.sek).toFixed(1)} s)`);
  const schnitt = ['-ss', String(VORSPANN.ab), '-t', String(VORSPANN.sek), '-i', VORSPANN_DATEI];
  await lauf([
    '-y', ...schnitt,
    '-vf', `scale=${B}:${H}:force_original_aspect_ratio=increase,crop=${B}:${H},fps=${FPS}`,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
    join(TMP, 'vorspann.mp4'),
  ]);
  await lauf([
    '-y', ...schnitt,
    '-vn', '-af', `afade=t=in:st=0:d=0.3,afade=t=out:st=${(VORSPANN.sek - 0.6).toFixed(2)}:d=0.6`,
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', join(TMP, 'vorspann.m4a'),
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
// ⚠ Jede dieser Zeiten traegt `VOR_VERSATZ`. Ohne Vorspann ist er 0 und die
// Rechnung ist Zeile fuer Zeile die alte.
const versatz1 = VOR_VERSATZ + HOOK_LANG - BLENDE_SPIEL;
const zwischen = VOR_VERSATZ + HOOK_LANG + spielDauer - BLENDE_SPIEL;   // Laenge nach der ersten Blende
const versatz2 = zwischen - BLENDE_ABSPANN;
const dauer = zwischen + OUTRO_SEK - BLENDE_ABSPANN;

const spielAb = VOR_VERSATZ + HOOK_LANG - BLENDE_SPIEL;   // dort beginnt das Gameplay
const spielBis = Math.max(0, dauer - OUTRO_SEK);         // dort beginnt der Abspann
const balkenDa = existsSync(join(TMP, 'balken-fuell.png'));

// Anteil geraeumter Paare als Ausdruck ueber die Zeit: Die Summe der
// erfuellten `gte(t,…)` ist genau die Zahl der bis dahin geraeumten Paare.
// Die Fuellung sitzt bei x = B*(anteil-1), ragt also anfangs komplett links
// aus dem Bild und schiebt sich mit jedem Paar weiter herein.
const anteil = `(${TREFFER.map((k) => `gte(t,${(spielAb + k.t).toFixed(3)})`).join('+')})/${TREFFER.length}`;
const nurSpiel = `enable='between(t,${spielAb.toFixed(2)},${spielBis.toFixed(2)})'`;

// ⚠ Die Eingangsnummern standen hier frueher fest im Filterstring ([0:v] …
// [4:v]). Sobald ein Eingang dazukommt — und der Vorspann ist genau das —
// verschiebt sich alles dahinter, und der Balken-Overlay zeigt auf den
// falschen Eingang. Das sieht dann nach einem ffmpeg-Fehler aus und ist
// keiner. Deshalb vergibt `nimm()` die Nummern und der Filterstring liest sie
// aus Variablen.
let nr = 0;
const eingang = [];
const nimm = (...args) => { eingang.push(...args); return nr++; };   // genau EIN -i je Aufruf

const iVor = VORSPANN ? nimm('-i', join(TMP, 'vorspann.mp4')) : null;
const iHook = nimm('-i', join(TMP, 'hook.mp4'));
const iSpiel = nimm('-i', join(TMP, 'spiel.mp4'));
const iOutro = nimm('-i', join(TMP, 'outro.mp4'));
// ⚠ `-loop 1` ist noetig, damit die Standbilder eine Zeitachse bekommen.
// Ohne das liegen sie bei t=0 fest und der Ausdruck ergaebe immer 0.
const iSpur = balkenDa
  ? nimm('-loop', '1', '-t', dauer.toFixed(2), '-i', join(TMP, 'balken-spur.png')) : null;
const iFuell = balkenDa
  ? nimm('-loop', '1', '-t', dauer.toFixed(2), '-i', join(TMP, 'balken-fuell.png')) : null;

// ⚠ `settb=AVTB` auf alle Segmente: Die Zeitbasen der Eingaenge muessen fuer
// `xfade` uebereinstimmen, sonst bricht der Graph mit „do not match … Failed to
// configure output pad" ab. Bei gleich erzeugten Dateien geht es auch ohne —
// aber sobald ein fremd kodierter Clip dazukommt, nicht mehr.
const tb = (i, aus) => `[${i}:v]settb=AVTB[${aus}]`;
const ketten = [tb(iHook, 'kh'), tb(iSpiel, 'ks'), tb(iOutro, 'ko')];
let vorn = '[kh]';
if (VORSPANN) {
  ketten.push(tb(iVor, 'kv'));
  // Der Uebergang kommt aus der Tabelle und setzt die Bewegung des Clips fort
  // (Turm waechst → smoothup, Haende wischen quer → smoothleft). Nicht
  // Abwechslung um ihrer selbst willen: Ein richtungsloser Uebergang nach einer
  // gerichteten Bewegung laesst den Schnitt stehen statt ihn zu tragen.
  ketten.push(`[kv][kh]xfade=transition=${VORSPANN.blende ?? 'fade'}:duration=${VORSPANN_BLENDE}`
    + `:offset=${VOR_VERSATZ.toFixed(3)}[e]`);
  vorn = '[e]';
}
ketten.push(`${vorn}[ks]xfade=transition=fade:duration=${BLENDE_SPIEL}:offset=${versatz1.toFixed(3)}[a]`);
// `fadeblack` statt `fade`: Sieg-Karte und Abspann tragen beide viel Text an
// aehnlicher Stelle — eine direkte Kreuzblende legt sie uebereinander und
// beides wird unleserlich. Der kurze Weg ueber Schwarz liest sich als
// gewollter Schnitt.
ketten.push(`[a][ko]xfade=transition=fadeblack:duration=${BLENDE_ABSPANN}:offset=${versatz2.toFixed(3)}[b]`);
ketten.push(balkenDa
  ? `[b][${iSpur}:v]overlay=0:${BALKEN_Y}:${nurSpiel}[sp];`
    + `[sp][${iFuell}:v]overlay=x='${B}*(${anteil}-1)':y=${BALKEN_Y}:${nurSpiel},`
    + `format=yuv420p,fps=${FPS}[v]`
  : `[b]format=yuv420p,fps=${FPS}[v]`);

await lauf([
  '-y', ...eingang,
  '-filter_complex', ketten.join(';'),
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
const versatzSpiel = spielAb;   // dort beginnt das Gameplay im fertigen Reel (traegt VOR_VERSATZ)

const ereignisse = (beiblatt.klicks ?? [])
  .map((k) => ({ t: versatzSpiel + k.t, klang: k.art }));
if (beiblatt.siegBei != null) {
  ereignisse.push({ t: versatzSpiel + beiblatt.siegBei, klang: 'win', vol: 1.25 });
}

const spuren = [
  // Teppich-Pegel je Stufe (--musik). Die Einblende nimmt ihm den Anfangs-Knacks.
  `[0:a]atrim=0:${dauer.toFixed(2)},volume=${PEGEL[MUSIK].bett},afade=t=in:st=0:d=1.0[bed]`,
  // ⚠ Der Whoosh gehoert zur HOOK-Karte, nicht zum Vorspann — er sass frueher
  // fest bei 100 ms. Mit Vorspann laege er sonst mitten im Ablegen des Steins
  // und kuendigte etwas an, das erst vier Sekunden spaeter kommt.
  `[1:a]adelay=${ms(VOR_VERSATZ + 0.1)}|${ms(VOR_VERSATZ + 0.1)},volume=0.55[w]`,
  `[2:a]adelay=${ms(outroAb)}|${ms(outroAb)},volume=0.7[o]`,
];
const namen = ['[bed]', '[w]', '[o]'];
const eingaben = ['-i', sfx('bett'), '-i', sfx('whoosh'), '-i', sfx('outro')];

// Der Originalton des Vorspanns — das Aufsetzen des Steins auf dem Holz. Er
// ist der Grund, warum der Einstieg nicht wie ein stummes Vorspiel wirkt.
// Leicht abgesenkt, damit der Whoosh der Hook-Karte danach die Fuehrung hat.
if (VORSPANN) {
  eingaben.push('-i', join(TMP, 'vorspann.m4a'));
  spuren.push(`[${namen.length}:a]volume=0.85[vor]`);
  namen.push('[vor]');
}

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

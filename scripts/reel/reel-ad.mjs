#!/usr/bin/env node
// Werbeschnitte fuer eine Google-App-Kampagne (Installationen, Android).
//
//   node scripts/reel/reel-ad.mjs               # beide Schnitte, beide Formate
//   node scripts/reel/reel-ad.mjs --nur loop
//
// ⚠ EINE ANZEIGE IST KEIN REEL. Der Unterschied ist nicht Geschmack, sondern
// bezahlte Zeit:
//
// (1) SPIEL AB BILD 1. Unsere Reels beginnen mit Hook-Karte oder Vorspann —
//     im Feed ist das Atmosphaere, in einer Anzeige sind es gekaufte Sekunden
//     ohne Produkt. Hier gibt es keine Eingangskarte, und der Pruefschritt
//     unten sieht sich das erste Bild an.
// (2) KEINE STATUSLEISTE. Die Kampagne bewirbt die ANDROID-App; die
//     nachgebaute iOS-Leiste aus make-reel.mjs waere ein Widerspruch im Bild.
//     Das Rohmaterial hat sie nicht — sie wird erst dort aufgelegt. Also
//     einfach nicht auflegen.
// (3) ZWEI SCHNITTE, NICHT EINER. Google-App-Kampagnen nehmen mehrere Videos
//     und verteilen selbst. Man liefert Ansaetze, keine Endfassung.
// (4) DEUTSCHES MATERIAL. Die Kampagne laeuft in DE/AT — eine englische
//     Bedienleiste im Bild ist ein Bruch, den man nicht sieht, wenn man die
//     Aufnahme nur „als Mahjong" liest. Aufgenommen mit `--lang de`.

import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lauf, dauerVon } from './ffmpeg.mjs';
import { mitBrowser, abspannKarte } from './karten.mjs';
import { spurRendern, melodie } from './synth.mjs';
import { captionText } from './formate.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');
const ASSETS = join(HIER, 'assets');
const FPS = 30;
const B = 1080, H = 1920;

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const OUT = join(WURZEL, arg('out', 'out/reels/ad'));
const NUR = arg('nur', null);
const TMP = join(OUT, '.bau');

const ABSPANN_SEK = 2.5;      // kurz — die Kampagne liefert eigene Texte
const BLENDE = 0.5;
const NACH_SIEG = 0.9;        // wie lange die Sieg-Karte noch steht

// Die beiden Ansaetze. Sie testen VERSCHIEDENE Verkaufsachsen gegeneinander,
// nicht zwei Fassungen derselben Idee — sonst lernt die Kampagne nichts.
const SCHNITTE = {
  // Die Kernschleife: antippen, Paar verschwindet, Brett leert sich, Sieg.
  // Nach zwei Sekunden weiss der Zuschauer, was er tut, wenn er installiert.
  loop: {
    art: 'spiel',
    quelle: 'out/reels/mahjong-solitaire-lvl25-de.mp4',
  },
  // Der Umfang: 29 Bretter im Takt. Testet die andere Achse — nicht „was tue
  // ich", sondern „wie viel ist da".
  vielfalt: {
    art: 'bretter',
    quelle: 'out/reels/figuren-de',
    erstSek: 0.52,
    letztSek: 0.24,
  },
};

// ⚠ 1:1 wird EINGEPASST, nicht auf das Brett beschnitten. Die grossen Bretter
// (bis 174 Steine) reichen von y≈340 bis y≈1580 — 1240 px, mehr als ein
// 1080er Quadrat fasst. Ein Quadrat-Ausschnitt saegte also oben und unten in
// die Figur.
//
// ⚠ ABER: Das ganze Hochformat einzupassen macht das Brett winzig (607 px
// breit in einem 1080er Quadrat, also gut ein Drittel der Flaeche ungenutzt
// neben unscharfem Hintergrund). In einer bezahlten Anzeige ist das teuer —
// das Produkt soll gross sein. Deshalb faellt vorher weg, was NICHTS verkauft:
// Kopfzeile und Bedienleiste. Uebrig bleibt das Brettfenster, und das fuellt
// das Quadrat deutlich besser.
const FENSTER_Y = 300, FENSTER_H = 1360;   // Brettbereich im 1080x1920-Bild

const FORMATE_AD = {
  '9x16': { b: 1080, h: 1920 },
  '1x1': { b: 1080, h: 1080 },
};

if (NUR && !SCHNITTE[NUR]) {
  console.error(`✗ unbekannter Schnitt: ${NUR}\n  Bekannt: ${Object.keys(SCHNITTE).join(', ')}`);
  process.exit(1);
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

console.log('Abspann rendern …');
await mitBrowser(async (schuss) => {
  await abspannKarte(schuss, join(TMP, 'abspann.png'));
});
await lauf(['-y', '-loop', '1', '-t', String(ABSPANN_SEK), '-i', join(TMP, 'abspann.png'),
  '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  join(TMP, 'abspann.mp4')]);

/** Der Spiel-Schnitt: Rohaufnahme bis kurz nach dem Sieg, ohne Statusleiste. */
async function bauSpiel(name, s) {
  const clip = join(WURZEL, s.quelle);
  if (!existsSync(clip)) throw new Error(`Aufnahme fehlt: ${clip}`);
  const zettel = JSON.parse(readFileSync(clip.replace(/\.mp4$/, '.json'), 'utf8'));
  if (zettel.siegBei == null) throw new Error(`${name}: Aufnahme ohne Siegzeitpunkt`);
  const spielSek = zettel.siegBei + NACH_SIEG;

  await lauf(['-y', '-t', spielSek.toFixed(3), '-i', clip,
    '-vf', `scale=${B}:${H},fps=${FPS},format=yuv420p`,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    join(TMP, `${name}-roh.mp4`)]);

  // Ton aus den mitgeschriebenen Klickzeiten — dieselbe Technik wie im Reel.
  const treffer = zettel.klicks.filter((k) => k.art === 'match');
  return { spielSek, treffer, siegBei: zettel.siegBei, level: zettel.level, paare: zettel.paare };
}

/** Der Brett-Schnitt: Standbilder im anziehenden Takt, harte Schnitte. */
async function bauBretter(name, s) {
  const zettel = join(WURZEL, s.quelle, 'figuren.json');
  if (!existsSync(zettel)) throw new Error(`Bretter fehlen: ${zettel}`);
  const bretter = JSON.parse(readFileSync(zettel, 'utf8'));
  if (bretter.length < 8) throw new Error(`nur ${bretter.length} Bretter`);

  const dauern = bretter.map((_, i) =>
    s.erstSek + (s.letztSek - s.erstSek) * (i / Math.max(1, bretter.length - 1)));
  for (const [i, b] of bretter.entries()) {
    await lauf(['-y', '-loop', '1', '-t', dauern[i].toFixed(3), '-i', b.datei,
      '-vf', `scale=${B}:${H},fps=${FPS},format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
      join(TMP, `${name}-m${String(i).padStart(2, '0')}.mp4`)]);
  }
  const liste = join(TMP, `${name}-liste.txt`);
  writeFileSync(liste, bretter.map((_, i) =>
    `file '${join(TMP, `${name}-m${String(i).padStart(2, '0')}.mp4`)}'`).join('\n') + '\n');
  await lauf(['-y', '-f', 'concat', '-safe', '0', '-i', liste,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', join(TMP, `${name}-roh.mp4`)]);

  // Ein Steinklang je Brettwechsel — die Zeiten sind dieselben wie im Bild.
  let t = 0;
  const treffer = dauern.map((d) => { const at = t; t += d; return { t: at, art: 'match' }; });
  return { spielSek: await dauerVon(join(TMP, `${name}-roh.mp4`)), treffer, siegBei: null,
    level: bretter.length, paare: '-' };
}

for (const [name, s] of Object.entries(NUR ? { [NUR]: SCHNITTE[NUR] } : SCHNITTE)) {
  console.log(`\n${name} …`);
  const info = s.art === 'spiel' ? await bauSpiel(name, s) : await bauBretter(name, s);

  // --- Bild: Spiel + Abspann ---
  const abspannAb = info.spielSek - BLENDE;
  const dauer = abspannAb + ABSPANN_SEK;
  await lauf(['-y', '-i', join(TMP, `${name}-roh.mp4`), '-i', join(TMP, 'abspann.mp4'),
    '-filter_complex',
    `[0:v]settb=AVTB[a];[1:v]settb=AVTB[b];`
    + `[a][b]xfade=transition=fade:duration=${BLENDE}:offset=${abspannAb.toFixed(3)},`
    + `fps=${FPS},format=yuv420p[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    join(TMP, `${name}-stumm.mp4`)]);

  // --- Ton ---
  const sfx = (n) => join(ASSETS, 'sfx', `${n}.aac`);
  const ms = (x) => Math.round(Math.max(0, x) * 1000);
  const ereignisse = info.treffer.map((k) => ({ t: k.t, klang: 'match' }));
  if (info.siegBei != null) ereignisse.push({ t: info.siegBei, klang: 'win', vol: 1.15 });
  const spur = join(TMP, `${name}-takt.wav`);
  spurRendern(ereignisse.concat(melodie(info.treffer, info.siegBei)), dauer + 1, spur);

  await lauf(['-y', '-i', sfx('bett'), '-i', sfx('outro'), '-i', spur,
    '-filter_complex',
    `[0:a]atrim=0:${dauer.toFixed(2)},volume=0.32,afade=t=in:st=0:d=0.6[bed];`
    + `[1:a]adelay=${ms(abspannAb)}|${ms(abspannAb)},volume=0.7[o];`
    + `[2:a]volume=1.1[takt];`
    + `[bed][o][takt]amix=inputs=3:normalize=0:dropout_transition=0,`
    + `alimiter=limit=0.89:level=disabled,`
    + `afade=t=out:st=${Math.max(0, dauer - 1.2).toFixed(2)}:d=1.2[a]`,
    '-map', '[a]', '-t', dauer.toFixed(2), '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    join(TMP, `${name}-ton.m4a`)]);

  // --- Beide Formate ---
  for (const [fname, f] of Object.entries(FORMATE_AD)) {
    const ziel = join(OUT, `mahjong-ad-${name}-${fname}.mp4`);
    const vf = fname === '9x16'
      ? `scale=${f.b}:${f.h},fps=${FPS},format=yuv420p`
      // Einpassen statt beschneiden, unscharfe Kopie als Hintergrund.
      : `split=2[gross][klein];`
        + `[gross]scale=${f.b}:${f.h}:force_original_aspect_ratio=increase,`
        + `crop=${f.b}:${f.h},gblur=sigma=28[bg];`
        + `[klein]crop=${B}:${FENSTER_H}:0:${FENSTER_Y},`
        + `scale=${f.b}:${f.h}:force_original_aspect_ratio=decrease[fg];`
        + `[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=${FPS},format=yuv420p`;
    await lauf(['-y', '-i', join(TMP, `${name}-stumm.mp4`), '-i', join(TMP, `${name}-ton.m4a`),
      '-filter_complex', `[0:v]${vf}[v]`,
      '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
      '-c:a', 'copy', '-shortest', '-movflags', '+faststart', ziel]);
    console.log(`  ✓ ${ziel}  (${(await dauerVon(ziel)).toFixed(1)} s, ${f.b}x${f.h})`);
  }

  writeFileSync(join(OUT, `mahjong-ad-${name}.txt`), captionText('ad', {
    datei: `mahjong-ad-${name}-9x16.mp4`, level: info.level, paare: info.paare,
    spielSek: info.spielSek.toFixed(0), gesamtSek: dauer.toFixed(0), fakt: null,
    ki: false,                  // reine Bildschirmaufnahme, kein Vorspann
  }));
}

rmSync(TMP, { recursive: true, force: true });
console.log(`\n→ ${OUT}`);
console.log('Naechster Schritt: erstes Bild pruefen — es MUSS Spiel sein, keine Karte.');

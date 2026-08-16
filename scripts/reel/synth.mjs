// Erzeugt die Tonspur eines Reels als eine einzige WAV-Datei.
//
// Warum nachgebaut und nicht aufgenommen: Die App erzeugt ihre Klaenge
// prozedural per WebAudio (`src/audio/sound.ts`) — es gibt keine Dateien, die
// man kopieren koennte. Und der CDP-Screencast der Aufnahme liefert ohnehin
// nur Bild, keinen Ton. Der Synth hier ist eine 1:1-Umsetzung von `tone()`
// samt Huellkurve, die Stimmen sind aus derselben Datei uebernommen.
//
// ⚠ Aendert sich `src/audio/sound.ts`, muessen die STIMMEN hier nachgezogen
// werden — sonst klingen die Reels anders als das Spiel. Das faellt niemandem
// auf, ausser man haelt beides nebeneinander.
//
// Bewusst EINE Spur statt vieler ffmpeg-Eingaben: Ein Reel hat schnell 19
// Paare = 57 Einzelklaenge. Als amix-Eingaben waere das unuebersichtlich und
// langsam; als fertige Spur ist es ein Eingang.

import { writeFileSync } from 'node:fs';

const RATE = 48000;

// --- Stimmen (aus src/audio/sound.ts) --------------------------------------
// Jeder Eintrag: [Frequenz, Dauer, Wellenform, Lautstaerke, Verzoegerung]
// Die Lautstaerken sind gegenueber der App leicht angehoben, weil im Reel ein
// Musikteppich darunter liegt; die Verhaeltnisse untereinander bleiben gleich.
export const STIMMEN = {
  tap: [[660, 0.06, 'sine', 0.12, 0]],
  match: [
    [523.25, 0.09, 'sine', 0.16, 0],
    [783.99, 0.14, 'sine', 0.16, 0.06],
  ],
  win: [
    ...[1318.51, 1567.98, 1975.53, 2637.02, 2093.0].flatMap((f, i) => [
      [f, 1.1, 'sine', 0.10, i * 0.14],
      [f * 2.76, 0.5, 'sine', 0.03, i * 0.14],   // metallischer Oberton
    ]),
  ],
  koto: [
    ...[293.66, 349.23, 392.0, 440.0].flatMap((f, i) => [
      [f, 0.5, 'triangle', 0.12, i * 0.12],
      [f * 2, 0.22, 'sine', 0.05, i * 0.12],     // Anschlag-Brillanz
    ]),
  ],
};

// --- Melodie ----------------------------------------------------------------
// Eigene Musik statt Chart-Musik: Trending-Sounds sind fuer PRIVATE Beitraege
// lizenziert, nicht fuer Firmen, die ein Produkt bewerben. Was hier entsteht,
// gehoert uns — es gibt keine Lizenzfrage, auch nicht bei bezahlten Beitraegen.
//
// ⚠ Der tragende Gedanke: Die Melodie sitzt auf den ECHTEN Zugzeiten des
// Spiels, nicht auf einem eigenen Raster. `record-solitaire.mjs` beschleunigt
// die Zuege von 820 ms auf 280 ms; legt man die Toene auf die mitgeschriebenen
// `match`-Zeitpunkte, zieht die Musik von selbst mit an. Ein eigenes Metrum
// wuerde dagegen gegen das Bild laufen — und genau das faellt auf.

// D-Moll-Pentatonik. Die vier unteren Toene sind dieselben wie in der
// `koto`-Stimme oben, damit die Melodie nach derselben Welt klingt wie die App.
const PENTA = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33]; // D4 F4 G4 A4 C5 D5
const BASS = [146.83, 220.0];                                  // D3, A3

/**
 * Baut die Musikereignisse aus den Zugzeiten der Aufnahme.
 *
 * @param klicks   [{ t, art }] aus dem Beipackzettel, Zeiten SCHON auf die
 *                 Zeitachse des fertigen Reels verschoben
 * @param siegBei  Zeitpunkt des Siegs auf derselben Achse (oder null)
 * @returns Ereignisse fuer `spurRendern` (mit `stimme` statt `klang`)
 */
export function melodie(klicks, siegBei) {
  const schlaege = klicks.filter((k) => k.art === 'match');
  if (schlaege.length < 2) return [];
  const ereignisse = [];

  schlaege.forEach((s, i) => {
    const t = i / (schlaege.length - 1);        // 0 am Anfang, 1 am Ende

    // Grundton wandert die Pentatonik hinauf. Kein Zufall, keine Sprünge:
    // eine stetig steigende Linie liest das Ohr als "es geht auf etwas zu".
    const stufe = Math.min(PENTA.length - 1, Math.floor(t * PENTA.length));
    const ton = PENTA[stufe];

    // Lautstaerke steigt leicht mit. Bewusst unter den Steinklaengen
    // (0,12–0,16 in STIMMEN): Die Klaenge sind der Reiz, die Musik traegt nur.
    const laut = 0.045 + 0.028 * t;

    ereignisse.push({
      t: s.t,
      stimme: [
        [ton, 0.42, 'triangle', laut, 0],
        [ton * 2, 0.18, 'sine', laut * 0.35, 0],   // Anschlag-Brillanz wie beim Koto
      ],
    });

    // Bass auf jedem zweiten Zug — er gibt den Puls, ohne das Bild zuzudecken.
    if (i % 2 === 0) {
      ereignisse.push({
        t: s.t,
        stimme: [[BASS[(i / 2) % 2], 0.55, 'sine', 0.075 + 0.03 * t, 0]],
      });
    }

    // Zweite Haelfte: Oktave darueber. Der Klang wird dichter, ohne lauter zu
    // werden — das ist der Unterschied zwischen Steigerung und Krach.
    if (t > 0.55) {
      ereignisse.push({
        t: s.t,
        stimme: [[ton * 2, 0.3, 'triangle', 0.03 + 0.025 * (t - 0.55) / 0.45, 0.04]],
      });
    }
  });

  // Auflösung: gehaltener D–A–D-Akkord unter der vorhandenen `win`-Fanfare.
  // Ohne ihn bricht die Steigerung ab, statt anzukommen.
  if (siegBei != null) {
    ereignisse.push({
      t: siegBei,
      stimme: [
        [146.83, 1.8, 'sine', 0.10, 0],
        [220.0, 1.7, 'triangle', 0.07, 0.02],
        [293.66, 1.6, 'triangle', 0.06, 0.04],
      ],
    });
  }

  return ereignisse;
}

function welle(art, phase) {
  switch (art) {
    case 'square': return phase % 1 < 0.5 ? 1 : -1;
    case 'triangle': { const p = phase % 1; return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; }
    default: return Math.sin(2 * Math.PI * phase);
  }
}

// Huellkurve wie im Browser: linear auf `vol` in 10 ms, danach exponentiell
// auf 0.0001 bei `dauer`. Genau das macht gain.exponentialRampToValueAtTime.
function huelle(t, dauer, vol) {
  const AN = 0.01;
  if (t < 0) return 0;
  if (t < AN) return (t / AN) * vol;
  if (t > dauer) return 0;
  const ziel = 0.0001;
  return vol * Math.pow(ziel / vol, (t - AN) / Math.max(1e-6, dauer - AN));
}

/**
 * @param ereignisse [{ t: Sekunde, klang?: 'tap'|'match'|'win'|'koto',
 *                      stimme?: [[freq, dauer, welle, vol, verzug]], vol?: Faktor }]
 *                   `klang` schlaegt in STIMMEN nach, `stimme` bringt die
 *                   Toene direkt mit — das braucht die Melodie, deren Tonhoehen
 *                   sich je Zug aendern und daher in keine feste Tabelle passen.
 * @param dauer      Gesamtlaenge der Spur in Sekunden
 */
export function spurRendern(ereignisse, dauer, ziel) {
  const n = Math.ceil(dauer * RATE);
  const buf = new Float32Array(n);

  for (const e of ereignisse) {
    const stimme = e.stimme ?? STIMMEN[e.klang];
    if (!stimme) throw new Error(`unbekannter Klang: ${e.klang}`);
    const faktor = e.vol ?? 1;
    for (const [freq, dur, art, vol, verzug] of stimme) {
      const start = Math.round((e.t + verzug) * RATE);
      const laenge = Math.ceil((dur + 0.02) * RATE);
      for (let i = 0; i < laenge; i++) {
        const idx = start + i;
        if (idx < 0 || idx >= n) continue;
        const t = i / RATE;
        buf[idx] += welle(art, (freq * t)) * huelle(t, dur, vol) * faktor;
      }
    }
  }

  // Sanft begrenzen statt hart abschneiden: Bei dicht liegenden Klicks summiert
  // sich sonst hoerbares Knacken auf.
  let spitze = 0;
  for (let i = 0; i < n; i++) spitze = Math.max(spitze, Math.abs(buf[i]));
  const norm = spitze > 0.85 ? 0.85 / spitze : 1;

  const kopf = Buffer.alloc(44);
  const daten = Buffer.alloc(n * 4);            // 16 bit, stereo
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, buf[i] * norm));
    const s = Math.round(v * 32767);
    daten.writeInt16LE(s, i * 4);
    daten.writeInt16LE(s, i * 4 + 2);
  }
  kopf.write('RIFF', 0);
  kopf.writeUInt32LE(36 + daten.length, 4);
  kopf.write('WAVE', 8);
  kopf.write('fmt ', 12);
  kopf.writeUInt32LE(16, 16);
  kopf.writeUInt16LE(1, 20);                    // PCM
  kopf.writeUInt16LE(2, 22);                    // Kanaele
  kopf.writeUInt32LE(RATE, 24);
  kopf.writeUInt32LE(RATE * 4, 28);             // Bytes/Sekunde
  kopf.writeUInt16LE(4, 32);                    // Block
  kopf.writeUInt16LE(16, 34);                   // Bit
  kopf.write('data', 36);
  kopf.writeUInt32LE(daten.length, 40);
  writeFileSync(ziel, Buffer.concat([kopf, daten]));
  return ziel;
}

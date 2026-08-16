// Prueft die Beschreibungstexte ueber alle Format-/Plattform-Kombinationen.
//
// ⚠ Die wichtigste Zeile ist die URL-Pruefung — sie steht seit dem 16.08.2026
// ANDERSHERUM als zuvor. Frueher galt: Instagram und TikTok duerfen KEINE
// Adresse enthalten. Auf Josefs Vorgabe muss sie jetzt in ALLEN drei Fassungen
// stehen, und die Pruefung erzwingt genau das. Wer den alten Kommentar im Kopf
// hat, haelt einen Treffer sonst faelschlich fuer einen Fehler.
//
// Der Grund fuer die Umkehr ist eine Abwaegung, keine Korrektur: Auf Instagram
// und TikTok ist die Adresse im Text nicht anklickbar und kann die Auslieferung
// druecken — sie steht dort zum Ablesen. Josef will sie trotzdem ueberall
// haben, damit niemand suchen muss.
//
// Facebook braucht zusaetzlich die VOLLE Form mit `https://`, sonst ist sie
// dort nicht klickbar — und genau dort waere sie es.
// Aufruf: node scripts/reel/check-captions.mjs

import { FORMATE, PLATTFORMEN, LINK, captionText, fakten } from './formate.mjs';

const PROBE = { datei: 'probe.mp4', level: 40, paare: 20, spielSek: '14', gesamtSek: '20',
  fakt: fakten()[0].en };

let fehler = 0;
const meckern = (m) => { console.error(`  ✗ ${m}`); fehler++; };

for (const [fname, f] of Object.entries(FORMATE)) {
  console.log(`\n${fname}`);
  for (const [pname, p] of Object.entries(PLATTFORMEN)) {
    const text = p.text(f, PROBE);
    const tags = p.tags(f);

    if (tags.length > 5) meckern(`${pname}: ${tags.length} Hashtags — hoechstens 5`);
    if (pname === 'facebook' && tags.length !== 2) meckern(`facebook: ${tags.length} Hashtags — erwartet 2`);

    // Der eigentliche Riegel.
    const hatAdresse = text.includes('mahjong-app-plum.vercel.app/links.html');
    const klickbar = /https:\/\//.test(text);
    if (!hatAdresse) meckern(`${pname}: die Adresse fehlt`);
    if (pname === 'facebook' && !klickbar) meckern('facebook: Adresse ohne https:// — dort nicht klickbar');

    if (!text.trim()) meckern(`${pname}: leerer Text`);
    console.log(`  ${p.name.padEnd(10)} ${text.split('\n').length} Zeilen, ${tags.length} Hashtags`
      + `${klickbar ? ', klickbar' : ', zum Ablesen'}`);
  }
}

// Die fertige Datei muss alle drei Abschnitte tragen.
const datei = captionText('paar', PROBE);
for (const p of Object.values(PLATTFORMEN)) {
  if (!datei.includes(`## ${p.name}`)) meckern(`Abschnitt „${p.name}“ fehlt in der .txt`);
}
if (!datei.includes(LINK)) meckern('die .txt enthaelt die Adresse nirgends');

// --- Gegenprobe -------------------------------------------------------------
// ⚠ Eine Pruefung, die nie anschlaegt, prueft nichts. Hier wird der Fehler
// absichtlich herbeigefuehrt: eine Fassung OHNE Adresse muss auffallen.
// Schlaegt das hier nicht an, ist der Riegel oben wirkungslos — und niemand
// wuerde es merken, weil dann eben alles „in Ordnung“ gemeldet wird.
{
  const kaputt = { ...PLATTFORMEN.instagram, text: (f, o) => f.koerper(o) };
  const erkannt = !kaputt.text(FORMATE.paar, PROBE).includes('mahjong-app-plum.vercel.app/links.html');
  if (!erkannt) {
    console.error('  ✗ GEGENPROBE: fehlende Adresse wurde NICHT erkannt');
    fehler++;
  } else {
    console.log('  ✓ Gegenprobe: fehlende Adresse wird erkannt');
  }
}

console.log(fehler ? `\n✗ ${fehler} Beanstandung(en)` : '\n✓ alle Fassungen in Ordnung');
process.exit(fehler ? 1 : 0);

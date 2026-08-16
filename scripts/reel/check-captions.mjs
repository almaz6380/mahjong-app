// Prueft die Beschreibungstexte ueber alle Format-/Plattform-Kombinationen.
//
// ⚠ Die wichtigste Zeile ist die URL-Pruefung. Ein Store-Link im
// Instagram- oder TikTok-Text ist ein Fehler, den man dem Text NICHT ansieht:
// Er ist dort nicht klickbar (sieht also nur aus wie Text) und drueckt
// zusaetzlich die Ausspielung, weil beide Plattformen Beitraege benachteiligen,
// die aus der App hinausfuehren. Wer den Text von der Facebook-Fassung
// herueberkopiert, baut ihn versehentlich ein — und merkt monatelang nichts.
//
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
    const hatURL = /https?:\/\//.test(text);
    if (pname === 'facebook' && !hatURL) meckern('facebook: die klickbare Adresse fehlt');
    if (pname !== 'facebook' && hatURL) meckern(`${pname}: enthaelt eine URL — dort nicht klickbar und reichweitenschaedlich`);

    if (!text.trim()) meckern(`${pname}: leerer Text`);
    console.log(`  ${p.name.padEnd(10)} ${text.split('\n').length} Zeilen, ${tags.length} Hashtags`
      + `${hatURL ? ', mit Link' : ''}`);
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
// absichtlich herbeigefuehrt: eine Instagram-Fassung MIT Link muss auffallen.
// Schlaegt das hier nicht an, ist der Riegel oben wirkungslos — und niemand
// wuerde es merken, weil dann eben alles „in Ordnung“ gemeldet wird.
{
  const kaputt = { ...PLATTFORMEN.instagram, text: (f, o) => `${f.koerper(o)}\n\n👉 ${LINK}` };
  const erkannt = /https?:\/\//.test(kaputt.text(FORMATE.paar, PROBE));
  if (!erkannt) {
    console.error('  ✗ GEGENPROBE: Link in einer Instagram-Fassung wurde NICHT erkannt');
    fehler++;
  } else {
    console.log('  ✓ Gegenprobe: eingebauter Link wird erkannt');
  }
}

console.log(fehler ? `\n✗ ${fehler} Beanstandung(en)` : '\n✓ alle Fassungen in Ordnung');
process.exit(fehler ? 1 : 0);

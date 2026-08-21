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
import { sprachen } from './karten.mjs';

const PROBE = { datei: 'probe.mp4', level: 40, paare: 20, spielSek: '14', gesamtSek: '20',
  fakt: fakten()[0].en, ki: true };

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

// --- KI-Kennzeichnung -------------------------------------------------------
// ⚠ Diese Pruefung gibt es, weil die Regel EINMAL STILL FALSCH GEWORDEN IST.
// Der Hinweis auf den Plattform-Schalter hing am Formatnamen („nur beim Spot")
// und begruendete das mit „die Gameplay-Reels enthalten kein KI-Material".
// Als am 17.08.2026 jedes Charge-Reel einen kie.ai-Vorspann bekam, riet die
// Datei damit aktiv davon ab, vorhandenes KI-Material zu kennzeichnen — und
// niemandem fiel es auf, weil nichts es geprueft hat.
{
  const mitKi = captionText('paar', { ...PROBE, ki: true });
  const ohneKi = captionText('paar', { ...PROBE, ki: false });
  const hat = (t) => /KI-GENERIERTE INHALTE/.test(t);
  if (!hat(mitKi)) meckern('ki:true — der Hinweis auf den Plattform-Schalter fehlt');
  if (hat(ohneKi)) meckern('ki:false — der Hinweis steht da, obwohl kein KI-Material drin ist');
  // Und die Angabe darf nicht vergessen werden koennen.
  let warf = false;
  try { captionText('paar', { ...PROBE, ki: undefined }); } catch { warf = true; }
  if (!warf) meckern('fehlendes `ki` wird still akzeptiert — das Bauskript muss es angeben');
  if (hat(mitKi) && !hat(ohneKi) && warf) console.log('  ✓ KI-Kennzeichnung haengt am Bauskript, nicht am Formatnamen');
}

// --- Sprachzahl -------------------------------------------------------------
// Sie steht in jeder Caption und darf nicht getippt sein — `sprachen()` liest
// sie aus src/i18n.ts.
{
  const soll = sprachen().length;
  const t = captionText('paar', PROBE);
  const gefunden = [...t.matchAll(/(\d+) languages/g)].map((m) => +m[1]);
  if (!gefunden.length) meckern('keine Sprachangabe in der Caption');
  else if (gefunden.some((v) => v !== soll)) meckern(`Sprachzahl ${gefunden} weicht von LANGS (${soll}) ab`);
  else console.log(`  ✓ Sprachzahl ${soll} deckt sich mit src/i18n.ts`);
}

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

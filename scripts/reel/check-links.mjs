#!/usr/bin/env node
// Prueft die Kampagnen-Kennung in public/links.html am ECHTEN Verhalten.
//
//   node scripts/reel/check-links.mjs
//
// Eigener kleiner Server, echte Query-Zeichenkette, ausgelesen werden die
// tatsaechlichen `href`-Werte der beiden Store-Knoepfe — nicht der Quelltext.
//
// ⚠ WARUM ES DIESES SKRIPT GIBT, zwei Gruende:
//
// (1) `r` und `p` kommen aus der Adresszeile, also aus fremder Hand, und
//     werden in eine ANDERE Adresse eingesetzt. Der Filter dagegen ist eine
//     Zeile Code, und eine Zeile Code faellt beim naechsten Umbau schnell weg.
//     Die Gegenprobe hier fuehrt den Angriff wirklich aus.
//
//     ⚠ Und sie prueft NICHT auf Teilzeichenketten. Die erste Fassung schlug
//     an, weil „boese" im bereinigten Wert `utm_campaign=autm_sourceboese` als
//     Text weiterlebt — harmlos, aber der Test las es als Treffer. Ob
//     Buchstaben vorkommen, ist egal; entscheidend ist, ob daraus ein
//     FUNKTIONIERENDER Parameter wird. Deshalb wird der Referrer zerlegt und
//     werden die Schluessel gezaehlt.
//
// (2) Der Apple-Zweig laeuft heute NIE, weil `APPLE_PT` leer ist. Ein Zweig,
//     den niemand ausfuehrt, bricht beim ersten echten Einsatz — deshalb wird
//     er hier mit gesetztem Token gegengeprueft.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { browserPfad } from './browser.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const html = readFileSync('public/links.html');
const srv = createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); });
await new Promise((r) => srv.listen(5177, '127.0.0.1', r));

const b = await chromium.launch({ executablePath: browserPfad() });
const seite = await b.newPage();
let fehler = 0;
const meckern = (m) => { console.log(`  ✗ ${m}`); fehler++; };

const hole = async (q) => {
  await seite.goto(`http://127.0.0.1:5177/links.html${q}`, { waitUntil: 'load' });
  return seite.evaluate(() => ({
    ios: document.getElementById('ios').href,
    android: document.getElementById('android').href,
  }));
};

console.log('1) mit Kennung ?r=figuren&p=ig');
const a = await hole('?r=figuren&p=ig');
console.log('   Play :', a.android);
console.log('   Apple:', a.ios);
if (!a.android.includes('utm_source%3Dig')) meckern('Play: utm_source fehlt');
if (!a.android.includes('utm_campaign%3Dfiguren')) meckern('Play: utm_campaign fehlt');
if (!a.android.includes('id=com.mahjongroyale.app')) meckern('Play: Paketname weg');

console.log('2) ohne Kennung');
const o = await hole('');
console.log('   Play :', o.android);
if (!o.android.includes('utm_source%3Ddirect')) meckern('ohne Kennung: kein direct-Fallback');

console.log('3) Gegenprobe Einschleusen  ?r=a%26utm_source%3Dboese&p=../x');
const x = await hole('?r=a%26utm_source%3Dboese&p=../x');
console.log('   Play :', x.android);
// ⚠ Hier NICHT auf Teilzeichenketten pruefen. Die erste Fassung dieser
// Gegenprobe schlug an, weil „boese" im bereinigten Wert
// `utm_campaign=autm_sourceboese` als Text weiterlebt — harmlos, aber der
// Test las es als Treffer. Entscheidend ist nicht, ob die Buchstaben
// vorkommen, sondern ob daraus ein FUNKTIONIERENDER Parameter wird. Also:
// den Referrer wirklich zerlegen und die Schluessel zaehlen.
{
  const roh = new URL(x.android).searchParams.get('referrer') || '';
  const felder = new URLSearchParams(roh);
  const schluessel = [...felder.keys()];
  console.log('   Referrer-Felder:', JSON.stringify(Object.fromEntries(felder)));
  if (schluessel.length !== 3) meckern(`Referrer hat ${schluessel.length} Felder statt 3: ${schluessel}`);
  if (felder.getAll('utm_source').length !== 1) meckern('utm_source mehrfach — Parameter eingeschleust');
  if (felder.get('utm_source') !== 'x') meckern(`utm_source ist "${felder.get('utm_source')}", erwartet "x"`);
  if (!/^[a-z0-9_-]*$/.test(felder.get('utm_campaign') || '')) meckern('utm_campaign enthaelt ungesaeuberte Zeichen');
  // Und die Store-URL selbst darf nur ihre zwei eigenen Parameter tragen.
  const store = [...new URL(x.android).searchParams.keys()];
  if (store.length !== 2) meckern(`Store-URL hat ${store.length} Parameter statt 2: ${store}`);
}

console.log('4) Apple ohne Provider-Token');
if (a.ios !== 'https://apps.apple.com/app/id6787721454') meckern(`Apple-Link veraendert, obwohl pt leer: ${a.ios}`);

console.log('5) Apple MIT Provider-Token (sonst ungetesteter Zweig)');
{
  // ⚠ Der Apple-Zweig laeuft heute nie, weil APPLE_PT leer ist. Ein Zweig, den
  // niemand ausfuehrt, ist ein Zweig, der beim ersten echten Einsatz bricht —
  // deshalb hier mit gesetztem Token gegengeprueft.
  const mitPt = String(html).replace("var APPLE_PT = '';", "var APPLE_PT = '123456789';");
  srv.close();
  const srv2 = createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(mitPt); });
  await new Promise((r) => srv2.listen(5178, '127.0.0.1', r));
  await seite.goto('http://127.0.0.1:5178/links.html?r=figuren&p=fb', { waitUntil: 'load' });
  const t = await seite.evaluate(() => document.getElementById('ios').href);
  console.log('   Apple:', t);
  const u = new URL(t);
  if (u.searchParams.get('pt') !== '123456789') meckern('pt fehlt oder falsch');
  if (u.searchParams.get('ct') !== 'fb-figuren') meckern(`ct ist "${u.searchParams.get('ct')}", erwartet "fb-figuren"`);
  if (u.searchParams.get('mt') !== '8') meckern('mt=8 fehlt');
  if (!u.pathname.includes('id6787721454')) meckern('App-ID weg');
  if ([...u.searchParams.keys()].length !== 3) meckern('Apple-URL hat mehr als drei Parameter');
  srv2.close();
}

console.log('6) Origins unveraendert');
for (const u of [a.ios, a.android, o.ios, o.android, x.ios, x.android]) {
  const h = new URL(u).host;
  if (!['apps.apple.com', 'play.google.com'].includes(h)) meckern(`fremder Host: ${h}`);
}

await b.close(); try { srv.close(); } catch {}
console.log(fehler ? `\n✗ ${fehler} Beanstandungen` : '\n✓ alle Linkpruefungen bestanden');
process.exit(fehler ? 1 : 0);

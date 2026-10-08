// Prüft die Duell-Logik ohne Server und ohne Browser.
//
//  1. Gleicher Seed → gleiches Brett (Client und Server MÜSSEN übereinstimmen)
//  2. Jedes Duell-Brett ist lösbar (200 Seeds, per Spiel mit der Engine)
//  3. Gemischt wird mit Seed: zwei SoloBoards mischen identisch
//  4. Server-Raum: ungültige Züge werden abgelehnt (Gegenprobe), ein Rennen
//     endet mit genau einem Sieger, Zeitlimit, Aufgabe, Revanche, Nachspielen
//  5. Riichi: 4 Hände laufen durch, kein Spieler sieht die fremde Hand,
//     abgelaufene Zugzeit wirft automatisch ab, Punkte bleiben in Summe gleich
//
// Aufruf aus dem Projekt-Root: node scripts/check-duel.mjs

import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';

const require0 = createRequire(import.meta.url);

async function load(entry) {
  const r = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    external: ['@capacitor/preferences', 'react', 'react-dom'],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', r.outputFiles[0].text)(mod, mod.exports, require0);
  return mod.exports;
}

const S = await load('src/duel/solitaire.ts');
const R = await load('worker/logic/room.ts');
const RM = await load('worker/logic/riichiMatch.ts');

let fehler = 0;
function ok(cond, msg) {
  if (!cond) {
    fehler++;
    console.log('  ✗ ' + msg);
  }
}

// --- simulierte Laufzeit -----------------------------------------------------
function sim(seed = 1) {
  let now = 1_000_000;
  let r = seed >>> 0;
  const timers = new Map();
  const inbox = [[], []];
  const io = {
    send: (slot, msg) => inbox[slot].push(JSON.parse(JSON.stringify(msg))),
    now: () => now,
    random: () => {
      r = (r * 1664525 + 1013904223) >>> 0;
      return r / 2 ** 32;
    },
    setTimer: (name, ms, fn) => timers.set(name, { at: now + ms, fn }),
    clearTimer: (name) => timers.delete(name),
  };
  return {
    io,
    inbox,
    timers,
    get now() {
      return now;
    },
    /** Uhr vorstellen und fällige Timer auslösen (in Zeitreihenfolge). */
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const [name, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [name, t];
        if (!next) break;
        timers.delete(next[0]);
        now = Math.max(now, next[1].at);
        next[1].fn();
      }
      now = end;
    },
    last(slot, t) {
      return inbox[slot].filter((m) => m.t === t).at(-1);
    },
  };
}

// --- 1–3: Brett ---------------------------------------------------------------
console.log('Brett: Determinismus, Lösbarkeit, Mischen');
console.log(`  Figuren im Duell-Pool: ${S.duelLayouts().length}`);
ok(S.duelLayouts().length >= 20, 'zu wenige Duell-Figuren');
let festgefahren = 0;
for (let seed = 1; seed <= 200; seed++) {
  const lay = S.pickDuelLayout(seed);
  const a = S.makeDuelBoard(seed, lay);
  const b = S.makeDuelBoard(seed, lay);
  ok(JSON.stringify(a) === JSON.stringify(b), `Seed ${seed}: Brett nicht deterministisch`);
  ok(a.length >= 44 && a.length <= 56, `Seed ${seed}: ${a.length} Steine`);
  ok(!a.some((t) => t.hidden || t.face.special), `Seed ${seed}: verdeckte/Spezialsteine im Duell`);

  // Lösen wie ein Spieler: immer das erste mögliche Paar, bei Sackgasse mischen.
  const bd = new S.SoloBoard(seed, lay, 0);
  const zw = new S.SoloBoard(seed, lay, 0);
  let guard = 0;
  while (bd.remaining > 0 && guard++ < 500) {
    const p = bd.pairs();
    if (p.length) {
      ok(bd.match(p[0][0], p[0][1]) && zw.match(p[0][0], p[0][1]), `Seed ${seed}: Zug abgelehnt`);
    } else {
      const s1 = bd.shuffle();
      const s2 = zw.shuffle();
      ok(s1 === s2, `Seed ${seed}: Mischen uneinig`);
      if (!s1) break;
    }
    ok(JSON.stringify(bd.tiles) === JSON.stringify(zw.tiles), `Seed ${seed}: Mischen nicht deterministisch`);
  }
  // Sich festzuspielen ist erlaubt (wie im Level-Modus, z. B. zwei gestapelte
  // Paare) — dafür gibt es die „stuck"-Regel. Es muss aber selten bleiben.
  if (bd.remaining > 0) festgefahren++;
}
console.log(`  festgefahren (gieriger Spieler): ${festgefahren}/200`);
ok(festgefahren <= 20, `zu oft festgefahren: ${festgefahren}/200`);

// Gegenprobe: ein blockierter oder unpassender Zug MUSS abgelehnt werden.
{
  const bd = new S.SoloBoard(7, S.pickDuelLayout(7), 0);
  const free = new Set(bd.freeKeys());
  const blocked = bd.tiles.find((t) => !free.has(t.key));
  const partner = bd.tiles.find((t) => t.key !== blocked.key && t.face.matchKey === blocked.face.matchKey);
  ok(!bd.match(blocked.key, partner.key), 'Gegenprobe: blockierter Stein wurde angenommen');
  const f = [...free];
  let unpassend = null;
  for (let i = 0; i < f.length && !unpassend; i++)
    for (let j = i + 1; j < f.length; j++)
      if (bd.tiles[f[i]].face.matchKey !== bd.tiles[f[j]].face.matchKey) {
        unpassend = [f[i], f[j]];
        break;
      }
  ok(!bd.match(unpassend[0], unpassend[1]), 'Gegenprobe: unpassendes Paar wurde angenommen');
  ok(bd.remaining === bd.total, 'Gegenprobe: abgelehnter Zug hat das Brett verändert');
}

// --- 4: Solitaire-Raum -----------------------------------------------------------
console.log('Solitaire-Raum: Rennen, Ablehnung, Zeitlimit, Aufgabe, Revanche, Nachspielen');

function soloRoom(seed) {
  const s = sim(seed);
  const room = new R.Room('solitaire', 'ABCDE', s.io);
  for (const [slot, pid] of [[0, 'spieler-aaaa'], [1, 'spieler-bbbb']]) {
    const c = room.claim(pid, 1);
    ok(c.slot === slot, 'falscher Platz');
    room.join(c.slot, pid, 'P' + slot);
  }
  const st = s.last(0, 'start');
  ok(st && JSON.stringify(st) === JSON.stringify({ ...s.last(1, 'start'), now: st.now }), 'beide müssen dasselbe Brett bekommen');
  return { s, room, st };
}

// Rennen: Slot 1 spielt schneller und gewinnt.
{
  const { s, room, st } = soloRoom(3);
  ok(room.claim('spieler-cccc', 1).error === 'full', 'Dritter Spieler kam in den Raum');
  ok(room.claim('spieler-aaaa', 2).error === 'version', 'falsche Protokollversion angenommen');
  s.advance(4000);
  const boards = [0, 1].map((slot) => new S.SoloBoard(st.seed, st.layout, slot));
  // Ungültiger Zug: darf keinen Fortschritt melden.
  const vorher = s.inbox[1].length;
  room.onMsg(0, { t: 'match', a: 0, b: 0 });
  ok(s.inbox[1].length === vorher, 'ungültiger Zug wurde dem Gegner gemeldet');
  let schritte = 0;
  while (!s.last(0, 'end') && schritte++ < 400) {
    for (const slot of [1, 0]) {
      if (slot === 0 && schritte % 2) continue; // Slot 0 halb so schnell
      const b = boards[slot];
      const p = b.pairs();
      if (p.length) {
        b.match(p[0][0], p[0][1]);
        room.onMsg(slot, { t: 'match', a: p[0][0], b: p[0][1] });
      } else if (b.shuffle()) room.onMsg(slot, { t: 'shuffle' });
      else room.onMsg(slot, { t: 'stuck' });
      s.advance(1000);
    }
  }
  const end = s.last(0, 'end');
  ok(end && end.winner === 1, `Rennen: erwarteter Sieger 1, bekommen ${end && end.winner} (${end && end.reason})`);
  ok(end && JSON.stringify(end) === JSON.stringify(s.last(1, 'end')), 'beide müssen dasselbe Ergebnis sehen');
  ok(s.inbox[0].filter((m) => m.t === 'end').length === 1, 'Ergebnis mehrfach geschickt');
  // Gegnerbalken: Slot 0 bekommt Fortschritt von Slot 1.
  ok(s.inbox[0].some((m) => m.t === 'progress' && m.slot === 1 && m.remaining < m.total), 'kein Gegner-Fortschritt');

  // Revanche: erst wenn beide wollen, neues Brett.
  room.onMsg(0, { t: 'rematch' });
  ok(s.inbox[0].filter((m) => m.t === 'start').length === 1, 'Revanche startete mit nur einer Zusage');
  room.onMsg(1, { t: 'rematch' });
  const neu = s.last(0, 'start');
  ok(neu.round === 2, 'Revanche hat keine neue Runde gestartet');
}

// Zeitlimit: niemand spielt → nach 10 min Unentschieden.
{
  const { s } = soloRoom(5);
  s.advance(S.DUEL_COUNTDOWN_MS + S.DUEL_TIME_CAP_MS + 10);
  const end = s.last(0, 'end');
  ok(end && end.reason === 'time' && end.winner === null, 'Zeitlimit greift nicht');
}

// Zeitlimit mit Vorsprung: wer weniger Steine hat, gewinnt.
{
  const { s, room, st } = soloRoom(6);
  s.advance(4000);
  const b = new S.SoloBoard(st.seed, st.layout, 0);
  const p = b.pairs()[0];
  room.onMsg(0, { t: 'match', a: p[0], b: p[1] });
  s.advance(S.DUEL_TIME_CAP_MS);
  const end = s.last(1, 'end');
  ok(end && end.reason === 'time' && end.winner === 0, 'Zeitlimit: Vorsprung zählt nicht');
}

// Verbindungsabbruch: nach 30 s gewinnt der andere — Rückkehr vorher rettet.
{
  const { s, room, st } = soloRoom(8);
  s.advance(4000);
  const b = new S.SoloBoard(st.seed, st.layout, 0);
  const p = b.pairs()[0];
  b.match(p[0], p[1]);
  room.onMsg(0, { t: 'match', a: p[0], b: p[1] });
  room.disconnect(0);
  s.advance(R.RECONNECT_MS - 1000);
  ok(!s.last(1, 'end'), 'Abbruch: Duell endete zu früh');
  // Rückkehr: Nachspiel-Protokoll muss den Zug enthalten.
  s.inbox[0].length = 0;
  room.join(room.claim('spieler-aaaa', 1).slot, 'spieler-aaaa', 'P0');
  const rp = s.last(0, 'replay');
  ok(rp && rp.log.length === 1 && rp.log[0][0] === 'm', 'Rückkehr: kein Nachspiel-Protokoll');
  s.advance(R.RECONNECT_MS * 2);
  ok(!s.last(1, 'end'), 'Rückkehr: trotzdem als Aufgabe gewertet');
  room.disconnect(0);
  s.advance(R.RECONNECT_MS + 10);
  const end = s.last(1, 'end');
  ok(end && end.reason === 'forfeit' && end.winner === 1, 'Abbruch: keine Aufgabe nach 30 s');
}

// Festgefahren: falsche „stuck"-Meldung wird ignoriert.
{
  const { s, room } = soloRoom(9);
  s.advance(4000);
  room.onMsg(0, { t: 'stuck' });
  ok(!s.inbox[1].some((m) => m.t === 'progress' && m.slot === 0 && m.stuck), 'falsches „stuck" angenommen');
}

// Festgefahren, echt: Strafzeit läuft; räumt der andere vorher ab, gewinnt er.
{
  // Einen Seed suchen, auf dem der gierige Spieler sich festspielt.
  let seed = 0;
  let st = null;
  let s = null;
  let room = null;
  let b0 = null;
  for (let k = 1; k < 400 && !b0; k++) {
    const r = soloRoom(k);
    const b = new S.SoloBoard(r.st.seed, r.st.layout, 0);
    const ops = [];
    let g = 0;
    while (g++ < 300) {
      const p = b.pairs();
      if (p.length) b.match(p[0][0], p[0][1]), ops.push({ t: 'match', a: p[0][0], b: p[0][1] });
      else if (b.shuffle()) ops.push({ t: 'shuffle' });
      else break;
    }
    if (b.remaining > 0) ({ s, room, st } = r), (seed = k), (b0 = b), (b0.ops = ops);
  }
  ok(!!b0, 'kein festgefahrenes Brett gefunden');
  if (b0) {
    s.advance(4000);
    for (const op of b0.ops) room.onMsg(0, op);
    room.onMsg(0, { t: 'stuck' });
    ok(s.inbox[1].some((m) => m.t === 'progress' && m.slot === 0 && m.stuck), 'echtes „stuck" abgelehnt');
    ok(!s.last(0, 'end'), 'stuck: Duell endete sofort statt nach der Strafzeit');
    s.advance(S.DUEL_STUCK_PENALTY_MS + 10);
    const end = s.last(0, 'end');
    ok(end && end.winner === 0 && end.reason === 'stuck', `stuck: nach Strafzeit kein Sieg (${end && end.reason})`);
  }
}

// --- 5: Riichi ---------------------------------------------------------------
console.log('Riichi: 4 Hände, verdeckte Hände, Zugzeit, Punkte');
for (let seed = 1; seed <= 30; seed++) {
  const s = sim(seed * 7919);
  const room = new R.Room('riichi', 'RIICH', s.io);
  for (const [slot, pid] of [[0, 'riichi-aaaa'], [1, 'riichi-bbbb']]) room.join(room.claim(pid, 1).slot, pid, 'R' + slot);

  let guard = 0;
  let autoDiscard = false;
  while (!s.last(0, 'end') && guard++ < 5000) {
    for (const slot of [0, 1]) {
      const v = s.last(slot, 'rstate')?.view;
      if (!v) continue;
      // Geheimhaltung: fremde Hände tauchen nie auf.
      ok(v.hand.length === v.handCounts[v.mySeat], 'eigene Hand passt nicht zur Anzahl');
      // Die Ansicht enthält nur die EIGENE Hand; fremde Steine nur nach Ende der Hand.
      const other = s.last(1 - slot, 'rstate')?.view;
      if (other && !v.result && other.hand.length) {
        const fremd = other.hand.join(',');
        ok(!JSON.stringify(v).includes(fremd), 'fremde Hand im Datenstrom');
      }
      if (v.result) {
        if (!v.ready[v.mySeat] && (seed + guard) % 3) room.onMsg(slot, { t: 'next' });
        continue;
      }
      if (!v.my) continue;
      if (v.my.kind === 'ron') {
        room.onMsg(slot, { t: (seed % 2) ? 'ron' : 'pass' });
      } else if (v.my.canTsumo) room.onMsg(slot, { t: 'tsumo' });
      else if (slot === 1 && seed % 5 === 0) {
        // Slot 1 lässt hier die Zeit ablaufen → Server wirft selbst ab.
        const vorher = v.discards[v.mySeat].length;
        s.advance(RM.TURN_MS + 10);
        const nach = s.last(slot, 'rstate').view;
        if (nach.discards[v.mySeat].length === vorher + 1) autoDiscard = true;
      } else {
        if (v.my.canRiichi && seed % 3 === 0) room.onMsg(slot, { t: 'riichi' });
        room.onMsg(slot, { t: 'discard', tile: v.hand[v.hand.length - 1] });
      }
    }
    s.advance(800);
  }
  const end = s.last(0, 'end');
  ok(end && end.reason === 'points', `Riichi Seed ${seed}: Partie endete nicht (${end && end.reason})`);
  const v = s.last(0, 'rstate').view;
  ok(v.handNo === RM.RIICHI_HANDS, `Riichi Seed ${seed}: nur ${v.handNo} Hände`);
  const summe = v.points.reduce((a, b) => a + b, 0);
  ok(summe === 4 * RM.START_POINTS, `Riichi Seed ${seed}: Punktsumme ${summe}`);
  if (end) {
    const [a, b] = end.results.map((r) => r.points);
    const erwartet = a === b ? null : a > b ? 0 : 1;
    ok(end.winner === erwartet, `Riichi Seed ${seed}: falscher Sieger`);
  }
  if (seed % 5 === 0) ok(autoDiscard, `Riichi Seed ${seed}: Zugzeit lief ab, aber kein automatischer Abwurf`);
}

if (fehler) {
  console.log(`\n${fehler} Fehler`);
  process.exit(1);
}
console.log('\nAlles in Ordnung.');

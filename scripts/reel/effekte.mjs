// Effekte zwischen den Modi — der knallige Schnitt fuers Modi-Reel.
//
// Josef wollte es ausdruecklich im TikTok-Stil (21.08.2026). Der Einwand
// dagegen steht und bleibt richtig: Genau solche Vollbild-Effekte sind beim
// Bau von v1 wieder rausgeflogen (`zoomin`, `hblur`), weil sie als
// ganzflaechige Schlieren wie ein DEFEKT aussahen. Daraus die Bauregel, an
// der hier alles haengt:
//
//   ⚠ Ein Effekt liest sich als GEWOLLT, wenn er kurz ist, eine erkennbare
//     Form hat und auf einem Klang sitzt. Er liest sich als FEHLER, wenn er
//     weich, ganzflaechig und lautlos ist.
//
// Deshalb hat jeder Eintrag unten eine Form (Steinwand, Balken, Streifen,
// Blitzkante), eine harte Obergrenze in Bildern — und in `reel-modi.mjs`
// einen eigenen Aufprallton.
//
// ⚠ BLITZE SIND GEDECKELT. Vollflaechige Blitze in schneller Folge koennen
// bei photosensitiver Epilepsie Anfaelle ausloesen; der Richtwert ist
// hoechstens DREI pro Sekunde. Bei fuenf Schnitten auf ~20 s sind wir bei
// 0,25/s, also weit darunter — die Regel steht trotzdem im Pruefskript
// (`MIN_BLITZ_ABSTAND`), damit sie ein kuenftiger Umbau nicht still reisst.
// Kein Blitz geht auf reines Weiss: Spitze 0,88 mit Goldstich, weil reines
// Weiss auf OLED zusaetzlich sticht.

export const MIN_BLITZ_ABSTAND = 0.4;   // Sekunden zwischen zwei Blitzen
export const MAX_BLITZ_ALPHA = 0.9;

/**
 * `blende`/`blendeSek` — der xfade DARUNTER.
 *   Unter einer deckenden Grafik ist eine Ueberblendung nur Matsch, deshalb
 *   0,08 s = praktisch harter Schnitt. ⚠ Das wirkt NICHT abrupt, obwohl
 *   genau das frueher die Kritik war: Der Blitz gibt dem Auge das Ereignis,
 *   das einer nackten Schnittkante fehlt. Effekt und harter Schnitt gehoeren
 *   zusammen — wer den Effekt rausnimmt, muss `blendeSek` mit hochziehen.
 * `sek`     — Gesamtdauer des Effekts, um die Schnittmitte zentriert.
 * `grafik`  — welche PNG-Form darueberfaehrt (siehe `malGrafik`).
 * `flash`   — Vollflaeche: { staerke, farbe, auf, halt, zu } in Sekunden.
 * `ruckeln` — Kamerastoss in Pixeln, x/y getrennt, `hz` = Zitterfrequenz.
 */
export const EFFEKTE = {
  // 1. Eine Wand echter Marmorsteine faellt durchs Bild. Der Schnitt liegt
  //    unter der Deckung. Am staerksten on-brand: das Produkt selbst wischt.
  steinwand: {
    blende: 'fade', blendeSek: 0.08,
    sek: 0.62, grafik: 'steinwand',
    flash: { staerke: 0.66, farbe: '#fff1c2', auf: 0.03, halt: 0.03, zu: 0.14 },
    ruckeln: { x: 5, y: 15, hz: 17 },
  },

  // 2. RGB-versetzte Balken, fuenf Bilder, harter Schnitt darunter.
  glitch: {
    blende: 'fade', blendeSek: 0.08,
    sek: 0.30, grafik: 'glitch',
    flash: { staerke: 0.42, farbe: '#c8f0ff', auf: 0.02, halt: 0.02, zu: 0.08 },
    ruckeln: { x: 16, y: 6, hz: 24 },
  },

  // 3. Sog nach vorn. ⚠ Hier steckt `zoomin` DRUNTER — derselbe Uebergang,
  //    der in v1 als goldene Vollbild-Schliere durchgefallen ist. Er
  //    funktioniert jetzt, weil der Blitz genau auf seiner haesslichsten
  //    Stelle sitzt: Was ueberbleibt, liest sich als Stoss nach vorn.
  //    Ohne den Blitz ist er wieder ein Defekt — nicht einzeln zurueckdrehen.
  zoompunch: {
    blende: 'zoomin', blendeSek: 0.22,
    sek: 0.42, grafik: null,
    // `halt` bewusst kurz: Der `zoomin` darunter ist an seiner Spitze SELBST
    // schon fast weiss, zusammen mit dem Blitz war das Bild drei Bilder lang
    // ganz weg. Zwei reichen fuer den Stoss.
    flash: { staerke: 0.74, farbe: '#fff6d8', auf: 0.03, halt: 0.015, zu: 0.16 },
    ruckeln: { x: 8, y: 18, hz: 15 },
  },

  // 4. Peitsche. Die Streifen macht `hrwind` schon als xfade; die PNG legt
  //    Tempolinien darueber, der Stoss geht seitlich.
  whip: {
    blende: 'hrwind', blendeSek: 0.26,
    sek: 0.44, grafik: 'speed',
    flash: { staerke: 0.34, farbe: '#eafff4', auf: 0.03, halt: 0.02, zu: 0.12 },
    ruckeln: { x: 20, y: 4, hz: 20 },
  },

  // 5. Der haerteste Blitz des Reels — er kuendigt die Uhr an.
  blitzschlag: {
    blende: 'fade', blendeSek: 0.08,
    sek: 0.34, grafik: null,
    flash: { staerke: 0.88, farbe: '#fffbe8', auf: 0.02, halt: 0.05, zu: 0.18 },
    ruckeln: { x: 7, y: 20, hz: 19 },
  },
};

// --- Ruckeln ----------------------------------------------------------------
// Das fertige Bild liegt als Overlay auf Schwarz und wird verschoben; Overlay
// kann seine Grundschicht nicht selbst bewegen.
//
// ⚠ Das Bild wird dafuer um 4 % GROESSER skaliert und mittig gesetzt. Ohne
// diesen Rand blitzt bei jedem Stoss der schwarze Untergrund an der Kante auf
// — der Effekt saehe dann tatsaechlich nach kaputtem Video aus. Die Amplituden
// oben muessen deshalb unter dem Rand bleiben (21 px waagerecht, 38 px
// senkrecht); `pruefeAmplituden()` setzt das durch.
export const UEBERGROESSE = 1.04;

export function pruefeAmplituden(effekte, B, H) {
  const randX = Math.floor((B * UEBERGROESSE - B) / 2);
  const randY = Math.floor((H * UEBERGROESSE - H) / 2);
  for (const [name, e] of Object.entries(effekte)) {
    if (e.ruckeln.x > randX) throw new Error(`${name}: Ruckeln x=${e.ruckeln.x} > Rand ${randX} — schwarze Kante`);
    if (e.ruckeln.y > randY) throw new Error(`${name}: Ruckeln y=${e.ruckeln.y} > Rand ${randY} — schwarze Kante`);
  }
  return { randX, randY };
}

/** Ein abklingendes Zittern, das ausserhalb seines Fensters exakt 0 ist. */
const stoss = (ab, dauer, amp, hz) => amp === 0 ? '0'
  : `if(between(t,${ab.toFixed(3)},${(ab + dauer).toFixed(3)}),`
    + `${amp}*(1-(t-${ab.toFixed(3)})/${dauer.toFixed(3)})`
    + `*sin((t-${ab.toFixed(3)})*${(hz * 2 * Math.PI).toFixed(2)}),0)`;

/** Summe aller Stoesse als ein einziger Overlay-Ausdruck. */
export function ruckelAusdruck(fenster, achse) {
  const teile = fenster.map((f) => stoss(f.ab, f.sek, f.ruckeln[achse], f.ruckeln.hz));
  return teile.length ? teile.join('+') : '0';
}

// --- Grafiken ---------------------------------------------------------------
// Chromium rendert sie als transparentes PNG (`omitBackground`), genau wie die
// Namensschilder. Kein `drawtext` — den Filter hat der ffmpeg-static-Build
// nicht.
//
// ⚠ Alles hier ist DETERMINISTISCH. Kein Math.random: Ein zweiter Lauf muss
// dasselbe Bild ergeben, sonst laesst sich ein Effekt nie wieder nachstellen,
// wenn er einmal schlecht aussieht.
const wuerfel = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

/**
 * @param art     'steinwand' | 'glitch' | 'speed'
 * @param bilder  { [name]: base64 } — Steinmotive fuer die Wand
 */
export function grafikHtml(art, B, H, bilder = {}) {
  if (art === 'steinwand') {
    // Eine volle Bildhoehe Steine, damit die Wand das Bild wirklich deckt.
    // ⚠ 5×7, nicht 5×9: Bei neun Reihen sind die Kacheln fast QUADRATISCH und
    // die Wand liest sich im gedeckten Moment als Tapetenmuster statt als
    // Mahjong-Steine. Ein Stein ist etwa 3:4 hoch — genau das ergibt 5×7.
    const spalten = 5, zeilen = 7;
    const bw = Math.ceil(B / spalten), bh = Math.ceil(H / zeilen);
    const motive = Object.keys(bilder);
    let out = `<div style="position:absolute;inset:0">`;
    for (let r = 0; r < zeilen; r++) {
      for (let c = 0; c < spalten; c++) {
        const i = r * spalten + c;
        const m = motive[i % motive.length];
        const kipp = (wuerfel(i) - 0.5) * 4;
        out += `<div style="position:absolute;left:${c * bw}px;top:${r * bh}px;
                  width:${bw - 8}px;height:${bh - 8}px;margin:4px;
                  border-radius:14px;overflow:hidden;transform:rotate(${kipp.toFixed(2)}deg);
                  background:url(data:image/webp;base64,${bilder[m]}) center/cover,#f4ecd8;
                  box-shadow:inset 0 0 0 3px rgba(245,179,1,.55),0 10px 24px rgba(0,0,0,.55)"></div>`;
      }
    }
    return out + `</div>`;
  }

  if (art === 'glitch') {
    // Waagerechte Balken mit Rot-/Cyan-Saum — die Bildsprache des digitalen
    // Aussetzers. Halbdurchsichtig, damit das Spiel darunter erkennbar bleibt.
    let out = `<div style="position:absolute;inset:0">`;
    for (let i = 0; i < 14; i++) {
      const y = Math.floor(wuerfel(i + 1) * H);
      const h = 10 + Math.floor(wuerfel(i + 40) * 60);
      const dx = Math.floor((wuerfel(i + 80) - 0.5) * 90);
      out += `<div style="position:absolute;left:${dx - 6}px;top:${y}px;width:${B + 12}px;height:${h}px;
                background:rgba(255,42,72,.62)"></div>`
           + `<div style="position:absolute;left:${dx + 6}px;top:${y}px;width:${B + 12}px;height:${h}px;
                background:rgba(40,235,255,.62);mix-blend-mode:screen"></div>`
           + `<div style="position:absolute;left:${dx}px;top:${y + 2}px;width:${B + 12}px;height:${Math.max(2, h - 4)}px;
                background:rgba(255,255,255,.22)"></div>`;
    }
    return out + `</div>`;
  }

  if (art === 'speed') {
    // Tempolinien, breiter als das Bild — sie fahren seitlich durch.
    let out = `<div style="position:absolute;inset:0">`;
    for (let i = 0; i < 26; i++) {
      const y = Math.floor(wuerfel(i + 7) * H);
      const h = 3 + Math.floor(wuerfel(i + 90) * 9);
      const w = Math.floor(240 + wuerfel(i + 150) * 700);
      const x = Math.floor(wuerfel(i + 200) * B);
      const a = (0.25 + wuerfel(i + 260) * 0.5).toFixed(2);
      out += `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;
                border-radius:${h}px;
                background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,247,214,${a}),rgba(255,255,255,0))"></div>`;
    }
    return out + `</div>`;
  }
  throw new Error(`unbekannte Effektgrafik: ${art}`);
}

/**
 * Wie die Grafik durchs Bild faehrt. Gibt den Overlay-Ausdruck fuer x und y.
 * `m` ist die Schnittmitte, `sek` die Effektdauer.
 */
export function grafikBahn(art, m, sek, B, H) {
  const a = m - sek / 2, e = m + sek / 2;
  if (art === 'steinwand') {
    // Von oben herein, kurzer Halt in Deckung (dort sitzt der Schnitt),
    // dann weiter nach unten hinaus.
    const h1 = m - 0.05, h2 = m + 0.05;
    return {
      x: '0',
      y: `if(lt(t,${h1.toFixed(3)}),`
        + `-H+(t-${a.toFixed(3)})/${(h1 - a).toFixed(3)}*H,`
        + `if(lt(t,${h2.toFixed(3)}),0,`
        + `(t-${h2.toFixed(3)})/${(e - h2).toFixed(3)}*H))`,
      an: `between(t,${a.toFixed(3)},${e.toFixed(3)})`,
    };
  }
  if (art === 'glitch') {
    // Kein Durchfahren — Sprung je Bild. `floor(t*30)` haelt es auf dem
    // Bildraster, sonst wandert es weich und sieht nach Wackelkontakt aus.
    return {
      x: `-60+120*mod(floor(t*30),3)`,
      y: `-30+60*mod(floor(t*30+1),2)`,
      an: `between(t,${a.toFixed(3)},${e.toFixed(3)})`,
    };
  }
  if (art === 'speed') {
    return {
      x: `W-(t-${a.toFixed(3)})/${sek.toFixed(3)}*(W*2)`,
      y: '0',
      an: `between(t,${a.toFixed(3)},${e.toFixed(3)})`,
    };
  }
  throw new Error(`unbekannte Effektgrafik: ${art}`);
}

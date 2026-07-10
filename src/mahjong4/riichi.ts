// Riichi (japanisches Mahjong) — Wertungskern: Hand-Zerlegung, Yaku-Erkennung,
// Han/Fu und Punktewertung. Korrektheitskritisch → mit Headless-Tests abgesichert.
// Tile-Index (aus tiles4): 0-8 m, 9-17 s, 18-26 p, 27-30 Winde O/S/W/N, 31-33 Drachen R/G/W.

export type BlockType = 'pung' | 'chow' | 'kong';
export interface Block { type: BlockType; tile: number; concealed: boolean } // chow: tile = niedrigster
export interface Decomp { pair: number; blocks: Block[] }

const isHonor = (i: number) => i >= 27;
const isTerminal = (i: number) => i < 27 && (i % 9 === 0 || i % 9 === 8);
const isTermOrHonor = (i: number) => isHonor(i) || isTerminal(i);
const suitOf = (i: number) => (i < 27 ? (i / 9) | 0 : -1);
const rankOf = (i: number) => i % 9; // 0..8

// Alle Standard-Zerlegungen (Paar + n Sätze) der VERDECKTEN Zähler.
export function decompose(counts: ArrayLike<number>, setsNeeded: number): Decomp[] {
  const c = Array.from(counts, (x) => x as number);
  const out: Decomp[] = [];
  const blocks: Block[] = [];

  const rec = (need: number): boolean => {
    // (nur zum Auffüllen der Sätze; Paar wird außen gewählt)
    if (need === 0) { out.push({ pair: currentPair, blocks: blocks.slice() }); return true; }
    let i = 0;
    while (i < 34 && c[i] === 0) i++;
    if (i === 34) return false;
    // Pung
    if (c[i] >= 3) {
      c[i] -= 3; blocks.push({ type: 'pung', tile: i, concealed: true });
      rec(need - 1);
      blocks.pop(); c[i] += 3;
    }
    // Chow
    if (i < 27 && rankOf(i) <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; blocks.push({ type: 'chow', tile: i, concealed: true });
      rec(need - 1);
      blocks.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
    }
    return false;
  };

  let currentPair = -1;
  for (let p = 0; p < 34; p++) {
    if (c[p] >= 2) {
      c[p] -= 2; currentPair = p;
      rec(setsNeeded);
      c[p] += 2;
    }
  }
  // Duplikate (gleiche Blockmenge) entfernen.
  const seen = new Set<string>();
  return out.filter((d) => {
    const key = d.pair + '|' + d.blocks.map((b) => b.type + b.tile).sort().join(',');
    if (seen.has(key)) return false; seen.add(key); return true;
  });
}

export interface WinCtx {
  seatWind: number;   // 27..30
  roundWind: number;  // 27..30
  winTile: number;    // gewinnender Stein-Index
  tsumo: boolean;     // Selbstzug
  riichi: boolean;
  ippatsu: boolean;
  menzen: boolean;    // Hand komplett verdeckt (keine offenen Melds)
  doraCount: number;  // inkl. rote/aka falls genutzt (hier: aus Indikatoren)
}

export interface Scored { han: number; fu: number; yaku: { name: string; han: number }[]; points: number; yakuman: boolean }

const YAKUHAI_DRAGON = [31, 32, 33];

// Yaku + Han für eine konkrete Standard-Zerlegung + Melds.
function evalStandard(d: Decomp, melds: Block[], ctx: WinCtx): { yaku: { name: string; han: number }[]; yakuman: number } {
  const all = [...d.blocks, ...melds];
  const yaku: { name: string; han: number }[] = [];
  const add = (name: string, han: number) => yaku.push({ name, han });
  const open = !ctx.menzen;

  const pungs = all.filter((b) => b.type === 'pung' || b.type === 'kong');
  const chows = all.filter((b) => b.type === 'chow');
  const tiles = new Set<number>();
  all.forEach((b) => { if (b.type === 'chow') { tiles.add(b.tile); tiles.add(b.tile + 1); tiles.add(b.tile + 2); } else tiles.add(b.tile); });
  tiles.add(d.pair);

  // Yakuhai (Drachen, Sitz-/Rundenwind)
  for (const p of pungs) {
    if (YAKUHAI_DRAGON.includes(p.tile)) add('yakuhai', 1);
    if (p.tile === ctx.seatWind) add('seat wind', 1);
    if (p.tile === ctx.roundWind) add('round wind', 1);
  }
  // Tanyao (keine Terminals/Ehren)
  if (![...tiles].some(isTermOrHonor)) add('tanyao', 1);
  // Pinfu (alle Chows, Paar kein Yakuhai, verdeckt)
  const pairYakuhai = YAKUHAI_DRAGON.includes(d.pair) || d.pair === ctx.seatWind || d.pair === ctx.roundWind;
  if (ctx.menzen && chows.length === 4 && !pairYakuhai) add('pinfu', 1);
  // Iipeikou (verdeckt, zwei identische Chows)
  if (ctx.menzen) {
    const chowKey = chows.map((c) => c.tile);
    const counts = new Map<number, number>();
    chowKey.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    let ii = 0; for (const v of counts.values()) if (v >= 2) ii++;
    if (ii >= 1) add('iipeikou', 1);
  }
  // Sanshoku doujun (gleicher Chow in 3 Farben)
  for (const c of chows) {
    const r = rankOf(c.tile);
    if (suitOf(c.tile) === 0 && chows.some((x) => suitOf(x.tile) === 1 && rankOf(x.tile) === r) && chows.some((x) => suitOf(x.tile) === 2 && rankOf(x.tile) === r)) {
      add('sanshoku', open ? 1 : 2); break;
    }
  }
  // Ittsuu (123-456-789 gleiche Farbe)
  for (let s = 0; s < 3; s++) {
    if (chows.some((c) => suitOf(c.tile) === s && rankOf(c.tile) === 0) &&
        chows.some((c) => suitOf(c.tile) === s && rankOf(c.tile) === 3) &&
        chows.some((c) => suitOf(c.tile) === s && rankOf(c.tile) === 6)) { add('ittsuu', open ? 1 : 2); break; }
  }
  // Toitoi (alle Pungs/Kongs)
  if (chows.length === 0 && pungs.length === 4) add('toitoi', 2);
  // Sanankou (3 verdeckte Pungs)
  const concealedPungs = pungs.filter((p) => p.concealed).length;
  if (concealedPungs >= 3) add('sanankou', 2);
  // Chanta/Junchan (jeder Block + Paar enthält Terminal/Ehre)
  const blockHasTermHonor = (b: Block) => b.type === 'chow'
    ? (rankOf(b.tile) === 0 || rankOf(b.tile) === 6) // 123 oder 789
    : isTermOrHonor(b.tile);
  if (all.every(blockHasTermHonor) && isTermOrHonor(d.pair)) {
    const anyHonor = all.some((b) => isHonor(b.tile)) || isHonor(d.pair);
    if (anyHonor) add('chanta', open ? 1 : 2);
    else add('junchan', open ? 2 : 3);
  }
  // Shousangen (2 Drachen-Pungs + Drachen-Paar)
  const dragonPungs = pungs.filter((p) => YAKUHAI_DRAGON.includes(p.tile)).length;
  if (dragonPungs === 2 && YAKUHAI_DRAGON.includes(d.pair)) add('shousangen', 2);
  // Honitsu / Chinitsu (eine Farbe [+ Ehren])
  const suits = new Set([...tiles].filter((i) => i < 27).map(suitOf));
  const hasHonor = [...tiles].some(isHonor);
  if (suits.size === 1) add(hasHonor ? 'honitsu' : 'chinitsu', hasHonor ? (open ? 2 : 3) : (open ? 5 : 6));

  // Yakuman: Daisangen, Suuankou, Tsuuiisou, Chinroutou
  let yakuman = 0;
  if (dragonPungs === 3) yakuman += 1; // Daisangen
  if (concealedPungs === 4 && ctx.menzen) yakuman += 1; // Suuankou
  if ([...tiles].every(isHonor)) yakuman += 1; // Tsuuiisou
  if ([...tiles].every((i) => isTerminal(i))) yakuman += 1; // Chinroutou

  return { yaku, yakuman };
}

// Fu berechnen (Standardfall).
function calcFu(d: Decomp, melds: Block[], ctx: WinCtx, hasPinfu: boolean): number {
  if (hasPinfu) return ctx.tsumo ? 20 : 30;
  let fu = 20;
  if (ctx.menzen && !ctx.tsumo) fu += 10; // Menzen-Ron
  if (ctx.tsumo) fu += 2;
  const all = [...d.blocks, ...melds];
  for (const b of all) {
    if (b.type === 'pung' || b.type === 'kong') {
      const term = isTermOrHonor(b.tile);
      let base = b.type === 'kong' ? 8 : 2;
      if (term) base *= 2;
      if (b.concealed) base *= 2;
      fu += base;
    }
  }
  // Paar-Fu (Yakuhai-Paar = 2)
  if (YAKUHAI_DRAGON.includes(d.pair)) fu += 2;
  if (d.pair === ctx.seatWind) fu += 2;
  if (d.pair === ctx.roundWind) fu += 2;
  // Warte-Fu (Kanchan/Penchan/Tanki = 2). Vereinfachte Schätzung: +2 wenn Gewinnstein Paar bildet.
  if (d.pair === ctx.winTile) fu += 2;
  return Math.ceil(fu / 10) * 10;
}

// Punkte aus Han/Fu (aufgerundet auf 100).
export function pointsFromHanFu(han: number, fu: number, dealer: boolean, tsumo: boolean): number {
  let base: number;
  if (han >= 13) base = 8000;
  else if (han >= 11) base = 6000;
  else if (han >= 8) base = 4000;
  else if (han >= 6) base = 3000;
  else if (han >= 5) base = 2000;
  else {
    base = fu * Math.pow(2, 2 + han);
    if (base > 2000) base = 2000; // Kiriage/Mangan-Deckel
  }
  const round100 = (x: number) => Math.ceil(x / 100) * 100;
  if (tsumo) {
    // Rückgabe: Gesamtpunkte (Summe aller Zahlungen)
    if (dealer) return round100(base * 2) * 3;
    return round100(base * 2) + round100(base) * 2;
  }
  return round100(base * (dealer ? 6 : 4));
}

// Chiitoitsu (sieben Paare) prüfen.
function isChiitoitsu(counts: ArrayLike<number>): boolean {
  let pairs = 0;
  for (let i = 0; i < 34; i++) { if (counts[i] === 2) pairs++; else if (counts[i] !== 0) return false; }
  return pairs === 7;
}
// Kokushi (dreizehn Waisen).
function isKokushi(counts: ArrayLike<number>): boolean {
  const terms = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  let pair = false, total = 0;
  for (let i = 0; i < 34; i++) {
    if (!terms.includes(i)) { if (counts[i] > 0) return false; continue; }
    if (counts[i] === 0) return false;
    if (counts[i] === 2) pair = true;
    total += counts[i];
  }
  return pair && total === 14;
}

// Beste Wertung einer vollständigen Hand (14 Steine als concealedCounts inkl. Gewinnstein, + Melds).
export function scoreHand(concealedCounts: ArrayLike<number>, melds: Block[], ctx: WinCtx, dealer: boolean): Scored {
  // Yakuman-Sonderformen
  if (isKokushi(concealedCounts)) {
    return { han: 13, fu: 0, yaku: [{ name: 'kokushi', han: 13 }], yakuman: true, points: pointsFromHanFu(13, 0, dealer, ctx.tsumo) };
  }

  let best: Scored | null = null;
  const consider = (yaku: { name: string; han: number }[], fu: number, yakuman: number) => {
    let han = yaku.reduce((s, y) => s + y.han, 0);
    if (ctx.riichi) { yaku.push({ name: 'riichi', han: 1 }); han += 1; }
    if (ctx.ippatsu) { yaku.push({ name: 'ippatsu', han: 1 }); han += 1; }
    if (ctx.menzen && ctx.tsumo) { yaku.push({ name: 'menzen tsumo', han: 1 }); han += 1; }
    const hasYaku = han > 0 || yakuman > 0;
    if (!hasYaku) return; // ohne Yaku kein gültiger Gewinn
    if (ctx.doraCount > 0) { yaku.push({ name: 'dora', han: ctx.doraCount }); han += ctx.doraCount; }
    const points = yakuman > 0
      ? pointsFromHanFu(13 * yakuman, 0, dealer, ctx.tsumo)
      : pointsFromHanFu(han, fu, dealer, ctx.tsumo);
    const scored: Scored = { han: yakuman > 0 ? 13 * yakuman : han, fu, yaku, yakuman: yakuman > 0, points };
    if (!best || scored.points > best.points) best = scored;
  };

  // Chiitoitsu (nur verdeckt)
  if (ctx.menzen && isChiitoitsu(concealedCounts)) consider([{ name: 'chiitoitsu', han: 2 }], 25, 0);

  const setsNeeded = 4 - melds.length;
  for (const d of decompose(concealedCounts, setsNeeded)) {
    const { yaku, yakuman } = evalStandard(d, melds, ctx);
    const hasPinfu = yaku.some((y) => y.name === 'pinfu');
    const fu = calcFu(d, melds, ctx, hasPinfu);
    consider(yaku.slice(), fu, yakuman);
  }

  if (best) return best;
  return { han: 0, fu: 0, yaku: [], yakuman: false, points: 0 }; // kein Yaku
}

// Dora aus Indikatoren zählen: der Dora ist der jeweils NÄCHSTE Stein.
export function nextDora(indicatorIndex: number): number {
  const i = indicatorIndex;
  if (i < 27) { const r = i % 9; const s = (i / 9) | 0; return s * 9 + ((r + 1) % 9); }
  if (i <= 30) return 27 + ((i - 27 + 1) % 4); // Winde zyklisch
  return 31 + ((i - 31 + 1) % 3);              // Drachen zyklisch
}
export function countDora(allTileIndices: number[], indicators: number[]): number {
  let n = 0;
  const doras = indicators.map(nextDora);
  for (const t of allTileIndices) for (const d of doras) if (t === d) n++;
  return n;
}

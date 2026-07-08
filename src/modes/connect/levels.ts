// Mahjong Connect — Schwierigkeitsrampe (formelbasiert = endlos).
// rows*cols ist immer gerade (cols wird bei Bedarf angepasst).

export interface ConnectConfig {
  rows: number;
  cols: number;
  faces: number; // Anzahl verschiedener Steinsorten
}

export function connectConfig(level: number): ConnectConfig {
  const lv = Math.max(1, level);
  // Wächst sanft: Start 6×6, bis max. 8×10.
  let rows = Math.min(6 + Math.floor((lv - 1) / 3), 8);
  let cols = Math.min(6 + Math.floor((lv - 1) / 2), 10);
  if ((rows * cols) % 2 !== 0) cols += 1; // gerade Anzahl erzwingen
  const faces = Math.min(9 + Math.floor((lv - 1) / 2), 20);
  return { rows, cols, faces };
}

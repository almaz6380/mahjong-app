// Lawine — Schwierigkeitsrampe (formelbasiert = endlos).
// rows*cols ist immer gerade (cols wird bei Bedarf angepasst).
// Start 7×6 mit nur 6 Sorten: Die Zugregel (benachbart oder freie Linie) ist
// strenger als Connects 2-Kurven-Wege — viele Dubletten halten den Einstieg leicht.

export interface LawineConfig {
  rows: number;
  cols: number;
  faces: number; // Anzahl verschiedener Steinsorten
}

export function lawineConfig(level: number): LawineConfig {
  const lv = Math.max(1, level);
  // Wächst sanft: Start 7×6 (nach Paritätsanpassung), bis max. 9×8.
  const rows = Math.min(7 + Math.floor((lv - 1) / 4), 9);
  let cols = Math.min(5 + Math.floor((lv - 1) / 3), 8);
  if ((rows * cols) % 2 !== 0) cols += 1; // gerade Anzahl erzwingen
  // Deckel 14, nicht 18: Mehr Sorten heißt mehr Sackgassen (gemessen, siehe
  // Kopfkommentar in logic.ts) — die Schwierigkeit soll aus der Brettgröße
  // kommen, nicht aus Mischen-Toasts.
  const faces = Math.min(6 + Math.floor((lv - 1) / 3), 14);
  return { rows, cols, faces };
}

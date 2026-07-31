// Gemeinsame Schnittstelle, die jeder Spezialmodus vom App-Rahmen bekommt.

export interface ModeApi {
  coins: number; // aktueller Stand, für die Kaufabfrage
  addCoins: (n: number) => void;
  spendCoins: (n: number) => boolean;
  recordModeBest: (key: string, value: number, higher?: boolean) => boolean;
  bestOf: (key: string) => number | undefined;
}

export interface ModeProps {
  api: ModeApi;
  onExit: () => void;
}

export type ModeId = 'memory' | 'merge' | 'sudoku' | 'match3' | 'tilematch' | 'blitz' | 'dimensions';

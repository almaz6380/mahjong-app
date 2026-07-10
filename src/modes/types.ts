// Gemeinsame Schnittstelle, die jeder Spezialmodus vom App-Rahmen bekommt.

export interface ModeApi {
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

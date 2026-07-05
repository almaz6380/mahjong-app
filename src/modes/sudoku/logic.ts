// Sudoku: Generator (eindeutig lösbar) + Solver. Board = number[81], 0 = leer.

export type Board = number[];
export type Difficulty = 'easy' | 'normal' | 'hard';
const GIVENS: Record<Difficulty, number> = { easy: 40, normal: 32, hard: 26 };

function shuffled(rand: () => number): number[] {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function canPlace(b: Board, pos: number, val: number): boolean {
  const r = (pos / 9) | 0;
  const c = pos % 9;
  for (let i = 0; i < 9; i++) {
    if (b[r * 9 + i] === val) return false;
    if (b[i * 9 + c] === val) return false;
  }
  const br = (r / 3 | 0) * 3;
  const bc = (c / 3 | 0) * 3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      if (b[(br + i) * 9 + (bc + j)] === val) return false;
  return true;
}

// Zählt Lösungen bis maximal `limit` (für Eindeutigkeit reicht limit=2).
export function countSolutions(board: Board, limit = 2, rand?: () => number): number {
  const b = board.slice();
  let count = 0;
  const rec = (): boolean => {
    let pos = -1;
    for (let i = 0; i < 81; i++) if (b[i] === 0) { pos = i; break; }
    if (pos === -1) { count++; return count >= limit; }
    const order = rand ? shuffled(rand) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const v of order) {
      if (canPlace(b, pos, v)) {
        b[pos] = v;
        if (rec()) { b[pos] = 0; return true; }
        b[pos] = 0;
      }
    }
    return false;
  };
  rec();
  return count;
}

function fullSolution(rand: () => number): Board {
  const b: Board = new Array(81).fill(0);
  const rec = (): boolean => {
    let pos = -1;
    for (let i = 0; i < 81; i++) if (b[i] === 0) { pos = i; break; }
    if (pos === -1) return true;
    for (const v of shuffled(rand)) {
      if (canPlace(b, pos, v)) {
        b[pos] = v;
        if (rec()) return true;
        b[pos] = 0;
      }
    }
    return false;
  };
  rec();
  return b;
}

export interface Puzzle {
  puzzle: Board;
  solution: Board;
  given: boolean[];
}

export function generate(difficulty: Difficulty, rand: () => number = Math.random): Puzzle {
  const solution = fullSolution(rand);
  const puzzle = solution.slice();
  const target = GIVENS[difficulty];
  // Zellen in zufälliger Reihenfolge entfernen, solange Lösung eindeutig bleibt.
  const order = Array.from({ length: 81 }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }
  let remaining = 81;
  for (const pos of order) {
    if (remaining <= target) break;
    const backup = puzzle[pos];
    puzzle[pos] = 0;
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[pos] = backup; // Entfernen würde Mehrdeutigkeit erzeugen
    } else {
      remaining--;
    }
  }
  const given = puzzle.map((v) => v !== 0);
  return { puzzle, solution, given };
}

export function isComplete(board: Board): boolean {
  return board.every((v) => v !== 0);
}

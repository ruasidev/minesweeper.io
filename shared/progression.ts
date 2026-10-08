// Levels and how hard a board is. Imported by the site and the server, so this file must not import anything else

// How hard a board is, as one number: its mines, times how densely they are packed.
// Beginner comes to about 1.2, Intermediate 6.3 and Expert 20; a 4x4 board with one mine to 0.06.
// Capped, so that a board packed solid with mines (won by luck, if at all) isn't worth a fortune
export function boardDifficulty({ rows, cols, mines }: { rows: number, cols: number, mines: number }): number {
  return Math.min(30, mines * mines / (rows * cols))
}

// The experience a level starts at. Each level takes 100 more than the one before:
// level 2 starts at 100, level 3 at 300, level 4 at 600, level 10 at 4500
export const xpForLevel = (level: number): number => 50 * level * (level - 1)

// The level that much experience comes to. Everyone starts at level 1
export const levelFromXp = (xp: number): number => Math.floor((1 + Math.sqrt(1 + 4 * Math.max(0, xp) / 50)) / 2)

// What a new player's rating is
export const STARTING_ELO = 1000

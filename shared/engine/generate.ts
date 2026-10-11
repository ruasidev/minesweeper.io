// Making a board: where its mines go.
//
// The mines are laid by the board generator, which is written in Rust (crates/boardgen) and runs here as
// WebAssembly: boardgen.ts is the door to it. What it promises:
//
// - A board is its seed. The same settings, seed, opening and options give the same board, byte for byte, on the
//   server, in the browser and in the tests. crates/boardgen/tests/vectors.json holds boards it is on record as
//   making, and both its own tests and generate.test.ts here hold it to them.
// - The cell a board opens on never has a mine, and neither do the cells around it: the first click always opens
//   up a patch and never a lone number.
// - Unless it is asked not to, it makes a board that can be cleared from its opening by reasoning alone, without
//   a single guess. It does that by playing the board through, the way a careful player would, before handing it
//   over (see "Board generation" in the README).

import { makeBoard, type MadeBoard } from "./boardgen.js"
import { fieldOf, type BoardSettings, type Field } from "./field.js"

// the smallest and largest a board can be each way, and the most mines one can be given
export const BOARD_SIZE_MIN = 4
export const BOARD_SIZE_MAX = 99
export const MINES_MAX = 99

// The most mines a board can hold while keeping the opening and the cells around it clear
// (at its worst, an opening with all eight of its neighbours on the board)
export const maxMines = (rows: number, cols: number): number => rows * cols - Math.min(rows, 3) * Math.min(cols, 3)

const isIntBetween = (value: unknown, low: number, high: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= low && value <= high

// The settings in something that came from outside (a message, a saved choice), if it holds a board that can be made
export function boardSettingsFrom(value: unknown): BoardSettings | null {
  const { rows, cols, mines } = (value ?? {}) as Record<string, unknown>
  const possible =
    isIntBetween(rows, BOARD_SIZE_MIN, BOARD_SIZE_MAX)
    && isIntBetween(cols, BOARD_SIZE_MIN, BOARD_SIZE_MAX)
    && isIntBetween(mines, 1, Math.min(MINES_MAX, maxMines(rows, cols)))
  return possible ? { rows, cols, mines } : null
}

export type BoardOptions = {
  // The cell the board opens on (row * cols + col): a player's first click, say. Left out, one is picked
  opening?: number
  // Whether the board must be one that can be cleared without a guess. It must unless this says otherwise: with
  // `false` the mines fall wherever chance puts them, and the board may well need a guess, or several
  guessFree?: boolean
}

// What was made. `guessFree` says whether the board is known to need no guess: always, when that was asked for,
// except on a board so crowded with mines that none could be found in the time a board is allowed to take (which
// no board that can be asked for here has been seen to be); never when it wasn't asked for, since nobody looked
export type GeneratedBoard = MadeBoard

// Settings and a seed in, a board out. Throws a RangeError for a board that can't be made: more mines than fit
// around the opening, an opening off the board, a seed that isn't 16 bytes or is all zeroes
export function generateBoard(settings: BoardSettings, seed: Uint8Array, options: BoardOptions = {}): GeneratedBoard {
  return makeBoard(settings.rows, settings.cols, settings.mines, seed, options.opening, options.guessFree ?? true)
}

export type GeneratedField = {
  opening: number
  field: Field
  guessFree: boolean
}

// ...and the same as a field, numbers and all, ready to be played on
export function generateField(settings: BoardSettings, seed: Uint8Array, options: BoardOptions = {}): GeneratedField {
  const board = generateBoard(settings, seed, options)
  return { opening: board.opening, field: fieldOf(settings.rows, settings.cols, board.mines), guessFree: board.guessFree }
}

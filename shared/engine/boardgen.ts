// The door to the board generator.
//
// Boards are made by a program written in Rust (crates/boardgen), which runs here as WebAssembly: the very same
// code on the server, in the browser and in the tests. This file loads it and turns a call into the numbers and
// bytes it deals in. What a board is asked to be, and what comes back, is generate.ts's business.
//
// The module is loaded as this file is, before anything that imports it runs, so making a board is an ordinary
// function call that answers at once. (It is loaded with `instantiate` and awaited, not built on the spot, because
// some browsers won't build a module of this size in the middle of other work.)

import encoded from "./boardgen.wasm.js"
import { SEED_BYTES } from "./seed.js"

// what the module offers (crates/boardgen/src/wasm.rs)
type Boardgen = {
  memory: WebAssembly.Memory
  boardgen_reserve: (length: number) => number
  boardgen_release: (at: number, length: number) => void
  boardgen_generate: (
    rows: number, cols: number, mines: number, opening: number, guarantee: number, seedAt: number, layoutAt: number,
  ) => number
}

const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
const { instance } = await WebAssembly.instantiate(bytes)
const boardgen = instance.exports as unknown as Boardgen

// the longest a side of a board can be there (SIDE_MAX)
const SIDE_MAX = 1024
// what the opening is given as when the board is to pick its own
const NO_OPENING = -1
// what the board is to be: laid by chance alone, or one that needs no guess
const GUARANTEE_NONE = 0
const GUARANTEE_GUESS_FREE = 1
// set in the answer when the board is known to need no guess: the rest of the answer is the cell it opens on
const GUESS_FREE = 1 << 30

// why a board couldn't be made, by the answer that says so (-1, -2, ...)
const REFUSALS = [
  "There is no board of that size",
  "There isn't room for that many mines clear of the opening",
  "The opening isn't a cell of the board",
  "A seed can't be all zeroes",
]

const isSide = (length: number): boolean => Number.isInteger(length) && length >= 1 && length <= SIDE_MAX

export type MadeBoard = {
  // the cell the board opens on: the one asked for, or the one picked
  opening: number
  // one byte per cell, row after row: 1 a mine, 0 not
  mines: Uint8Array
  // whether the board is known to need no guess
  guessFree: boolean
}

// Has a board made. `opening` is a cell (row * cols + col), or left out to have one picked.
// Throws a RangeError for a board that can't be made
export function makeBoard(rows: number, cols: number, mines: number, seed: Uint8Array, opening: number | undefined, guessFree: boolean): MadeBoard {
  if (!isSide(rows) || !isSide(cols)) throw new RangeError(REFUSALS[0])
  if (seed.length !== SEED_BYTES) throw new RangeError(`A seed is ${SEED_BYTES} bytes, not ${seed.length}`)
  if (!Number.isInteger(mines) || mines < 0) throw new RangeError(REFUSALS[1])
  if (opening !== undefined && !(Number.isInteger(opening) && opening >= 0)) throw new RangeError(REFUSALS[2])

  // room in the module's memory for the seed going in and the mines coming out
  const cells = rows * cols
  const length = SEED_BYTES + cells
  const at = boardgen.boardgen_reserve(length) >>> 0
  try {
    new Uint8Array(boardgen.memory.buffer, at, SEED_BYTES).set(seed)
    const answer = boardgen.boardgen_generate(
      rows, cols, mines, opening ?? NO_OPENING, guessFree ? GUARANTEE_GUESS_FREE : GUARANTEE_NONE, at, at + SEED_BYTES,
    )
    if (answer < 0) throw new RangeError(REFUSALS[-answer - 1] ?? `The board couldn't be made (${answer})`)
    return {
      opening: answer & (GUESS_FREE - 1),
      // the memory is looked up afresh: it may have grown, and so moved, while the board was being made
      mines: new Uint8Array(boardgen.memory.buffer, at + SEED_BYTES, cells).slice(),
      guessFree: (answer & GUESS_FREE) !== 0,
    }
  } finally {
    boardgen.boardgen_release(at, length)
  }
}

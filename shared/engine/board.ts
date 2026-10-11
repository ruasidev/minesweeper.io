// A board being played: what has been uncovered and flagged on a field, and what a move does to it.
//
// A board is never changed in place. A move gives back a new one (or the very same one, if it did nothing), which
// costs one copy of a byte per cell: cheap enough to keep every board of a game for playing it back.
// Underneath are the rules of the classic game, in which uncovering a mine is the end. What else a mine can do
// (a MineRule) is built on top of them, in `press`: the one way in for a click, whatever the game.

import { forEachNeighbour, safeCells, type Field } from "./field.js"

// what a cell of a board is, one byte each
export const COVERED = 0
export const UNCOVERED = 1
export const FLAGGED = 2

// "lost" is having uncovered a mine, "won" having uncovered everything else
export type BoardStatus = "playing" | "won" | "lost"

export type Board = {
  readonly field: Field
  // one byte per cell, row after row: COVERED, UNCOVERED or FLAGGED
  readonly cells: Uint8Array
  // how many cells that aren't mines are uncovered
  readonly uncovered: number
  readonly flagged: number
  readonly status: BoardStatus
}

// in place of a cell, where there isn't one to give
export const NO_CELL = -1

// What uncovering did
export type Played = {
  // the board afterwards: the same one if nothing changed
  board: Board
  // the mine it uncovered, or NO_CELL
  mine: number
}

// A field with everything on it still covered
export function coveredBoard(field: Field): Board {
  return { field, cells: new Uint8Array(field.rows * field.cols), uncovered: 0, flagged: 0, status: "playing" }
}

const unchanged = (board: Board): Played => ({ board, mine: NO_CELL })

// Uncovers a covered cell that isn't a mine, in place, and if there are no mines around it, everything that opens
// up from there: its neighbours, and on through any of those with nothing around them either. Flags are left alone.
// Returns how many cells that uncovered
function openUp(field: Field, cells: Uint8Array, from: number): number {
  const { rows, cols, mines, counts } = field
  let opened = 0
  const waiting = [from]
  const queue = (neighbour: number) => {
    if (cells[neighbour] === COVERED && !mines[neighbour]) waiting.push(neighbour)
  }
  while (waiting.length > 0) {
    const at = waiting.pop()!
    // reached a second time, by way of another neighbour
    if (cells[at] !== COVERED) continue
    cells[at] = UNCOVERED
    opened++
    if (counts[at] === 0) forEachNeighbour(rows, cols, at, queue)
  }
  return opened
}

// Uncovers `targets` one after another on a copy of the board's cells, stopping at the first mine
function uncoverAll(board: Board, targets: number[]): Played {
  const { field } = board
  const cells = board.cells.slice()
  let uncovered = board.uncovered
  for (const at of targets) {
    if (cells[at] !== COVERED) continue
    if (field.mines[at]) {
      cells[at] = UNCOVERED
      return { board: { ...board, cells, uncovered, status: "lost" }, mine: at }
    }
    uncovered += openUp(field, cells, at)
  }
  if (uncovered === board.uncovered) return unchanged(board)
  return { board: { ...board, cells, uncovered, status: uncovered === safeCells(field) ? "won" : "playing" }, mine: NO_CELL }
}

// Uncovers a covered cell. A mine there loses the board
export function uncover(board: Board, at: number): Played {
  if (board.status !== "playing" || board.cells[at] !== COVERED) return unchanged(board)
  return uncoverAll(board, [at])
}

// How many of the cells around this one the player has down as mines: the flagged ones, and any mine lying
// uncovered (which there can be where a mine doesn't end the game)
export function knownMinesAround(board: Board, at: number): number {
  const { field, cells } = board
  let known = 0
  forEachNeighbour(field.rows, field.cols, at, (neighbour) => {
    if (cells[neighbour] === FLAGGED || (cells[neighbour] === UNCOVERED && field.mines[neighbour])) known++
  })
  return known
}

// Chording: an uncovered number with exactly that many mines marked around it uncovers the rest of its neighbours.
// If a flag is in the wrong place, one of those is a mine. (An uncovered mine is not a number: it has nothing to chord.)
export function chord(board: Board, at: number): Played {
  const { field } = board
  if (board.status !== "playing" || board.cells[at] !== UNCOVERED || field.mines[at]) return unchanged(board)
  if (knownMinesAround(board, at) !== field.counts[at]) return unchanged(board)

  const around: number[] = []
  forEachNeighbour(field.rows, field.cols, at, neighbour => around.push(neighbour))
  return uncoverAll(board, around)
}

// Flags a covered cell, or takes its flag off
export function toggleFlag(board: Board, at: number): Board {
  const now = board.cells[at]
  if (board.status !== "playing" || now === UNCOVERED) return board
  const cells = board.cells.slice()
  cells[at] = now === FLAGGED ? COVERED : FLAGGED
  return { ...board, cells, flagged: board.flagged + (now === FLAGGED ? -1 : 1) }
}

// Covers back up everything uncovered within `radius` cells of one (as the crow flies), except mines: a mine
// that has been uncovered stays that way. Flags stay where they are
export function coverAround(board: Board, at: number, radius: number): Board {
  const { rows, cols, mines } = board.field
  const row = Math.floor(at / cols)
  const col = at - row * cols
  const reach = Math.floor(radius)
  const cells = board.cells.slice()
  let covered = 0
  // only the square the circle sits in is looked at, not the whole board
  for (let r = Math.max(0, row - reach); r <= Math.min(rows - 1, row + reach); r++) {
    for (let c = Math.max(0, col - reach); c <= Math.min(cols - 1, col + reach); c++) {
      const cell = r * cols + c
      if (cells[cell] !== UNCOVERED || mines[cell] || (r - row) ** 2 + (c - col) ** 2 > radius ** 2) continue
      cells[cell] = COVERED
      covered++
    }
  }
  return covered === 0 ? board : { ...board, cells, uncovered: board.uncovered - covered }
}

// What uncovering a mine does to a player's game
export type MineRule =
  // it is the end of it: the classic game
  | { kind: "ends" }
  // It goes off and the game goes on: everything uncovered within `radius` cells of it is covered back up.
  // The mine itself stays uncovered, so it can't be walked into twice
  | { kind: "blast", radius: number }

// What a click on a cell does: uncovers it, or chords it if it is uncovered already. Every game is played through
// this, on the server and in the browser, live and played back, so that a move can only ever mean one thing
export function press(board: Board, at: number, onMine: MineRule): Played {
  const played = board.cells[at] === UNCOVERED ? chord(board, at) : uncover(board, at)
  if (played.mine === NO_CELL || onMine.kind === "ends") return played
  return { board: coverAround({ ...played.board, status: "playing" }, played.mine, onMine.radius), mine: played.mine }
}

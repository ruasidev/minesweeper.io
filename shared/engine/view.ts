// A board as its player sees it: one character per cell, row after row. It is what the server sends, and what the
// site draws from. Nothing about a covered cell is in it: mine or not, they all look the same

import { FLAGGED, UNCOVERED, type Board } from "./board.js"
import { forEachNeighbour } from "./field.js"

// One of these, or "0" to "8" for an uncovered cell with that many mines around it
export const CELL_HIDDEN = "."
export const CELL_FLAGGED = "F"
export const CELL_MINE = "*"

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8"]

export function viewOf(board: Board): string {
  const { field, cells } = board
  const view = new Array<string>(cells.length)
  for (let at = 0; at < cells.length; at++) {
    view[at] = cells[at] === FLAGGED ? CELL_FLAGGED
      : cells[at] !== UNCOVERED ? CELL_HIDDEN
      : field.mines[at] ? CELL_MINE
      : DIGITS[field.counts[at]]
  }
  return view.join("")
}

// whether a cell of a view has been uncovered: a number, or a mine lying open
export const isUncovered = (cell: string): boolean => cell !== CELL_HIDDEN && cell !== CELL_FLAGGED

// the number on an uncovered cell of a view: none for a covered cell, a flag or a mine
export const numberOn = (cell: string): number | null => (cell >= "0" && cell <= "8" ? cell.charCodeAt(0) - 48 : null)

// Whether a click on a cell of a view would chord it: an uncovered number with exactly that many mines marked around
// it. The same test the engine makes on the board itself (`chord`), for a player who only has the view: it lets the
// site say that a chord isn't ready yet without asking the server
export function canChord(view: string, rows: number, cols: number, at: number): boolean {
  const number = numberOn(view[at])
  if (number === null) return false
  let marked = 0
  forEachNeighbour(rows, cols, at, (neighbour) => {
    if (view[neighbour] === CELL_FLAGGED || view[neighbour] === CELL_MINE) marked++
  })
  return marked === number
}

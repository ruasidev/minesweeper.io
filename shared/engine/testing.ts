// For tests: boards drawn as text, so a test reads like the board it is about and a failed one shows a board
// rather than a wall of numbers

import { FLAGGED, UNCOVERED, coveredBoard, press, type Board } from "./board.js"
import { cellAt, fieldOf, type Field } from "./field.js"

// A field drawn a row to a line: "*" for a mine, "." for anything else
export function fieldDrawn(...rows: string[]): Field {
  const mines = Uint8Array.from(rows.join(""), cell => (cell === "*" ? 1 : 0))
  return fieldOf(rows.length, rows[0].length, mines)
}

// ...and the same with everything on it still covered
export const boardDrawn = (...rows: string[]): Board => coveredBoard(fieldDrawn(...rows))

// ...and as the text a record of a game keeps its mines in
export const layoutDrawn = (...rows: string[]): string => rows.join("").replaceAll("*", "1").replaceAll(".", "0")

// A board as a drawing of what its player sees: "#" covered, "F" flagged, "*" an uncovered mine, and otherwise the
// number on the cell ("." for none)
export function draw(board: Board): string[] {
  const { rows, cols, mines, counts } = board.field
  return Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => {
    const at = cellAt(cols, row, col)
    return board.cells[at] === FLAGGED ? "F"
      : board.cells[at] !== UNCOVERED ? "#"
      : mines[at] ? "*"
      : counts[at] === 0 ? "." : String(counts[at])
  }).join(""))
}

// the cell of a board at a row and column
export const at = (board: Board, row: number, col: number): number => cellAt(board.field.cols, row, col)

// Clicks one cell after another, by the classic rules
export function click(board: Board, ...cells: [row: number, col: number][]): Board {
  return cells.reduce((now, [row, col]) => press(now, at(now, row, col), { kind: "ends" }).board, board)
}

// a seed that is the same every time: sixteen bytes counting up from `first`
export const seedFrom = (first: number): Uint8Array => Uint8Array.from({ length: 16 }, (_, at) => (first + at) & 0xff)

export const hex = (bytes: Uint8Array): string => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")
export const fromHex = (text: string): Uint8Array => Uint8Array.from(text.match(/../g) ?? [], byte => parseInt(byte, 16))

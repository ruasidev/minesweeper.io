// For tests: positions drawn as text, the way a player sees them

import { CELL_FLAGGED, CELL_HIDDEN } from "../engine/view.js"
import { MINE, SAFE, type Position } from "./logic.js"

// A position drawn a row to a line: "#" covered, "F" flagged, a digit for a number, "." for an uncovered cell with
// nothing around it
export function positionDrawn(...rows: string[]): Position {
  const cells = rows.join("").replaceAll(".", "0").replaceAll("#", CELL_HIDDEN).replaceAll("F", CELL_FLAGGED)
  return { rows: rows.length, cols: rows[0].length, cells }
}

// What has been proved, drawn over the same grid: "*" a mine, "s" safe, "." nothing
export function drawProved(position: Position, known: Uint8Array): string[] {
  return Array.from({ length: position.rows }, (_, row) => Array.from({ length: position.cols }, (_, col) => {
    const verdict = known[row * position.cols + col]
    return verdict === MINE ? "*" : verdict === SAFE ? "s" : "."
  }).join(""))
}

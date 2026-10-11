import { CELL_FLAGGED, CELL_HIDDEN, CELL_MINE } from "../../shared/engine/view"

// A mine going off in a game where that doesn't end it: where the mine is, and the cells its blast covered back up
export type Blast = {
  // different for every blast, so one going off right where the last did still plays
  id: number
  row: number
  col: number
  // "row,col" of each cell covered back up
  covered: Set<string>
}

let nextBlastId = 1

// What a mine going off did to a board, worked out from how the board differs from the one before it: a mine
// uncovered that wasn't, and the cells that are covered again. Null when the change wasn't a mine going off
// (or the two aren't the same board at all)
export function blastBetween(before: string, after: string, cols: number): Blast | null {
  if (before.length !== after.length) return null
  let mine = -1
  const covered = new Set<string>()
  for (let at = 0; at < after.length; at++) {
    if (after[at] === before[at]) continue
    if (after[at] === CELL_MINE) mine = at
    else if (after[at] === CELL_HIDDEN && before[at] !== CELL_FLAGGED) covered.add(`${Math.floor(at / cols)},${at % cols}`)
  }
  return mine < 0 ? null : { id: nextBlastId++, row: Math.floor(mine / cols), col: mine % cols, covered }
}

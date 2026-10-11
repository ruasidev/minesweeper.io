// What can be worked out about a board: how many clicks it takes, and how far along a player is on it

import { UNCOVERED, type Board } from "./board.js"
import { forEachNeighbour, safeCells } from "./field.js"

// The fewest clicks a board can be cleared in, counting only what is still covered: one for every patch of
// empty cells not yet opened (a click on any of them opens the whole patch and the numbers around it), and one for
// every covered number that touches no empty cell at all. On a board just opened this is what players call its 3BV
export function clicksNeeded(board: Board): number {
  const { field, cells } = board
  const { rows, cols, mines, counts } = field
  const total = rows * cols
  const isEmpty = (at: number): boolean => !mines[at] && counts[at] === 0

  let clicks = 0
  // the empty cells already counted, as part of a patch
  const counted = new Uint8Array(total)
  const patch: number[] = []
  const spread = (neighbour: number) => {
    if (isEmpty(neighbour) && !counted[neighbour]) {
      counted[neighbour] = 1
      patch.push(neighbour)
    }
  }
  let besideEmpty = false
  const look = (neighbour: number) => {
    if (isEmpty(neighbour)) besideEmpty = true
  }

  for (let at = 0; at < total; at++) {
    if (mines[at] || cells[at] === UNCOVERED) continue
    if (!isEmpty(at)) {
      besideEmpty = false
      forEachNeighbour(rows, cols, at, look)
      if (!besideEmpty) clicks++
      continue
    }
    if (counted[at]) continue
    // a patch of empty cells nobody has opened yet
    clicks++
    counted[at] = 1
    patch.push(at)
    while (patch.length > 0) forEachNeighbour(rows, cols, patch.pop()!, spread)
  }
  return clicks
}

// A board is cut into at most this many sections along its longer side for showing a player's progress to others:
// the small pixelated board. A section is never smaller than 2x2 cells: everyone plays the same board, so showing
// an opponent's progress cell by cell would show exactly which cells are safe
const SECTIONS_ALONG_LONG_SIDE = 12
const SECTION_SIZE_MIN = 2

// how many cells a section of a board is, each way
export function sectionSizeOf(rows: number, cols: number): number {
  return Math.max(SECTION_SIZE_MIN, Math.ceil(Math.max(rows, cols) / SECTIONS_ALONG_LONG_SIDE))
}

export type SectionProgress = {
  // how finished each section is, 0 to `levels`, row after row
  sections: number[]
  // how much of the whole board has been uncovered, 0 to 1
  share: number
}

// How far along a board is, section by section. The same for a game being played and for one being played back,
// so the two look alike
export function sectionProgress(board: Board, sectionSize: number, levels: number): SectionProgress {
  const { field, cells } = board
  const { rows, cols, mines } = field
  const sectionCols = Math.ceil(cols / sectionSize)
  const sectionCount = Math.ceil(rows / sectionSize) * sectionCols
  const safeTotal = safeCells(field)
  const share = safeTotal === 0 ? 1 : board.uncovered / safeTotal

  // per section: how many safe cells it has, and how many of those are uncovered
  const safe = new Uint16Array(sectionCount)
  const uncovered = new Uint16Array(sectionCount)
  for (let row = 0; row < rows; row++) {
    const sectionRow = Math.floor(row / sectionSize) * sectionCols
    for (let col = 0; col < cols; col++) {
      const at = row * cols + col
      if (mines[at]) continue
      const section = sectionRow + Math.floor(col / sectionSize)
      safe[section]++
      if (cells[at] === UNCOVERED) uncovered[section]++
    }
  }

  const sections = new Array<number>(sectionCount)
  for (let section = 0; section < sectionCount; section++) {
    // A section that is nothing but mines has nothing to uncover. Showing it as done (or never done)
    // would give away where it is, so it just follows the board as a whole
    sections[section] = Math.floor(levels * (safe[section] === 0 ? share : uncovered[section] / safe[section]))
  }
  return { sections, share }
}

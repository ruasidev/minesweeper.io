// How big a board is drawn

// room kept around a board in the space it is panned about in, px
export const BOARD_EDGE = 8
// A board too big for the screen is shrunk to fit it, but only while its cells stay at least this big (px).
// Any smaller and a finger starts landing on the wrong one, so the board keeps its size and is panned instead
export const FIT_MIN = 28

// How long a row (or column) of cells is, px: the cells and the gaps between them
export const boardSpan = (cells: number, cellSize: number, gap: number): number => cells * cellSize + (cells - 1) * gap

// the biggest whole size of cell at which that many of them, with their gaps and the edges, fit in a space
const fitting = (space: number, cells: number, gap: number): number => Math.floor((space - 2 * BOARD_EDGE - (cells - 1) * gap) / cells)

// How big the cells of a board are drawn when nobody has zoomed it: the size chosen in the settings if the whole
// board fits at that, otherwise the biggest that fits, as long as the cells stay big enough to press
export function fittedSize(chosen: number, gap: number, rows: number, cols: number, room: { width: number, height: number }): number {
  // not measured yet
  if (!room.width || !room.height) return chosen
  const across = Math.min(chosen, fitting(room.width, cols, gap))
  const down = Math.min(chosen, fitting(room.height, rows, gap))
  // all of it in view
  if (Math.min(across, down) >= FIT_MIN) return Math.min(across, down)
  // or fitting one way, so it only has to be panned the other
  if (Math.max(across, down) >= FIT_MIN) return Math.max(across, down)
  return chosen
}

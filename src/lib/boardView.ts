import type { Board } from "../../shared/engine/board"
import { layoutText, type BoardSettings } from "../../shared/engine/field"
import { CELL_FLAGGED, CELL_HIDDEN, CELL_MINE, viewOf } from "../../shared/engine/view"
import type { OwnGame } from "../../shared/protocol"

// A board as it is drawn. Everything that draws one draws it from this, whoever is running the game: the server
// (which sends exactly these cells), the browser for someone playing without an account, or a replay.
// It holds what the player can see and nothing else, unless the mines have been told (`layout`)

// "ready" is a board nobody has played on yet: the singleplayer board before its first click
export type ViewStatus = "ready" | "playing" | "won" | "lost"

export type BoardView = {
  rows: number
  cols: number
  // how many mines the board has
  mines: number
  status: ViewStatus
  // one character per cell, row after row (see shared/engine/view.ts)
  cells: string
  // Where every mine is, one character per cell ("1" a mine, "0" not), where that is known: a game that is over
  // and may show them, or one being played back. Null while the mines are still the server's secret
  layout: string | null
  // how many cells that aren't mines are uncovered
  uncovered: number
  flagged: number
  // mines lying uncovered: one in a lost game, any number where a mine doesn't end it
  openMines: number
}

export function boardView(settings: BoardSettings, cells: string, status: ViewStatus, layout: string | null = null): BoardView {
  let uncovered = 0
  let flagged = 0
  let openMines = 0
  for (let at = 0; at < cells.length; at++) {
    const cell = cells[at]
    if (cell === CELL_FLAGGED) flagged++
    else if (cell === CELL_MINE) openMines++
    else if (cell !== CELL_HIDDEN) uncovered++
  }
  return { ...settings, status, cells, layout, uncovered, flagged, openMines }
}

// a board with everything on it covered, waiting for its first click
export const readyView = (settings: BoardSettings): BoardView =>
  boardView(settings, CELL_HIDDEN.repeat(settings.rows * settings.cols), "ready")

// A player's own game, as the server (or the browser's own running of it) reports it
export function viewOfGame(game: OwnGame): BoardView {
  const status = game.outcome === "cleared" ? "won" : game.outcome === "lost" ? "lost" : "playing"
  return boardView(game.settings, game.cells, status, game.layout)
}

// A board the browser holds in full, mines and all: one being played back
export function viewOfBoard(board: Board): BoardView {
  const { rows, cols, mineCount, mines } = board.field
  return boardView({ rows, cols, mines: mineCount }, viewOf(board), board.status, layoutText(mines))
}

// whether a cell is known to be a mine: uncovered as one, or told by the layout
export const isKnownMine = (view: BoardView, at: number): boolean =>
  view.cells[at] === CELL_MINE || view.layout?.[at] === "1"

// how many cells of a board aren't mines: what there is to uncover
export const safeCellsOf = ({ rows, cols, mines }: BoardSettings): number => rows * cols - mines

// How much of a board has been dealt with, uncovered or flagged, 0 to 100: what the singleplayer status bar counts up
export const progressOf = (view: BoardView): number =>
  view.status === "ready" ? 0 : Math.round(100 * (view.uncovered + view.flagged) / (view.rows * view.cols))

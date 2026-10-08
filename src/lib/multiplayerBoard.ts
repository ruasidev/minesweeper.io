import type { Board } from "../../shared/board"
import { CELL_FLAGGED, CELL_HIDDEN, CELL_MINE, type BoardSettings } from "../../shared/protocol"

// Turns a player's own board as the server sends it (one character per cell, row after row) into a board that
// can be drawn. Only what the player has uncovered is in it: every still-covered cell looks the same, mine or not
export function boardFromCells(settings: BoardSettings, cells: string, finished: boolean): Board {
  const { rows, cols, mines } = settings
  let revealedCount = 0
  let flaggedCount = 0

  const grid = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      const char = cells[row * cols + col]
      const flagged = char === CELL_FLAGGED
      const hasMine = char === CELL_MINE
      const revealed = !flagged && char !== CELL_HIDDEN
      if (flagged) flaggedCount++
      if (revealed && !hasMine) revealedCount++
      return { row, col, hasMine, revealed, flagged, neighborCount: revealed && !hasMine ? Number(char) : 0 }
    })
  )

  return { rows, cols, mines, status: finished ? "won" : "playing", revealedCount, flaggedCount, grid }
}

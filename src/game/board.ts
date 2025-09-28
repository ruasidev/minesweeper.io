// "Business logic" for the board
// Used by Board.tsx to generate the Board with the initial values

import type { Board, Cell } from "./types"

export function createBoard(rows: number, cols: number, mines: number): Board {
  const grid: Board = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => newCell(r, c))
  )

  // place mines
  let placed = 0
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows)
    const c = Math.floor(Math.random() * cols)
    if (!grid[r][c].hasMine) {
      grid[r][c].hasMine = true
      placed++
    }
  }

  // calculate neighbor counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].hasMine) continue
      grid[r][c].neighborCount = countNeighbors(grid, r, c)
    }
  }

  return grid
}

function newCell(r: number, c: number): Cell {
    return {
        row: r,
        col: c,
        hasMine: false,
        revealed: true,
        flagged: false,
        neighborCount: 0
    }
}

function countNeighbors(board: Board, row: number, col: number): number {
  const dirs = [-1, 0, 1]
  let count = 0
  for (let dr of dirs) {
    for (let dc of dirs) {
      if (dr === 0 && dc === 0) continue
      const nr = row + dr
      const nc = col + dc
      if (board[nr]?.[nc]?.hasMine) count++
    }
  }
  return count
}

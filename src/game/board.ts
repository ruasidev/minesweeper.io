// "Business logic" for the board
// Used by Board.tsx to generate the Board with the initial values

import type { Board, Cell } from "./types"

export function createBoard(rows: number, cols: number, mines?: number): Board {
  const grid: Cell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => newCell(r, c))
  )

  if(!mines) return { rows, cols, mines: 0, grid }

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

  return { rows, cols, mines, grid }
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

function countNeighbors(grid: Cell[][], row: number, col: number): number {
  const dirs = [-1, 0, 1]
  let count = 0
  for (let dr of dirs) {
    for (let dc of dirs) {
      if (dr === 0 && dc === 0) continue
      const nr = row + dr
      const nc = col + dc
      if (grid[nr]?.[nc]?.hasMine) count++
    }
  }
  return count
}

export function revealCell(board: Board, row: number, col: number): Board {
  const newGrid = copyGrid(board.grid)

  function cascadeReveal(r: number, c: number) {
    const cell = newGrid[r]?.[c]
    if(!cell || cell.revealed || cell.flagged) return

    cell.revealed = true

    if(!cell.hasMine && cell.neighborCount === 0) {
      for(let dr = -1; dr <= 1; dr++) {
        for(let dc = -1; dc <= 1; dc++) {
          if(dr === 0 && dc === 0) continue
          cascadeReveal(r + dr, c + dc)
        }
      }
    }
  }

  cascadeReveal(row, col)

  return { ...board, grid: newGrid }
}

export function flagCell(board: Board, row: number, col: number): Board {
  const newGrid = copyGrid(board.grid)
  const cell = newGrid[row][col]
  if(!cell.revealed) cell.flagged = !cell.flagged
  return { ...board, grid: newGrid }
}

function copyGrid(grid: Cell[][]): Cell[][] {
  return grid.map(row => row.map(cell => ({ ...cell })))
}
// "Business logic" for the board
// Used by Board.tsx to generate the Board with the initial values

import type { Board, Cell } from "./types"

export function createEmptyBoard(rows: number, cols: number): Board {
  const grid: Cell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length:cols }, (_, c) => newCell(r, c))
  )
  return { rows, cols, grid, mines: 0, status: "uninitialized", revealedCount: 0, flaggedCount: 0 }
}

export function populateBoard(board: Board, mines: number, safeR: number, safeC: number, { excludeAdj = true }: { excludeAdj?: boolean }): Board {
  const { rows, cols } = board
  const grid = copyGrid(board.grid)

  const forbidden = new Set<string>()
  forbidden.add(`${safeR},${safeC}`)
  if(excludeAdj) {
    for(const [nr, nc] of cellNeighbors(rows, cols, safeR, safeC)) {
      forbidden.add(`${nr},${nc}`)
    }
  }

  const pool: Array<[number, number]> = []
  for(let r = 0; r < rows; r++) {
    for(let c = 0; c < cols; c++) {
      if(!forbidden.has(`${r},${c}`)) pool.push([r, c])
    }
  }
  if(mines > pool.length) throw new Error("Too many mines for available safe cells")

  for(let i = 0; i < mines; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
    const [mr, mc] = pool[i]
    grid[mr][mc].hasMine = true
  }

  for(let r = 0; r < rows; r++) {
    for(let c = 0; c < cols; c++) {
      if(!grid[r][c].hasMine) grid[r][c].neighborCount = countNeighbors(grid, r, c)
    }
  }

  return { ...board, mines, status: "playing", grid }
}

function newCell(r: number, c: number): Cell {
    return {
        row: r,
        col: c,
        hasMine: false,
        revealed: false,
        flagged: false,
        neighborCount: 0
    }
}

function cellNeighbors(rows: number, cols: number, r: number, c: number) {
  const out: Array<[number, number]> = []
  for(let dr = -1; dr <= 1; dr++) {
    for(let dc = -1; dc <= 1; dc++) {
      if(dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if(nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc])
    }
  }
  return out
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
  const grid = copyGrid(board.grid)
  const cell = grid[row][col]
  if(!cell.revealed) {
    cell.flagged = !cell.flagged
    const flaggedCount = board.flaggedCount + (cell.flagged ? 1 : -1)
    return { ...board, grid, flaggedCount }
  }
  return board
}

function copyGrid(grid: Cell[][]): Cell[][] {
  return grid.map(row => row.map(cell => ({ ...cell })))
}
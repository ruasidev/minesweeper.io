// "Business logic" for the board
// Used by Board.tsx to generate the Board with the initial values

import type { Board, Cell } from "./types"

export function createEmptyBoard(rows: number, cols: number): Board {
  const grid: Cell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length:cols }, (_, c) => newCell(r, c))
  )
  return { rows, cols, grid, mines: 0, status: "uninitialized", revealedCount: 0, flaggedCount: 0 }
}

// Smallest allowed number of rows / cols
export const MIN_BOARD_SIZE = 4

// Most mines a board can hold while keeping the first click and its neighbors safe
// (worst case is a first click that has all of its neighbors on the board)
export function getMaxMines(rows: number, cols: number): number {
  return rows * cols - Math.min(rows, 3) * Math.min(cols, 3)
}

export function populateBoard(board: Board, mines: number, safeR: number, safeC: number, { excludeAdj = true }: { excludeAdj?: boolean }): Board {
  const { rows, cols } = board
  const grid = copyGrid(board.grid)

  // Build a set of coordinates that are off-limits for mines
  // Using set of strings for fast lookups
  const forbidden = new Set<string>()
  forbidden.add(`${safeR},${safeC}`)
  if(excludeAdj) {
    for(const [nr, nc] of cellNeighbors(rows, cols, safeR, safeC)) {
      forbidden.add(`${nr},${nc}`)
    }
  }

  // Build pool of all valid coordinates that can contain mines
  const pool: Array<[number, number]> = []
  for(let r = 0; r < rows; r++) {
    for(let c = 0; c < cols; c++) {
      if(!forbidden.has(`${r},${c}`)) pool.push([r, c])
    }
  }
  if(mines > pool.length) throw new Error("Too many mines for available safe cells")

  // Partial Fisher-Yates shuffle
  for(let i = 0; i < mines; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
    const [mr, mc] = pool[i]
    grid[mr][mc].hasMine = true
  }

  // Finally, just count up neighboring mines for all non-mine cells
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
  let count = 0
  for(const [nr, nc] of cellNeighbors(grid.length, grid[0].length, row, col)) {
    if(grid[nr][nc].hasMine) count++
  }
  return count
}

export function revealCell(board: Board, r: number, c: number, minesForInit?: number): Board {
  // if first click, populate (guarantees safety at r,c and optionally neighbors)
  let working = board
  if (working.status === "uninitialized") {
    const minesToUse = minesForInit ?? board.mines
    working = populateBoard(working, minesToUse, r, c, { excludeAdj: true })
  }

  const grid = working.grid.map(row => row.map(cell => ({ ...cell })))
  const start = grid[r][c]
  if (start.flagged || start.revealed) return working

  if (start.hasMine) {
    // hit a mine → lose
    const lost = { ...working, grid, status: "lost" as const }
    grid[r][c].revealed = true
    return lost
  }

  // BFS flood fill for zeroes
  let revealedCount = working.revealedCount
  const q: Array<[number, number]> = [[r, c]]
  while (q.length) {
    const [cr, cc] = q.pop()!
    const cell = grid[cr][cc]
    if (cell.revealed || cell.flagged) continue
    cell.revealed = true
    revealedCount++

    if (cell.neighborCount === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = cr + dr, nc = cc + dc
          if (grid[nr]?.[nc] && !grid[nr][nc].revealed && !grid[nr][nc].flagged && !grid[nr][nc].hasMine) {
            q.push([nr, nc])
          }
        }
      }
    }
  }

  const totalSafe = working.rows * working.cols - working.mines
  const status = revealedCount === totalSafe ? "won" : "playing"

  return { ...working, grid, revealedCount, status }
}

// Chording: clicking a revealed cell that already has as many flags around it as its number
// reveals the rest of its neighbors. If a flag is misplaced, one of those is a mine → lose
export function chordCell(board: Board, r: number, c: number): Board {
  const cell = board.grid[r][c]
  if (board.status !== "playing" || !cell.revealed) return board

  const neighbors = cellNeighbors(board.rows, board.cols, r, c)
  const flagCount = neighbors.filter(([nr, nc]) => board.grid[nr][nc].flagged).length
  if (flagCount !== cell.neighborCount) return board

  let working = board
  for (const [nr, nc] of neighbors) {
    working = revealCell(working, nr, nc)
    if (working.status !== "playing") break
  }
  return working
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
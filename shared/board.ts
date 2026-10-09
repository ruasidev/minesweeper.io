// "Business logic" for the board: the rules of the game.
// Used by the site for singleplayer and by the server for multiplayer, so this file must not import anything else

// a single cell in the board
export type Cell = {
  row: number
  col: number
  hasMine: boolean
  revealed: boolean
  flagged: boolean
  neighborCount: number
}

// Domain model; data structure representing the board itself
// the whole board is just a 2D array of Cells
export type Board = {
  rows: number
  cols: number
  mines: number
  status: GameStatus
  revealedCount: number
  flaggedCount: number
  grid: Cell[][]
}

// possible outcomes of a game
export type GameStatus = 
    | "uninitialized" 
    | "playing" 
    | "won" 
    | "lost"

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

// `random` is where the randomness comes from: Math.random unless a caller needs the same board every time
export function populateBoard(board: Board, mines: number, safeR: number, safeC: number, { excludeAdj = true, random = Math.random }: { excludeAdj?: boolean, random?: () => number }): Board {
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
    const j = i + Math.floor(random() * (pool.length - i))
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

// How many of the cells around this one the player has marked as mines: the flagged ones,
// plus any mine that is already uncovered (which happens in multiplayer, where hitting a mine doesn't end the game)
export function knownMinesAround(board: Board, r: number, c: number): number {
  return cellNeighbors(board.rows, board.cols, r, c)
    .filter(([nr, nc]) => board.grid[nr][nc].flagged || (board.grid[nr][nc].revealed && board.grid[nr][nc].hasMine))
    .length
}

// Chording: clicking a revealed cell that already has as many flags around it as its number
// reveals the rest of its neighbors. If a flag is misplaced, one of those is a mine → lose
export function chordCell(board: Board, r: number, c: number): Board {
  const cell = board.grid[r][c]
  if (board.status !== "playing" || !cell.revealed) return board
  if (knownMinesAround(board, r, c) !== cell.neighborCount) return board

  let working = board
  for (const [nr, nc] of cellNeighbors(board.rows, board.cols, r, c)) {
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

// A mine going off in a game where that doesn't end it (multiplayer, the daily challenge): everything uncovered
// within its blast is covered up again. The mine itself stays uncovered, and flags stay where they are
export function coverAround(board: Board, row: number, col: number, radius: number): Board {
  let revealedCount = board.revealedCount
  // boards are never changed in place: only the cells that change are made anew
  const grid = board.grid.map(cells => cells.map((cell) => {
    const inBlast = (cell.row - row) ** 2 + (cell.col - col) ** 2 <= radius ** 2
    if (!inBlast || !cell.revealed || cell.hasMine) return cell
    revealedCount--
    return { ...cell, revealed: false }
  }))
  return { ...board, grid, revealedCount }
}

// A board with its mines where a record of a game says they were: `layout` has one character per cell, row after
// row, "1" for a mine. Nothing is uncovered yet. It is where playing a recorded game back starts from
export function boardFromLayout(rows: number, cols: number, layout: string): Board {
  const board = createEmptyBoard(rows, cols)
  let mines = 0
  for (const row of board.grid) {
    for (const cell of row) {
      cell.hasMine = layout[cell.row * cols + cell.col] === "1"
      if (cell.hasMine) mines++
    }
  }
  for (const row of board.grid) {
    for (const cell of row) {
      if (!cell.hasMine) cell.neighborCount = countNeighbors(board.grid, cell.row, cell.col)
    }
  }
  return { ...board, mines, status: "playing" }
}

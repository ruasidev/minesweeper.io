// Note to self: Analogous to Rails migration/schema, describes shape of data

// a single cell in the board
export type Cell = {
  row: number
  col: number
  hasMine: boolean
  revealed: boolean
  flagged: boolean
  neighborCount: number
}

export type CellProps = {
  cell: Cell
  onClick?: () => void
  onRightClick?: () => void
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

// React component contract; what props must be passed into <Board /> component
export type BoardProps = {
  board: Board,
  onClickCell: (r: number, c: number) => void
  onRightClickCell: (r: number, c: number) => void
}

// a move a player can make
export type Move =
  | { type: "reveal"; row: number; col: number }
  | { type: "flag"; row: number; col: number }

// possible outcomes of a game
export type GameStatus = "uninitialized" | "playing" | "won" | "lost"

// overall game state container
export type GameState = {
  board: Board
  rows: number
  cols: number
  mines: number
  status: GameStatus
  revealedCount: number
  flaggedCount: number
}

export type NumberInputProps = {
    label: string,
    value: number,
    onChange: (n: number) => void
}
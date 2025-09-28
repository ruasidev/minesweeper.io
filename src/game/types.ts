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
  onMiddleClick?: () => void
  colors: CellColors
}

// colors that can be themed by the user
export type CellColors = {
  cellCovered: string
  cellRevealed: string
  cellFlagged: string
}

// Domain model; data structure representing the board itself
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
  board: Board
  onClickCell: (r: number, c: number) => void
  onRightClickCell: (r: number, c: number) => void
  colors: CellColors
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
  label: string
  value: number
  onChange: (n: number) => void
}

export type Theme = {
  name: string
  credits: string
  background: string
  menuBg: string
  menuBorder: string
  cellCovered: string
  cellRevealed: string
  cellFlagged: string
}

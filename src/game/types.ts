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

// the whole board is just a 2D array of cells
export type Board = Cell[][]

// a move a player can make
export type Move =
  | { type: "reveal"; row: number; col: number }
  | { type: "flag"; row: number; col: number }

// possible outcomes of a game
export type GameStatus = "playing" | "won" | "lost"

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
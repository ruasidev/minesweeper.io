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
  animationClass?: string
  animationDelay?: string
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

export type SidebarProps = {
    isOpen: boolean
    onClose: () => void
}

export type NavigationBarProps = {
    children?: React.ReactNode
}

export type NumberInputProps = {
    label: string
    value: number
    onChange: (n: number) => void
}

export type SidebarSectionHeaderProps = {
    text: string
}
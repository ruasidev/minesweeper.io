import type { LossAnimationChoices, WinAnimationChoices, AnimationProps } from "./animations"
import type { ThemeChoices, ThemeProps } from "./themes"
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
  theme: ThemeProps
  onClick?: () => void
  onRightClick?: () => void
  onMiddleClick?: () => void
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
  board: Board
  origin: { row: number, col: number } | null
  lossAnimation: AnimationProps<LossAnimationChoices>
  winAnimation: AnimationProps<WinAnimationChoices>
  theme: ThemeProps
  onClickCell: (r: number, c: number) => void
  onRightClickCell: (r: number, c: number) => void
}

export type GameProps = {
  lossAnimation: AnimationProps<LossAnimationChoices>
  winAnimation: AnimationProps<WinAnimationChoices>
  theme: ThemeProps
}

export type GameControlsProps = {
    rows: number
    cols: number
    mines: number
    theme: ThemeProps
    onRowsChange: (val: number) => void
    onColsChange: (val: number) => void
    onMinesChange: (val: number) => void
    onReset: () => void
}

// possible outcomes of a game
export type GameStatus = 
    | "uninitialized" 
    | "playing" 
    | "won" 
    | "lost"

export type GameStatusBarProps = {
    rows: number
    cols: number
    mines: number
    status: GameStatus
    revealedCount: number
    flaggedCount: number
}

export type SidebarProps = {
    currentWinAnimation: WinAnimationChoices
    currentLossAnimation: LossAnimationChoices
    currentTheme: ThemeProps
    setWinAnimation: (val: WinAnimationChoices) => void
    setLossAnimation: (val: LossAnimationChoices) => void
    setTheme: (val: ThemeChoices) => void
}

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

export type GameResultProps = {
    status: "won" | "lost"
    onReset: () => void
}

export type NumberInputProps = {
    label: string
    value: number
    onChange: (n: number) => void
}
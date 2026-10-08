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
  chordHintKey?: number
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

// The pages of the site
export type Route = "game" | "admin"

// What the left pane can show in place of the navigation
export type Panel = "themes" | "settings"

export type MainNavigationProps = {
    route: Route
    onNavigate: (route: Route) => void
    width: number
    minWidth: number
    onWidthChange: (width: number) => void
    openPanel: Panel | null
    onOpenPanel: (panel: Panel) => void
    onClosePanel: () => void
}

// Which form the account window shows to a signed-out player
export type AuthMode = "signIn" | "signUp"

export type NavigationBarProps = {
    children?: React.ReactNode
}

export type NumberInputProps = {
    label: string
    value: number
    min?: number
    max?: number
    unit?: string
    onChange: (n: number) => void
}

export type SidebarSectionHeaderProps = {
    text: string
}
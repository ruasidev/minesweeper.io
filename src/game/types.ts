// Note to self: Analogous to Rails migration/schema, describes shape of data

import type { Board, Cell } from "../../shared/board"
import type { ChordHint } from "../hooks/useChordHint"

// The board itself and its cells are described next to the rules that work on them
export type { Board, Cell, GameStatus } from "../../shared/board"

export type CellProps = {
  cell: Cell
  animationClass?: string
  animationDelay?: string
  chordHintKey?: number
  // set on a cell that a mine going off has just covered back up: which blast, and how long it takes to reach the cell
  blastId?: number
  blastDelayMs?: number
  // changes when a new game starts
  resetKey: number
}

// A mine going off in a game where that doesn't end it: where the mine is, and the cells its blast covered back up
export type Blast = {
  // different for every blast, so one going off right where the last did still plays
  id: number
  row: number
  col: number
  // "row,col" of each cell covered back up
  covered: Set<string>
}

export type BoardGridProps = {
  board: Board
  // where the win and loss animations spread out from
  lastClicked: { row: number, col: number } | null
  chordHint: ChordHint | null
  blast?: Blast | null
  // changes when a new game starts
  resetKey: number
  onCellClick: (row: number, col: number) => void
  onCellRightClick: (row: number, col: number) => void
}

// The pages of the site
export type Route = "game" | "multiplayer" | "daily" | "leaderboard" | "history" | "admin"

// What the left pane can show in place of the navigation
export type Panel = "themes" | "settings" | "help" | "chat"

// What the navigation shows and does, wherever it is put
export type NavContentProps = {
    route: Route
    onNavigate: (route: Route) => void
    openPanel: Panel | null
    onOpenPanel: (panel: Panel) => void
    onClosePanel: () => void
    // how many messages have arrived in the global chat since it was last looked at
    unseenChat: number
    // how many multiplayer rooms are open right now
    openRooms: number
    // on a phone or a tablet: the main pages are tabs there, so they are left out here
    compact?: boolean
    // given where the navigation is something brought up and put away again: it gets an X that does this
    onClose?: () => void
}

// The navigation as the pane floating on the left of a desktop
export type MainNavigationProps = NavContentProps & {
    width: number
    minWidth: number
    onWidthChange: (width: number) => void
    // moved out past the left edge, to leave a game the whole width of a narrow window
    offScreen: boolean
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
    // how much one notch of the slider moves the figure
    step?: number
    unit?: string
    // for a bar: a small caption with the figure beside it, over a short slider
    compact?: boolean
    // with a button either side of the figure to move it one at a time, for setting it with a finger
    stepper?: boolean
    onChange: (n: number) => void
}

export type SidebarSectionHeaderProps = {
    text: string
}
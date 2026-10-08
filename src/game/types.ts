// Note to self: Analogous to Rails migration/schema, describes shape of data

import type { Board, Cell } from "../../shared/board"
import type { ChordHint } from "../hooks/useChordHint"
import type { RoomSummary } from "../../shared/protocol"

// The board itself and its cells are described next to the rules that work on them
export type { Board, Cell, GameStatus } from "../../shared/board"

export type CellProps = {
  cell: Cell
  animationClass?: string
  animationDelay?: string
  chordHintKey?: number
  // changes when a new game starts
  resetKey: number
  onClick: (row: number, col: number) => void
  onRightClick: (row: number, col: number) => void
}

export type BoardGridProps = {
  board: Board
  // where the win and loss animations spread out from
  lastClicked: { row: number, col: number } | null
  chordHint: ChordHint | null
  // changes when a new game starts
  resetKey: number
  onCellClick: (row: number, col: number) => void
  onCellRightClick: (row: number, col: number) => void
}

// The pages of the site
export type Route = "game" | "multiplayer" | "daily" | "leaderboard" | "admin"

// What the left pane can show in place of the navigation
export type Panel = "themes" | "settings" | "help" | "chat"

export type MainNavigationProps = {
    route: Route
    onNavigate: (route: Route) => void
    width: number
    minWidth: number
    onWidthChange: (width: number) => void
    openPanel: Panel | null
    onOpenPanel: (panel: Panel) => void
    onClosePanel: () => void
    // moved out past the left edge, to leave a game the whole width of a narrow window
    offScreen: boolean
    onOpenAuth: (mode: AuthMode) => void
    onOpenProfile: () => void
    // one of the open rooms listed in the pane was clicked
    onPickRoom: (room: RoomSummary) => void
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
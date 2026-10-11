export type StatusBarItem =
    | "mines"
    | "status"
    | "flags"
    | "revealed"
    | "progress"
    | "time"

export type StatusBarPosition =
    | "top"
    | "left"
    | "right"
    | "bottom"

export type Settings = {
  statusBarItems: Record<StatusBarItem, boolean>
  statusBarPosition: StatusBarPosition
  cellSize: number // px
  cellGap: number // px
  cellFontScale: number // % of the cell size
  // screens and panes switch instantly, and nothing moves under the pointer
  reduceMotion: boolean
  soundEffects: boolean
  soundVolume: number // %
  // how long a finger has to stay on a cell to flag it, on a touch screen
  holdMs: number
}

// How short and how long that hold can be set
export const HOLD_MS_MIN = 150
export const HOLD_MS_MAX = 800

// In the order they appear on the status bar
export const statusBarItems: { id: StatusBarItem, label: string }[] = [
  { id: "mines", label: "Mines in all" },
  { id: "status", label: "Status" },
  { id: "flags", label: "Mines left" },
  { id: "revealed", label: "Revealed" },
  { id: "progress", label: "Progress" },
  { id: "time", label: "Time" },
]

export const statusBarPositions: { id: StatusBarPosition, label: string }[] = [
  { id: "top", label: "Top" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "bottom", label: "Bottom" },
]

export const defaultSettings: Settings = {
  // The three a game is played by, as the classic game has two of them: how many mines are still to be found,
  // how far along the board is, and the clock. The rest say the same things another way, and are there to be switched on
  statusBarItems: { mines: false, status: false, flags: true, revealed: false, progress: true, time: true },
  statusBarPosition: "top",
  cellSize: 40,
  cellGap: 2,
  cellFontScale: 75,
  // starts out on for people whose computer is already set to reduce motion
  reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  soundEffects: true,
  soundVolume: 60,
  holdMs: 350,
}

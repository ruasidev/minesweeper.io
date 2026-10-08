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
    | "bottom"

export type Settings = {
    statusBarItems: Record<StatusBarItem, boolean>
    statusBarPosition: StatusBarPosition
    cellSize: number // px
    cellGap: number // px
    cellFontScale: number // % of the cell size
}

// In the order they appear on the status bar
export const statusBarItems: { id: StatusBarItem, label: string }[] = [
    { id: "mines", label: "Mines" },
    { id: "status", label: "Status" },
    { id: "flags", label: "Flags Remaining" },
    { id: "revealed", label: "Revealed" },
    { id: "progress", label: "Progress" },
    { id: "time", label: "Time" },
]

export const statusBarPositions: { id: StatusBarPosition, label: string }[] = [
    { id: "top", label: "Top" },
    { id: "left", label: "Left" },
    { id: "bottom", label: "Bottom" },
]

export const defaultSettings: Settings = {
    statusBarItems: { mines: true, status: true, flags: true, revealed: true, progress: true, time: true },
    statusBarPosition: "top",
    cellSize: 40,
    cellGap: 2,
    cellFontScale: 75,
}

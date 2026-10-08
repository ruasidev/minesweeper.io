import type { ReactNode } from "react"
import { useMinesweeperGameContext } from "../../../context/MinesweeperGameContext"
import { useSettings } from "../../../context/SettingsContext"
import { useTheme } from "../../../context/ThemeContext"
import { statusBarItems, type StatusBarItem } from "../../../game/settings"
import MiniClock from "./MiniClock"

export default function GameStatusBar() {
  const { theme } = useTheme()
  const { settings } = useSettings()
  const { rows, cols, mines, board, progress, timeSeconds, timeMinutes } = useMinesweeperGameContext()
  const formattedTime = `${timeMinutes.toString().padStart(2, "0")}:${timeSeconds.toString().padStart(2, "0")}`

  // On the left side of the screen the items are stacked instead of laid out in a row
  const isVertical = settings.statusBarPosition === "left"

  const content: Record<StatusBarItem, ReactNode> = {
    mines: <>Mines: {mines}</>,
    status: <>Status: {board.status}</>,
    flags: <>Flags Remaining: {mines - board.flaggedCount}</>,
    revealed: <>Revealed: {board.revealedCount}/{rows * cols - mines}</>,
    progress: <>Progress: {progress}%</>,
    time: (
      <div className="flex items-center gap-2">
        <MiniClock />
        <span className="tabular-nums w-[3.5rem]">{formattedTime}</span>
      </div>
    ),
  }

  return (
    <div
      className={`border rounded-sm flex px-4 py-2 text-sm
        shadow-lg shadow-black/40 ring-1 ring-white/10 cursor-default
        ${isVertical ? "flex-col gap-3 max-w-48" : "gap-8"}
        ${theme.menuBg}
        ${theme.textHead}
      `}
    >
      {statusBarItems.filter(item => settings.statusBarItems[item.id]).map(item => (
        <div key={item.id} className="font-semibold">{content[item.id]}</div>
      ))}
    </div>
  )
}

import { useMinesweeperGameContext } from "../../../context/MinesweeperGameContext"
import { useTheme } from "../../../context/ThemeContext"
import MiniClock from "./MiniClock"

export default function GameStatusBar() {
  const { theme } = useTheme()
  const { rows, cols, mines, board, progress, timeSeconds, timeMinutes } = useMinesweeperGameContext()
  const formattedTime = `${timeMinutes.toString().padStart(2, "0")}:${timeSeconds.toString().padStart(2, "0")}`

  return (
    <div
      className={`border rounded-sm flex gap-8 px-4 py-2 text-sm
        shadow-lg shadow-black/40 ring-1 ring-white/10 cursor-default
        ${theme.menuBg}
        ${theme.textHead}
      `}
    >
      <div className="font-semibold">Mines: {mines}</div>
      <div className="font-semibold">Status: {board.status}</div>
      <div className="font-semibold">Flags Remaining: {mines - board.flaggedCount}</div>
      <div className="font-semibold">Revealed: {board.revealedCount}/{rows * cols - mines}</div>
      <div className="font-semibold">Progress: {progress}%</div>
      <div className="flex items-center gap-2">
        <MiniClock />
        <span className="font-semibold tabular-nums w-[3.5rem]">{formattedTime}</span>
      </div>
    </div>
  )
}

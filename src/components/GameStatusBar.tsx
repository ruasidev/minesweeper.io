import type { GameStatusBarProps } from "../game/types"
import { MiniClock } from "./MiniClock"

export function GameStatusBar({
  rows,
  cols,
  mines,
  status,
  revealedCount,
  flaggedCount,
  theme,
  time,
}: GameStatusBarProps) {
  const progress =
    status === "playing" || status === "won"
      ? Math.round(
          (1 - (rows * cols - revealedCount - flaggedCount) / (rows * cols)) * 100
        )
      : 0

  const minutes = Math.floor(time / 60)
  const seconds = time % 60
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`

  return (
    <div
      className={`border rounded-sm flex gap-8 px-4 py-2 text-sm
        shadow-lg shadow-black/40 ring-1 ring-white/10 cursor-default
        ${theme.menuBg}
        ${theme.textHead}
      `}
    >
      <div className="font-semibold">Mines: {mines}</div>
      <div className="font-semibold">Status: {status}</div>
      <div className="font-semibold">Flags Remaining: {mines - flaggedCount}</div>
      <div className="font-semibold">Revealed: {revealedCount}/{rows * cols - mines}</div>
      <div className="font-semibold">Progress: {progress}%</div>
      <div className="flex items-center gap-2">
        <MiniClock time={time} />
        <span className="font-semibold tabular-nums w-[3.5rem]">{formattedTime}</span>
      </div>
    </div>
  )
}

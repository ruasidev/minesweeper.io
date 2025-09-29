import { useEffect, useState } from "react"
import type { GameResultProps } from "../game/types"
import PlayAgainButton from "./PlayAgainButton"

export default function GameResult({ 
  status, revealedCount, flaggedCount, totalMines, rows, cols, theme, onReset }: GameResultProps) {
  const [visible, setVisible] = useState(false)

  // trigger fade-in after mount
  useEffect(() => {
    if (status === "won" || status === "lost") {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [status])

  // don't render at all unless game ended
  if (status !== "won" && status !== "lost") return null

  const header = status === "won" ? "Board Cleared!" : "Game Over"
  const message = status === "won" 
    ? "Well done :)" 
    : "maybe next time..."

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center
        bg-black/60 backdrop-blur-xs
        transition-opacity duration-500 ease-out
        ${visible ? "opacity-100" : "opacity-0"}
      `}
    >
      <div
        className={`p-8 rounded-lg text-center space-y-6 shadow-2xl border-2
          transform transition-transform duration-500 ease-out
          ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}
          ${theme.menuBg}
          ${theme.menuBorder}
        `}
      >
        {/* Title */}
        <h2 className={`text-3xl font-extrabold ${theme.textHead}`}>{header}</h2>
        <p className={theme.textBody}>{message}</p>

        {/* Stats */}
        <div className={`grid grid-cols-2 gap-4 text-sm ${theme.textBody}`}>
          <div className={`p-2 ${theme.itemBg} rounded ${theme.itemBorder} border-1`}>Board: {rows} × {cols}</div>
          <div className={`p-2 ${theme.itemBg} rounded ${theme.itemBorder} border-1`}>Mines: {totalMines}</div>
          <div className={`p-2 ${theme.itemBg} rounded ${theme.itemBorder} border-1`}>Revealed: {revealedCount}</div>
          <div className={`p-2 ${theme.itemBg} rounded ${theme.itemBorder} border-1`}>Flags: {flaggedCount}</div>
        </div>

        {/* CTA */}
        <PlayAgainButton theme={theme} onReset={onReset} />
      </div>
    </div>
  )
}

import { useEffect, useState } from "react"
import type { GameResultProps } from "../game/types"
import PlayAgainButton from "./PlayAgainButton"

export default function GameResult({ 
  status, revealedCount, flaggedCount, totalMines, rows, cols, theme, onReset, time 
}: GameResultProps & { time: number }) {
  const [visible, setVisible] = useState(false)

  // fade-in
  useEffect(() => {
    if (status === "won" || status === "lost") {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [status])

  if (status !== "won" && status !== "lost") return null

  const header = status === "won" ? "Board Cleared!" : "Game Over"
  const message = status === "won" ? "Well done :)" : "Maybe next time..."

  const minutes = Math.floor(time / 60)
  const seconds = time % 60
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`

  return (
    <div
      className={`fixed inset-0 z-60 grid place-items-center
        bg-black/60 backdrop-blur-sm
        transition-opacity duration-500 ease-out
        ${visible ? "opacity-100" : "opacity-0"}
      `}
    >
      <div
        className={`p-10 rounded-xl text-center space-y-8 shadow-2xl border-2 max-w-lg w-full mx-4
          transform transition-transform duration-500 ease-out
          ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}
          ${theme.menuBg}
          ${theme.menuBorder}
        `}
      >
        {/* Title */}
        <h2 className={`text-4xl font-extrabold ${theme.textHead}`}>{header}</h2>
        <p className={`${theme.textBody} text-lg`}>{message}</p>

        {/* Stats */}
        <div className={`grid grid-cols-2 gap-4 text-base ${theme.textBody}`}>

          <div 
            className={`p-3 ${theme.itemBg} rounded ${theme.itemBorder} border font-semibold cursor-default scale-hover-105`}
          >
            Board: {rows} × {cols}
          </div>

          <div 
            className={`p-3 ${theme.itemBg} rounded ${theme.itemBorder} border font-semibold cursor-default scale-hover-105`}
          >
            Mines: {totalMines}
          </div>

          <div 
            className={`p-3 ${theme.itemBg} rounded ${theme.itemBorder} border font-semibold cursor-default scale-hover-105`}
          >
            Revealed: {revealedCount}
          </div>

          <div 
            className={`p-3 ${theme.itemBg} rounded ${theme.itemBorder} border font-semibold cursor-default scale-hover-105`}
          >
            Flags: {flaggedCount}
          </div>

          <div className={`
            col-span-2 p-3 ${theme.itemBg} rounded ${theme.itemBorder} border font-extrabold cursor-default scale-hover-108
          `}>
            Time: {formattedTime}
          </div>
        </div>

        {/* CTA */}
        <PlayAgainButton theme={theme} onReset={onReset} />
      </div>
    </div>
  )
}
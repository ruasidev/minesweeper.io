import { useEffect, useState } from "react"
import type { GameResultProps } from "../game/types"

export default function GameResult({ 
  status, revealedCount, flaggedCount, totalMines, rows, cols, onReset 
}: GameResultProps) {
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
    ? "good shit" 
    : "dumbass lol"

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center
        bg-black/60 backdrop-blur-xs
        transition-opacity duration-500 ease-out
        ${visible ? "opacity-100" : "opacity-0"}
      `}
    >
      <div
        className={`bg-gray-800 p-8 border rounded-lg text-center space-y-6 shadow-2xl
          transform transition-transform duration-500 ease-out
          ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}
        `}
      >
        {/* Title */}
        <h2 className="text-3xl font-extrabold text-white">{header}</h2>
        <p className="text-gray-300">{message}</p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-gray-200 text-sm">
          <div className="p-2 bg-gray-700 rounded">Board: {rows} × {cols}</div>
          <div className="p-2 bg-gray-700 rounded">Mines: {totalMines}</div>
          <div className="p-2 bg-gray-700 rounded">Revealed: {revealedCount}</div>
          <div className="p-2 bg-gray-700 rounded">Flags: {flaggedCount}</div>
        </div>

        {/* CTA */}
        <button
          className="mt-4 px-6 py-2 rounded-md border border-red-400 
                     bg-gray-700 text-white font-semibold
                     hover:bg-gray-600 hover:scale-105 transition-all"
          onClick={onReset}
        >
          Play Again
        </button>
      </div>
    </div>
  )
}

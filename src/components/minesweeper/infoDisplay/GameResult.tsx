import { useEffect, useState } from "react"
import PlayAgainButton from "./PlayAgainButton"
import { useTheme } from "../../../context/ThemeContext"
import { useMinesweeperGameContext } from "../../../context/MinesweeperGameContext"
import GameResultItem from "./GameResultItem"
import ScreenDim from "./ScreenDim"

export default function GameResult() {
  const [visible, setVisible] = useState(false)
  const { theme } = useTheme()
  const { rows, cols, mines, board, timeMinutes, timeSeconds } = useMinesweeperGameContext()

  // fade-in
  useEffect(() => {
    if (board.status === "won" || board.status === "lost") {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [board.status])

  if (board.status !== "won" && board.status !== "lost") return null

  const header = board.status === "won" ? "Board Cleared!" : "Game Over"
  const message = board.status === "won" ? "Well done :)" : "Maybe next time..."
  const formattedTime = `${timeMinutes.toString().padStart(2, "0")}:${timeSeconds.toString().padStart(2, "0")}`

  return (
    <ScreenDim visible={visible}>
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
          <GameResultItem value={`Board: ${rows} × ${cols}`}/>
          <GameResultItem value={`Mines: ${mines}`}/>
          <GameResultItem value={`Revealed: ${board.revealedCount}`}/>
          <GameResultItem value={`Flags: ${board.flaggedCount}`}/>

          <div className={`col-span-2 p-3 ${theme.itemBg} rounded ${theme.itemBorder} border font-extrabold cursor-default scale-hover-108`}>
            Time: {formattedTime}
          </div>
        </div>

        {/* CTA */}
        <PlayAgainButton />
      </div>
    </ScreenDim>
  )
}
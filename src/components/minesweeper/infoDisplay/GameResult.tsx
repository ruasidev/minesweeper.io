import { useEffect, useState } from "react"
import { Bomb, Eye, Trophy } from "lucide-react"
import { useMinesweeperGameContext } from "../../../context/MinesweeperGameContext"
import { useTheme } from "../../../context/ThemeContext"
import { ghostColors } from "../../../game/themes"
import BoardMap from "./BoardMap"
import GameResultItem from "./GameResultItem"
import PlayAgainButton from "./PlayAgainButton"
import ScreenDim from "./ScreenDim"

// What comes up over the board when a singleplayer game ends. A win says how long it took. A loss says how far the
// player had got and shows the whole board in miniature: where the mines were, the one that ended it, and which
// flags were right. Either can be put away to look at the board itself
export default function GameResult() {
  const [visible, setVisible] = useState(false)
  // put away to look at the board; the status bar's Reset starts the next game from there
  const [putAway, setPutAway] = useState(false)
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

  if ((board.status !== "won" && board.status !== "lost") || putAway) return null

  const won = board.status === "won"
  const formattedTime = `${timeMinutes.toString().padStart(2, "0")}:${timeSeconds.toString().padStart(2, "0")}`
  const safeCells = rows * cols - mines
  const safeLeft = safeCells - board.revealedCount
  // worked out here from the board as it ended, whatever the game's own running figure says once it has stopped
  const progress = Math.floor(100 * board.revealedCount / safeCells)
  const flags = board.grid.flat().filter(cell => cell.flagged)
  const rightFlags = flags.filter(cell => cell.hasMine).length

  const detail = won ? `Cleared in ${formattedTime}.`
    // a near miss deserves saying so
    : safeLeft <= Math.max(3, safeCells * 0.05) ? `So close: only ${safeLeft} safe ${safeLeft === 1 ? "cell was" : "cells were"} left.`
    : `You hit a mine with ${progress}% of the board cleared.`

  return (
    <ScreenDim visible={visible}>
      <div
        className={`flex flex-col items-center gap-4 sm:gap-6 p-5 sm:p-8 rounded-2xl text-center shadow-2xl border-2 w-[calc(100%-1rem)] max-w-lg max-h-[calc(100%-1rem)] overflow-y-auto hide-scrollbar
          transform transition-transform duration-500 ease-out
          ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}
          ${theme.menuBg}
          ${theme.menuBorder}
        `}
      >
        <div className="flex flex-col items-center gap-3 cursor-default">
          <span className={`flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full text-white ring-8 ${won ? "bg-green-500 ring-green-500/20" : "bg-red-500 ring-red-500/20"}`}>
            {won ? <Trophy className="w-6 h-6 sm:w-8 sm:h-8" /> : <Bomb className="w-6 h-6 sm:w-8 sm:h-8" />}
          </span>
          <h2 className={`text-3xl sm:text-4xl font-extrabold ${won ? "text-green-500" : "text-red-500"}`}>{won ? "Board cleared!" : "Game over"}</h2>
          <p className={`sm:text-lg ${theme.textBody}`}>{detail}</p>
        </div>

        {!won && (
          <>
            {/* how far they got */}
            <div className="w-full flex flex-col gap-1.5 cursor-default">
              <div className={`h-2.5 rounded-full overflow-hidden ${theme.itemBg}`}>
                <div className="h-full rounded-full bg-green-500" style={{ width: `${progress}%` }} />
              </div>
              <div className={`flex justify-between text-xs font-semibold tabular-nums ${theme.textBody}`}>
                <span>{board.revealedCount} of {safeCells} safe cells uncovered</span>
                <span>{progress}%</span>
              </div>
            </div>

            <BoardMap board={board} />
          </>
        )}

        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-left">
          <GameResultItem label="Time">{formattedTime}</GameResultItem>
          <GameResultItem label="Board">{rows} × {cols}</GameResultItem>
          <GameResultItem label="Mines">{mines}</GameResultItem>
          {won
            ? <GameResultItem label="Flags placed">{flags.length}</GameResultItem>
            : <GameResultItem label="Flags right">{rightFlags} of {flags.length}</GameResultItem>}
        </div>

        {/* side by side where they fit; on a phone each is the full width, the way on first */}
        <div className="w-full flex flex-col sm:flex-row sm:flex-wrap justify-center gap-2 sm:gap-3">
          <PlayAgainButton label={won ? "Play again" : "Try again"} />
          <button
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg pressable font-semibold ${ghostColors(theme)}`}
            title="Put this away. Reset, on the status bar, starts the next game"
            onClick={() => setPutAway(true)}
          >
            <Eye className="w-4 h-4" />
            Look at the board
          </button>
        </div>
      </div>
    </ScreenDim>
  )
}

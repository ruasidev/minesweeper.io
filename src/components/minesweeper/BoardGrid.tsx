import Cell from "./Cell"
import type { AnimationChoices } from "../../game/animations"
import type { BoardGridProps } from "../../game/types"
import { useGameAnimations } from "../../context/GameAnimationContext"
import { useSettings } from "../../context/SettingsContext"

// Draws a board and reports clicks on its cells. Whose board it is, and what a click does, is up to whoever uses it:
// singleplayer plays it right here in the browser, multiplayer asks the server
// how much later the blast of a mine reaches a cell for every cell it is away
const BLAST_MS_PER_CELL = 45

export default function BoardGrid({ board, lastClicked, chordHint, blast, resetKey, onCellClick, onCellRightClick }: BoardGridProps) {
  const { settings } = useSettings()
  const { lossAnimation, winAnimation } = useGameAnimations()

  return (
    <div
      className="grid game-motion"
      onContextMenu={(e) => e.preventDefault()}
      style={{
        gridTemplateColumns: `repeat(${board.cols}, ${settings.cellSize}px)`,
        gridAutoRows: `${settings.cellSize}px`,
        gap: settings.cellGap,
      }}
    >
      {board.grid.map((row, r) =>
        row.map((cell, c) => {
          const isOrigin = lastClicked && r === lastClicked.row && c === lastClicked.col

          let animationClass: AnimationChoices | undefined

          // lost game → animate only bombs
          if (board.status === "lost" && cell.hasMine) {
            animationClass = isOrigin
              ? lossAnimation.originAnim || lossAnimation.id
              : lossAnimation.id
          }

          // won game → animate only safe revealed cells
          if (board.status === "won" && cell.revealed && !cell.hasMine) {
            animationClass = isOrigin
              ? winAnimation.originAnim || winAnimation.id
              : winAnimation.id
          }

          const animationDelay =
            board.status === "lost" &&
            cell.hasMine &&
            lastClicked &&
            !isOrigin
              ? `${(Math.abs(r - lastClicked.row) + Math.abs(c - lastClicked.col)) * lossAnimation.animDuration}ms`
              : board.status === "won" &&
                lastClicked &&
                cell.revealed &&
                !cell.hasMine &&
                !isOrigin
              ? `${(Math.abs(r - lastClicked.row) + Math.abs(c - lastClicked.col)) * lossAnimation.animDuration}ms`
              : "0ms"

          // failed chord → flash the hidden, unflagged cells around the chorded cell
          const isChordHinted =
            chordHint &&
            !cell.revealed &&
            !cell.flagged &&
            Math.abs(r - chordHint.row) <= 1 &&
            Math.abs(c - chordHint.col) <= 1

          return (
            <Cell
              key={`${r}-${c}`}
              cell={cell}
              animationClass={animationClass}
              animationDelay={animationDelay}
              chordHintKey={isChordHinted ? chordHint.id : undefined}
              blast={blast?.covered.has(`${r},${c}`)
                ? { id: blast.id, delayMs: Math.round(Math.hypot(r - blast.row, c - blast.col) * BLAST_MS_PER_CELL) }
                : undefined}
              resetKey={resetKey}
              onClick={onCellClick}
              onRightClick={onCellRightClick}
            />
          )
        })
      )}
    </div>
  )
}

import Cell from "./Cell"
import type { AnimationChoices } from "../../game/animations"
import type { BoardGridProps } from "../../game/types"
import { useGameAnimations } from "../../context/GameAnimationContext"
import { useBoardInput } from "../../hooks/useBoardInput"

// how much later the blast of a mine reaches a cell for every cell it is away
const BLAST_MS_PER_CELL = 45

// Draws a board and reports what is done to its cells. Whose board it is, and what uncovering or flagging a cell
// does, is up to whoever uses it: singleplayer plays it right here in the browser, multiplayer asks the server.
// How big the cells are is up to what it is drawn in: the --cell-size, --cell-gap and --cell-font of a BoardViewport
export default function BoardGrid({ board, lastClicked, chordHint, blast, resetKey, onCellClick, onCellRightClick }: BoardGridProps) {
  const { lossAnimation, winAnimation } = useGameAnimations()
  const input = useBoardInput(board, onCellClick, onCellRightClick)

  return (
    <div
      className="grid game-motion board-grid"
      {...input}
      style={{
        gridTemplateColumns: `repeat(${board.cols}, var(--cell-size, 40px))`,
        gridAutoRows: "var(--cell-size, 40px)",
        gap: "var(--cell-gap, 2px)",
        fontSize: "var(--cell-font, 30px)",
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

          const blastHere = blast?.covered.has(`${r},${c}`) ? blast : null

          return (
            <Cell
              key={`${r}-${c}`}
              cell={cell}
              animationClass={animationClass}
              animationDelay={animationDelay}
              chordHintKey={isChordHinted ? chordHint.id : undefined}
              blastId={blastHere?.id}
              blastDelayMs={blastHere ? Math.round(Math.hypot(r - blastHere.row, c - blastHere.col) * BLAST_MS_PER_CELL) : undefined}
              resetKey={resetKey}
            />
          )
        })
      )}
    </div>
  )
}

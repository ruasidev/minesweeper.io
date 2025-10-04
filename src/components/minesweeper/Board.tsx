import Cell from "./Cell"
import type { AnimationChoices } from "../../game/animations"
import { useGameAnimations } from "../../context/GameAnimationContext"
import { useMinesweeperGameContext } from "../../context/MinesweeperGameContext"

export default function Board() {
  // match Cell size: Tailwind w-10 h-10 = 2.5rem ≈ 40px
  const CELL_PX = 40
  const { lossAnimation, winAnimation } = useGameAnimations()
  const { board, lastClicked } = useMinesweeperGameContext()

  return (
    <div
      className="grid gap-0.5"
      onContextMenu={(e) => e.preventDefault()}
      style={{
        gridTemplateColumns: `repeat(${board.cols}, ${CELL_PX}px)`,
        gridAutoRows: `${CELL_PX}px`,
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

          return (
            <Cell
              key={`${r}-${c}`}
              cell={cell}
              animationClass={animationClass}
              animationDelay={animationDelay}
            />
          )
        })
      )}
    </div>
  )
}

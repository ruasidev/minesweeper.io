import type { BoardProps } from "../../game/types"
import Cell from "./Cell"
import type { AnimationChoices } from "../../game/animations"

export default function Board({ board, resetKey, origin, lossAnimation, winAnimation, theme, onClickCell, onRightClickCell }: BoardProps) {
  // match Cell size: Tailwind w-10 h-10 = 2.5rem ≈ 40px
  const CELL_PX = 40

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
          const isOrigin = origin && r === origin.row && c === origin.col

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
            origin &&
            !isOrigin
              ? `${(Math.abs(r - origin.row) + Math.abs(c - origin.col)) * lossAnimation.animDuration}ms`
              : board.status === "won" &&
                origin &&
                cell.revealed &&
                !cell.hasMine &&
                !isOrigin
              ? `${(Math.abs(r - origin.row) + Math.abs(c - origin.col)) * lossAnimation.animDuration}ms`
              : "0ms"

          return (
            <Cell
              key={`${r}-${c}`}
              resetKey={resetKey}
              cell={cell}
              onClick={() => onClickCell(r, c)}
              onRightClick={() => onRightClickCell(r, c)}
              animationClass={animationClass}
              animationDelay={animationDelay}
              theme={theme}
            />
          )
        })
      )}
    </div>
  )
}

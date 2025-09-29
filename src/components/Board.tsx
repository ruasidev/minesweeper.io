import type { BoardProps } from "../game/types"
import Cell from "../components/Cell";

export default function Board({ board, origin, lossAnimation, winAnimation, theme, onClickCell, onRightClickCell }: BoardProps) {
  return (
    <div
      className="grid gap-0.5"
      style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
    >
      {board.grid.map((row, r) =>
        row.map((cell, c) => {
          const isOrigin = origin && r === origin.row && c === origin.col

          let animationClass = ""
          if (board.status === "lost" && cell.hasMine) {
            animationClass = isOrigin
              ? lossAnimation.originAnim || lossAnimation.id
              : lossAnimation.id
          }
          if (board.status === "won") {
            animationClass = isOrigin
              ? winAnimation.originAnim || winAnimation.id
              : winAnimation.id
          }

          const animationDelay =
            board.status === "lost" &&
            cell.hasMine &&
            origin &&
            !isOrigin
              ? `${(Math.abs(r - origin.row) + Math.abs(c - origin.col)) * 30}ms`
              : "0ms"

          return (
            <Cell
              key={`${r}-${c}`}
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


import type { BoardProps, Cell as CellType } from "../game/types"
import Cell from "../components/Cell"

export default function Board({ board, onClickCell, onRightClickCell, colors }: BoardProps) {
  return (
    <div
      className="grid gap-0.5 border border-red-400 rounded-sm"
      style={{
        gridTemplateColumns: `repeat(${board.cols}, auto)`,
      }}
    >
      {board.grid.map((row, r) =>
        row.map((cell: CellType, c: number) => (
          <Cell
            key={`${r}-${c}`}
            cell={cell}
            colors={colors}
            onClick={() => onClickCell(r, c)}
            onRightClick={() => onRightClickCell(r, c)}
          />
        ))
      )}
    </div>
  )
}

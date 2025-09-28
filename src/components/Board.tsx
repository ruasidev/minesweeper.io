import type { Board as BoardType, Cell } from "../game/types"
import CellView from "./Cell"

type Props = {
  board: BoardType
  onClickCell: (r: number, c: number) => void
  onRightClickCell: (r: number, c: number) => void
}

export default function Board({ board, onClickCell, onRightClickCell }: Props) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${board.cols}, auto)` }}>
      {board.grid.map((row, r) =>
        row.map((cell: Cell, c) => (
          <CellView
            key={`${r}-${c}`}
            cell={cell}
            onClick={() => onClickCell(r, c)}
            onRightClick={() => onRightClickCell(r, c)}
          />
        ))
      )}
    </div>
  )
}

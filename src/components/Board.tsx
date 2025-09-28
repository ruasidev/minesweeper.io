import type { BoardProps, Cell as CellType } from "../game/types"
import Cell from "../components/Cell";

export default function Board({ board, onClickCell, onRightClickCell }: BoardProps) {
    return (
        <div
            className="border border-red-400 rounded-sm grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${board.cols}, auto)` }}
        >
            {board.grid.map((row, r) =>
                row.map((cell: CellType, c: number) => (
                    <Cell 
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

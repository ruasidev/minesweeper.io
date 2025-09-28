import { useState } from "react"
import { createBoard } from "../game/board"
import type { Board as BoardType, Cell as CellType } from "../game/types"
import Cell from "./Cell";

export default function Board() {
    const [rows, setRows] = useState(10);
    const [cols, setCols] = useState(10);
    const [mines, setMines] = useState(20);
    const [board, setBoard] = useState<BoardType>(() => createBoard(rows, cols, mines))

    function newGame() {
        setBoard(createBoard(rows, cols, mines));
    }

    return (
        <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${cols}, 2rem)` }}
        >
            {board.map((row, r) =>
                row.map((cell: CellType, c: number) => (
                    <Cell 
                        key={`${r}-${c}`}
                        cell={cell}
                        onClick={() => console.log("clicked", r, c)}
                        onRightClick={() => console.log("right clicked", r, c)}
                    />
                ))
            )}
        </div>
    )
}

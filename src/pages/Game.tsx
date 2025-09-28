import { useEffect, useState } from "react";
import { createBoard, revealCell, flagCell } from "../game/board";
import type { Board as BoardType } from "../game/types"

import { NumberInput } from "../components/NumberInput";
import Board from "../components/Board";

export default function Game() {
    const [rows, setRows] = useState(10);
    const [cols, setCols] = useState(10);
    const [mines, setMines] = useState(5);
    const [board, setBoard] = useState<BoardType>(() => createBoard(rows, cols))

    useEffect(() => {
        console.log("Creating new game...")
        newGame()
    }, [rows, cols, mines])

    function newGame() {
        return setBoard(createBoard(rows, cols, mines))
    }

    function handleClickCell(row: number, col: number) {
        setBoard(prev => revealCell(prev, row, col))
    }

    function handleRightClickCell(row: number, col: number) {
        setBoard(prev => flagCell(prev, row, col))
    }

    return (
        <div className="container flex border rounded-sm flex-col items-center gap-6 p-4">
            {/* CONTROLS */}
            <div className="border rounded-sm flex gap-4">
                <NumberInput label="Rows" value={rows} onChange={setRows} />
                <NumberInput label="Cols" value={cols} onChange={setCols} />
                <NumberInput label="Mines" value={mines} onChange={setMines} />
            </div>

            {/* STATS */}
            <div className="border rounded-sm flex gap-8">
                <div>Bombs: {mines}</div>
            </div>
            
            {/* BOARD */}
            <Board board={board} onClickCell={handleClickCell} onRightClickCell={handleRightClickCell} />
        </div>
    )
}
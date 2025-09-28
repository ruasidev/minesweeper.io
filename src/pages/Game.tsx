import { useEffect, useState } from "react";
import { createEmptyBoard, populateBoard, revealCell, flagCell } from "../game/board";
import type { Board as BoardType } from "../game/types"

import { NumberInput } from "../components/NumberInput";
import Board from "../components/Board";

export default function Game() {
    const [rows, setRows] = useState(10);
    const [cols, setCols] = useState(10);
    const [mines, setMines] = useState(5);
    const [board, setBoard] = useState<BoardType>(() => createEmptyBoard(rows, cols))
    const [initialized, setInitialized] = useState(false)

    useEffect(() => {
        console.log("Creating new game...")
        resetGame()
    }, [rows, cols, mines])

    function handleClickCell(row: number, col: number) {
        setBoard(prev => {
            if(!initialized) {
                const withMines = populateBoard(prev, mines, row, col, { excludeAdj: true })
                setInitialized(true)
                return revealCell(withMines, row, col)
            }
            return revealCell(prev, row, col)
        })
    }

    function handleRightClickCell(row: number, col: number) {
        setBoard(prev => flagCell(prev, row, col))
    }

    function resetGame() {
        setBoard(createEmptyBoard(rows, cols))
        setInitialized(false)
    }

    return (
        <div className="container flex border rounded-sm flex-col items-center gap-6 p-4">
            {/* CONTROLS */}
            <div className="border rounded-sm flex gap-4">
                <NumberInput label="Rows" value={rows} onChange={setRows} />
                <NumberInput label="Cols" value={cols} onChange={setCols} />
                <NumberInput label="Mines" value={mines} onChange={setMines} />
                <button className="border border-red-400" onClick={resetGame}>Reset</button>
            </div>

            {/* STATS */}
            <div className="border rounded-sm flex gap-8">
                <div>Bombs: {mines}</div>
                <div>Status: {board.status}</div>
                <div>Revealed: {board.revealedCount}/{rows*cols - board.mines}</div>
                <div>Bombs: {board.mines - board.flaggedCount}</div>
            </div>
            
            {/* BOARD */}
            <Board 
                board={board} 
                onClickCell={handleClickCell} 
                onRightClickCell={handleRightClickCell} 
            />
        </div>
    )
}
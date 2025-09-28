import { useEffect, useState } from "react"
import { createEmptyBoard, populateBoard, revealCell, flagCell } from "../game/board"
import type { Board as BoardType } from "../game/types"
import Board from "../components/Board"

type GameProps = {
  rows: number
  cols: number
  mines: number
  resetKey: number
  colors: {
    cellCovered: string
    cellRevealed: string
    cellFlagged: string
  }
}

export default function Game({ rows, cols, mines, resetKey, colors }: GameProps) {
  const [board, setBoard] = useState<BoardType>(() => createEmptyBoard(rows, cols))
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    resetGame()
  }, [rows, cols, mines, resetKey])

  function handleClickCell(row: number, col: number) {
    setBoard(prev => {
      if (!initialized) {
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
    <div className="flex flex-col items-center gap-6 w-full">
      {/* stats */}
      <div className="border rounded-sm flex gap-8 px-4 py-2 bg-gray-700 text-sm text-gray-200">
        <div>Mines: {board.mines}</div>
        <div>Status: {board.status}</div>
        <div>
          Revealed: {board.revealedCount}/{rows * cols - board.mines}
        </div>
        <div>Remaining: {board.mines - board.flaggedCount}</div>
      </div>

      <Board
        board={board}
        onClickCell={handleClickCell}
        onRightClickCell={handleRightClickCell}
        colors={colors}
      />
    </div>
  )
}

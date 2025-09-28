import { useEffect, useState } from "react"
import { createEmptyBoard, populateBoard, revealCell, flagCell } from "../game/board"
import type { Board as BoardType, LossAnimation } from "../game/types"
import Board from "../components/Board"
import GameResult from "../components/GameResult"

type GameProps = {
  rows: number
  cols: number
  mines: number
  resetKey: number
  lossAnimation: LossAnimation
}

export default function Game({ rows, cols, mines, resetKey, lossAnimation }: GameProps) {
  const [board, setBoard] = useState<BoardType>(() => createEmptyBoard(rows, cols))
  const [initialized, setInitialized] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [lossOrigin, setLossOrigin] = useState<{ row: number; col: number } | null>(null)

  useEffect(() => {
    resetGame()
  }, [rows, cols, mines, resetKey]) // reset whenever values or resetKey changes

  useEffect(() => {
    if(board.status === 'lost' || board.status === 'won') {
      const duration = 600
      const maxDelay = (rows + cols) * 20
      const total = duration + maxDelay
      const t = setTimeout(() => setShowResult(true), total)
      return () => clearTimeout(t)
    } else {
      setShowResult(false)
    }

  }, [board.status, rows, cols])

  function handleClickCell(row: number, col: number) {
    setBoard(prev => {
      if (!initialized) {
        const withMines = populateBoard(prev, mines, row, col, { excludeAdj: true })
        setInitialized(true)
        return revealCell(withMines, row, col)
      }
      const next = revealCell(prev, row, col)
      if(next.status === "lost") {
        setLossOrigin({ row, col })
      }
      return next
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
      {/* GAME STATS */}
      <div className="border rounded-sm flex gap-8 px-4 py-2 bg-gray-700 text-sm text-gray-200">
        <div>Mines: {board.mines}</div>
        <div>Status: {board.status}</div>
        <div>
          Revealed: {board.revealedCount}/{rows * cols - board.mines}
        </div>
        <div>Remaining: {board.mines - board.flaggedCount}</div>
      </div>

      {/* BOARD */}
      <Board
        board={board}
        onClickCell={handleClickCell}
        onRightClickCell={handleRightClickCell}
        lossAnimation={lossAnimation}
        lossOrigin={lossOrigin}
      />

      {/* GAME END MODAL */}
      {showResult && (
        <GameResult status={board.status as "won" | "lost"} onReset={resetGame} />
      )}
    </div>
  )
}

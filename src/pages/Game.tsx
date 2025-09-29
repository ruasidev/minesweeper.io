import { useEffect, useState } from "react"
import { createEmptyBoard, populateBoard, revealCell, flagCell } from "../game/board"
import type { GameProps } from "../game/types"
import type { Board as BoardType } from "../game/types"
import Board from "../components/Board"
import GameResult from "../components/GameResult"
import { GameStatusBar } from "../components/GameStatusBar"
import GameControls from "../components/GameControls"

export default function Game({ lossAnimation, winAnimation, theme }: GameProps) {
  const [rows, setRows] = useState(17);
  const [cols, setCols] = useState(20);
  const [mines, setMines] = useState(30);
  const [board, setBoard] = useState<BoardType>(() => createEmptyBoard(rows, cols))
  const [initialized, setInitialized] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [lastClicked, setLastClicked] = useState<{ row: number; col: number } | null>(null)

  useEffect(() => {
    resetGame()
  }, [rows, cols, mines]) // reset whenever values or resetKey changes

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
    setLastClicked({ row, col })
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
      {/* GAME STATS */}
      <GameStatusBar 
        rows={rows} 
        cols={cols} 
        mines={mines} 
        status={board.status} 
        revealedCount={board.revealedCount}
        flaggedCount={board.flaggedCount}
      />

      {/* GAME CONTROLS */}
      <GameControls 
        rows={rows} cols={cols} mines={mines} 
        theme={theme} 
        onRowsChange={setRows} 
        onColsChange={setCols} 
        onMinesChange={setMines} 
        onReset={resetGame}
      />

      {/* BOARD */}
      <Board
        board={board}
        origin={lastClicked}
        lossAnimation={lossAnimation}
        winAnimation={winAnimation}
        theme={theme}
        onClickCell={handleClickCell}
        onRightClickCell={handleRightClickCell}
      />

      {/* GAME END MODAL */}
      {showResult && (
        <GameResult 
          status={board.status as "won" | "lost"} 
          onReset={resetGame} 
        />
      )}
    </div>
  )
}

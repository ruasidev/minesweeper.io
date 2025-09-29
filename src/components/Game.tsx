import { useEffect, useState } from "react"
import { createEmptyBoard, populateBoard, revealCell, flagCell } from "../game/board"
import type { GameProps } from "../game/types"
import type { Board as BoardType } from "../game/types"
import Board from "./Board"
import GameResult from "./GameResult"
import { GameStatusBar } from "./GameStatusBar"
import GameControls from "./GameControls"

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
    if (board.status === "lost" || board.status === "won") {
      const duration = 600
      const maxDelay = (rows + cols) * 20
      const total = duration + maxDelay

      // show modal only after animations complete
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
    <div className={`flex-1 overflow-auto p-4 ${theme.background}`}>
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-6 w-full">
          {/* GAME STATS */}
          <GameStatusBar 
            rows={rows} 
            cols={cols} 
            mines={mines} 
            status={board.status} 
            revealedCount={board.revealedCount}
            flaggedCount={board.flaggedCount}
            theme={theme}
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
              revealedCount={board.revealedCount}
              flaggedCount={board.flaggedCount}
              totalMines={mines}
              rows={rows}
              cols={cols}
              theme={theme}
              onReset={resetGame}
            />
          )}
        </div>
      </div>
    </div>
  )
}

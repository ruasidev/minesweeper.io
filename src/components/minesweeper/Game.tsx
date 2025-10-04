import { useEffect, useState } from "react"
import { createEmptyBoard, populateBoard, revealCell, flagCell } from "../../game/board"
import type { GameProps } from "../../game/types"
import type { Board as BoardType } from "../../game/types"
import Board from "./Board"
import GameResult from "./GameResult"
import { GameStatusBar } from "./GameStatusBar"
import GameControls from "./GameControls"

export default function Game({ lossAnimation, winAnimation, theme, isMenuOpen }: GameProps) {
  const [rows, setRows] = useState(8)
  const [cols, setCols] = useState(10)
  const [mines, setMines] = useState(7)
  const [board, setBoard] = useState<BoardType>(() => createEmptyBoard(rows, cols))
  const [resetKey, setResetKey] = useState(0)
  const [initialized, setInitialized] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [lastClicked, setLastClicked] = useState<{ row: number; col: number } | null>(null)

  // timer state
  const [time, setTime] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  // tick effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    if (isRunning) {
      interval = setInterval(() => {
        setTime(t => t + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning])

  useEffect(() => {
    resetGame()
  }, [rows, cols, mines]) // reset whenever values change

  useEffect(() => {
    if (board.status === "lost" || board.status === "won") {
      const duration = 600
      const maxDelay = (rows + cols) * 20
      const total = duration + maxDelay

      setIsRunning(false) // stop timer on game end

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
        setIsRunning(true) // start timer on first click
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
    setResetKey(k => k + 1)
    setTime(0)         // reset timer
    setIsRunning(false)
  }

  // const railRight = isMenuOpen ? "pr-[calc(var(--sidebar-w)+var(--sidebar-gap)+6px)]" : "pr-2"
  const railLeft  = "pl-2"

  return (
    <div className={`h-full min-h-0 overflow-y-auto overflow-x-hidden py-4 px-2 hide-scrollbar ${theme.background}`}>
      <div className="flex flex-col gap-6 w-full min-w-0">
        {/* STATS */}
        <div className="w-full">
          <div className="flex justify-center">
            <GameStatusBar
              rows={rows}
              cols={cols}
              mines={mines}
              status={board.status}
              revealedCount={board.revealedCount}
              flaggedCount={board.flaggedCount}
              theme={theme}
              time={time}
            />
          </div>
        </div>

        {/* CONTROLS */}
        <div className="w-full">
          <div className="flex justify-center">
            <GameControls
              rows={rows}
              cols={cols}
              mines={mines}
              theme={theme}
              onRowsChange={setRows}
              onColsChange={setCols}
              onMinesChange={setMines}
              onReset={resetGame}
            />
          </div>
        </div>

        {/* BOARD */}
        <div
          className={`relative z-0 w-full min-w-0 overflow-x-auto hide-scrollbar px-3 -mx-1 ${railLeft}`}
          style={{
            paddingRight: isMenuOpen
              ? "calc(var(--sidebar-w) + var(--sidebar-gap) + 6px)"
              : "0.5rem",
            transition: "padding-right 300ms ease",
          }}
        >
          <div className="w-max mx-auto">
            <Board
              board={board}
              resetKey={resetKey}
              origin={lastClicked}
              lossAnimation={lossAnimation}
              winAnimation={winAnimation}
              theme={theme}
              onClickCell={handleClickCell}
              onRightClickCell={handleRightClickCell}
            />
          </div>
        </div>

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
            time={time}
          />
        )}
      </div>
    </div>
  )
}

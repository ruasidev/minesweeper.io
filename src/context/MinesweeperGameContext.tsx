import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Board } from "../game/types";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useChordHint, type ChordHint } from "../hooks/useChordHint";
import { chordCell, createEmptyBoard, flagCell, getMaxMines, MIN_BOARD_SIZE, populateBoard, revealCell } from "../game/board";

interface MinesweeperGameContextType {
    board: Board
    setBoard: React.Dispatch<React.SetStateAction<Board>>
    rows: number
    cols: number
    mines: number
    maxMines: number
    time: number
    timeSeconds: number
    timeMinutes: number
    initialized: boolean
    isRunning: boolean
    resetKey: number
    lastClicked: { row: number; col: number } | null
    chordHint: ChordHint | null
    progress: number
    showResult: boolean
    setRows: (rows: number) => void
    setCols: (cols: number) => void
    setMines: (mines: number) => void
    resetGame: () => void
    handleClickCell: (row: number, col: number) => void
    handleRightClickCell: (row: number, col: number) => void
}

const MinesweeperGameContext = createContext<MinesweeperGameContextType | undefined>(undefined)

export function MinesweeperGameProvider({ children }: { children: ReactNode }) {
    const [storedRows, setRows] = useLocalStorage<number>("rows", 10)
    const [storedCols, setCols] = useLocalStorage<number>("cols", 20)
    const [storedMines, setMines] = useLocalStorage<number>("mines", 20)
    const [time, setTime] = useLocalStorage<number>("time", 0)
    const [initialized, setInitialized] = useLocalStorage<boolean>("isInitialized", false)
    const [isRunning, setIsRunning] = useLocalStorage<boolean>("isRunning", false)
    const [resetKey, setResetKey] = useLocalStorage<number>("resetKey", 0)
    const [lastClicked, setLastClicked] = useLocalStorage<{ row: number; col: number } | null>("lastClicked", null)
    const [showResult, setShowResult] = useLocalStorage<boolean>("showResult", false)

    // Clamp on read: localStorage can still hold a size below the minimum
    const rows = Math.max(storedRows, MIN_BOARD_SIZE)
    const cols = Math.max(storedCols, MIN_BOARD_SIZE)

    // The chosen mine count is kept as-is and only capped to what the current board can hold,
    // so it comes back when the board is made bigger again
    const maxMines = getMaxMines(rows, cols)
    const mines = Math.min(storedMines, maxMines)

    const [board, setBoard] = useState<Board>(createEmptyBoard(rows, cols))
    const [chordHint, flashChordHint] = useChordHint()

    const progress =
        board.status === "playing" || board.status === "won"
            ? Math.round((1 - (rows * cols - board.revealedCount - board.flaggedCount) / (rows * cols)) * 100)
            : 0

    const timeSeconds = time % 60
    const timeMinutes = Math.floor(time / 60)

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
        if (board.status === "lost" || board.status === "won") {
            const duration = 600
            const maxDelay = (rows + cols) * 20
            const total = duration + maxDelay
    
            setIsRunning(false)
    
            // show modal only after animations complete
            const t = setTimeout(() => setShowResult(true), total)
            return () => clearTimeout(t)
        } else {
            setShowResult(false)
        }
    }, [board.status, rows, cols])

    useEffect(() => {
        resetGame()
    }, [rows, cols, mines])

    const resetGame = () => {
        setBoard(createEmptyBoard(rows, cols))
        setInitialized(false)
        setResetKey(k => k + 1)
        setTime(0)
        setIsRunning(false)
    }

    function handleClickCell(row: number, col: number) {
        // Clicking an already revealed cell chords it
        if(board.grid[row][col].revealed) {
            const chorded = chordCell(board, row, col)
            if(chorded === board) {
                // Nothing opened (flags don't match the number): flash the cells the chord was checking
                if(board.status === "playing") flashChordHint(row, col)
                return
            }

            // A chord over a misplaced flag hits a mine: the loss animation starts from that mine
            const hitMine = chorded.status === "lost"
                ? chorded.grid.flat().find(cell => cell.hasMine && cell.revealed)
                : undefined
            setLastClicked(hitMine ? { row: hitMine.row, col: hitMine.col } : { row, col })
            setBoard(chorded)
            return
        }

        setLastClicked({ row, col })
        setBoard(prev => {
            if(!initialized) {
                const initializedBoard = populateBoard(prev, mines, row, col, { excludeAdj: true })
                setInitialized(true)
                setIsRunning(true)
                return revealCell(initializedBoard, row, col)
            }
            return revealCell(prev, row, col)
        })
    }

    function handleRightClickCell(row: number, col: number) {
        setBoard(prev => flagCell(prev, row, col))
    }

    return (
        <MinesweeperGameContext.Provider 
            value={{ 
                rows, cols, mines, maxMines, time, timeSeconds, timeMinutes, initialized, isRunning, resetKey, board, lastClicked, chordHint, progress, showResult,
                setRows, setCols, setMines, resetGame, handleClickCell, handleRightClickCell, setBoard
            }}>
            {children}
        </MinesweeperGameContext.Provider>
    )
}

export function useMinesweeperGameContext() {
    const ctx = useContext(MinesweeperGameContext);
    if (!ctx) throw new Error("useGame must be used within GameProvider");
    return ctx;
}
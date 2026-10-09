import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Board } from "../game/types";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useChordHint, type ChordHint } from "../hooks/useChordHint";
import { chordCell, createEmptyBoard, flagCell, getMaxMines, knownMinesAround, MIN_BOARD_SIZE, populateBoard, revealCell } from "../game/board";
import { soloBoard } from "../lib/multiplayerBoard";
import { CELL_MINE } from "../../shared/protocol";
import { useAccount } from "./AccountContext";
import { useConnection } from "./ConnectionContext";

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
    // Whether this game counts: the server is running it (or will, from its first click), so its result is kept.
    // False for someone who isn't signed in, or whose connection to the server is down: they play in the browser alone
    saved: boolean
    setRows: (rows: number) => void
    setCols: (cols: number) => void
    setMines: (mines: number) => void
    resetGame: () => void
    handleClickCell: (row: number, col: number) => void
    handleRightClickCell: (row: number, col: number) => void
}

const MinesweeperGameContext = createContext<MinesweeperGameContextType | undefined>(undefined)

// how long the server gets to answer the first click of a game before the game is played in the browser instead
const SERVER_ANSWER_MS = 2500

// The singleplayer game. It is played in one of two ways, and everything that draws it is the same for both:
//
// - Signed in and connected, the server runs it. The first click is sent to the server, which lays the mines
//   around it and keeps them to itself; every click after that is sent too, and the board drawn is what the
//   server says is uncovered. The server times the game and keeps its result, so the result can be trusted.
// - Otherwise it is played right here in the browser, and nothing about it is kept.
export function MinesweeperGameProvider({ children }: { children: ReactNode }) {
    const connection = useConnection()
    const { session, refreshProfile } = useAccount()

    const [storedRows, setRows] = useLocalStorage<number>("rows", 10)
    const [storedCols, setCols] = useLocalStorage<number>("cols", 20)
    const [storedMines, setMines] = useLocalStorage<number>("mines", 20)
    const [time, setTime] = useLocalStorage<number>("time", 0)
    const [initialized, setInitialized] = useLocalStorage<boolean>("isInitialized", false)
    const [localRunning, setIsRunning] = useLocalStorage<boolean>("isRunning", false)
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

    // the board of a game played here in the browser, and of any game before its first click
    const [localBoard, setBoard] = useState<Board>(createEmptyBoard(rows, cols))
    const [chordHint, flashChordHint] = useChordHint()

    // --- A game the server is running ---------------------------------------------------------------------
    const online = Boolean(session) && connection.status === "connected"
    const { solo, soloStartedAt, soloStart, soloEnd, reveal, flag } = connection
    // A server game that has been put away here (by Reset), a moment before the server has heard and forgotten it
    const [putAwayId, setPutAwayId] = useState<number | null>(null)
    // the first click has gone to the server and the board it opens hasn't come back yet
    const [starting, setStarting] = useState(false)
    const firstClick = useRef<{ row: number, col: number } | null>(null)
    // The server didn't answer that first click, so this game is being played here instead (and isn't kept)
    const [localOnly, setLocalOnly] = useState(false)
    const serverGame = !localOnly && solo && solo.id !== putAwayId && connection.board ? solo : null
    const serverCells = serverGame ? connection.board!.cells : null
    const serverBoard = useMemo(
        () => serverGame && serverCells ? soloBoard(serverGame.settings, serverCells, serverGame.mines) : null,
        [serverGame, serverCells],
    )

    const board = serverBoard ?? localBoard
    const isRunning = serverBoard ? serverBoard.status === "playing" : localRunning
    const saved = serverBoard !== null || (online && !initialized && !localOnly)

    const progress =
        board.status === "playing" || board.status === "won"
            ? Math.round((1 - (rows * cols - board.revealedCount - board.flaggedCount) / (rows * cols)) * 100)
            : 0

    const timeSeconds = time % 60
    const timeMinutes = Math.floor(time / 60)

    // the clock of a game played in the browser
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null
        if (localRunning) {
            interval = setInterval(() => {
                setTime(t => t + 1)
            }, 1000)
        }
        return () => {
            if (interval) clearInterval(interval)
        }
    }, [localRunning])

    // The clock of a game the server runs follows the server's: counted from when the game started while it is
    // being played, and the server's own figure once it is over
    const serverEndedMs = serverGame?.endedMs ?? null
    const serverPlaying = serverBoard?.status === "playing"
    useEffect(() => {
        if (!serverGame) return
        if (serverEndedMs !== null) return setTime(Math.floor(serverEndedMs / 1000))
        if (!serverPlaying || soloStartedAt === null) return
        const tick = () => setTime(Math.floor(Math.max(0, Date.now() - soloStartedAt) / 1000))
        tick()
        const interval = setInterval(tick, 250)
        return () => clearInterval(interval)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverGame?.id, serverEndedMs, serverPlaying, soloStartedAt])

    // the server's game has arrived (or the connection went): no longer waiting on the first click
    useEffect(() => {
        if (solo || !online) setStarting(false)
    }, [solo, online])

    // If the server doesn't answer the first click (it is being restarted, say), the game goes ahead here in the
    // browser rather than leave the player looking at a board that does nothing. It isn't kept
    useEffect(() => {
        if (!starting) return
        const timer = setTimeout(() => {
            setStarting(false)
            setLocalOnly(true)
            if (firstClick.current) startLocally(firstClick.current.row, firstClick.current.col)
        }, SERVER_ANSWER_MS)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [starting])

    // ...and if its answer turns up after all, that game is given back
    useEffect(() => {
        if (!localOnly || !solo || solo.id === putAwayId) return
        setPutAwayId(solo.id)
        soloEnd()
    }, [localOnly, solo, putAwayId, soloEnd])

    // A game the server ran has just ended: the loss plays out from the mine that was hit (which a chord may have
    // uncovered some way from the click), and the player's stats and level have changed
    const endedGame = useRef<number | null>(null)
    useEffect(() => {
        if (!serverGame || !serverBoard || serverBoard.status === "playing" || endedGame.current === serverGame.id) return
        endedGame.current = serverGame.id
        const hit = serverCells!.indexOf(CELL_MINE)
        if (hit >= 0) setLastClicked({ row: Math.floor(hit / serverGame.settings.cols), col: hit % serverGame.settings.cols })
        const timer = setTimeout(refreshProfile, 1000)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverGame, serverBoard, serverCells, refreshProfile])

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
        // a game the server is running is given up there (or, if it is over, just put away)
        if (solo) {
            setPutAwayId(solo.id)
            soloEnd()
        }
        setStarting(false)
        setLocalOnly(false)
        setBoard(createEmptyBoard(rows, cols))
        setInitialized(false)
        setResetKey(k => k + 1)
        setTime(0)
        setIsRunning(false)
    }

    // The first click of a game played in the browser: the mines are laid around it, and the clock starts
    function startLocally(row: number, col: number) {
        setLastClicked({ row, col })
        setBoard(revealCell(populateBoard(createEmptyBoard(rows, cols), mines, row, col, { excludeAdj: true }), row, col))
        setInitialized(true)
        setIsRunning(true)
    }

    function handleClickCell(row: number, col: number) {
        // The server's game: it decides what a click does, because only it knows where the mines are
        if(serverBoard) {
            const cell = serverBoard.grid[row][col]
            if(serverBoard.status !== "playing" || cell.flagged) return
            // A chord that can't happen yet flashes the cells it is waiting on; no need to ask the server
            if(cell.revealed && knownMinesAround(serverBoard, row, col) !== cell.neighborCount) return flashChordHint(row, col)
            setLastClicked({ row, col })
            reveal(row, col)
            return
        }

        // The first click of a game the server will run: it lays the mines around this cell and sends the board back
        if(online && !initialized && !localOnly) {
            if(starting || localBoard.grid[row][col].flagged) return
            firstClick.current = { row, col }
            setStarting(true)
            setLastClicked({ row, col })
            soloStart({ rows, cols, mines }, row, col)
            return
        }

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
        if(serverBoard) {
            if(serverBoard.status === "playing") flag(row, col)
            return
        }
        // nothing to flag while the server is laying the board out
        if(starting) return
        setBoard(prev => flagCell(prev, row, col))
    }

    return (
        <MinesweeperGameContext.Provider 
            value={{ 
                rows, cols, mines, maxMines, time, timeSeconds, timeMinutes, initialized, isRunning, resetKey, board, lastClicked, chordHint, progress, showResult, saved,
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

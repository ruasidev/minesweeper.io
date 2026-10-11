import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAccount } from "../context/AccountContext"
import { useConnection } from "../context/ConnectionContext"
import { progressOf, readyView, viewOfGame, type BoardView } from "../lib/boardView"
import { ownGameIn, type LiveGame } from "../lib/connection"
import { PHONE_MAX } from "../lib/layout"
import { clickLocalGame, flagLocalGame, startLocalGame, type LocalGame } from "../lib/localGame"
import { cellAt, colOf, rowOf } from "../../shared/engine/field"
import { BOARD_SIZE_MIN, MINES_MAX, maxMines } from "../../shared/engine/generate"
import { CELL_FLAGGED, CELL_MINE, canChord, isUncovered } from "../../shared/engine/view"
import { BEGINNER_BOARD } from "../../shared/game/boards"
import { DEFAULT_SOLO_MODE, isSingleplayerMode, type SingleplayerModeId } from "../../shared/game/modes"
import type { BoardSettings, CellPosition } from "../../shared/protocol"
import { useChordHint, type ChordHint } from "./useChordHint"
import { useGameClock } from "./useGameClock"
import { useLocalStorage } from "./useLocalStorage"

// how long the server gets to answer the first click of a game before the game is played in the browser instead
const SERVER_ANSWER_MS = 2500

// how long the win and loss animations of a board that size take to play out, before the result comes up over them
const resultDelayMs = ({ rows, cols }: BoardSettings): number => 600 + (rows + cols) * 20

// how long after a game ends the server has its result on the player's profile
const PROFILE_REFRESH_MS = 1000

// The board a first visit starts on: Beginner on a phone, where all of it fits on the screen, and a wider board
// of the same difficulty where there is the width for it
const FIRST_BOARD: BoardSettings = window.innerWidth < PHONE_MAX ? BEGINNER_BOARD : { rows: 10, cols: 20, mines: 20 }

// A board that can be made from whatever was chosen: sizes no smaller than the smallest, and no more mines than fit.
// What was chosen is kept as it is, so a mine count the board is too small for comes back when the board grows again
function playable({ rows, cols, mines }: BoardSettings): BoardSettings {
  const size = { rows: Math.max(rows, BOARD_SIZE_MIN), cols: Math.max(cols, BOARD_SIZE_MIN) }
  return { ...size, mines: Math.min(mines, MINES_MAX, maxMines(size.rows, size.cols)) }
}

export type SoloGame = {
  // the board being played, or about to be
  settings: BoardSettings
  // the most mines a board that size can hold
  maxMines: number
  // picks another board, which starts over
  chooseBoard: (settings: BoardSettings) => void
  // Which singleplayer game is being played, or is about to be: the one whose boards never need a guess, or the
  // classic one, with its mines wherever chance puts them
  mode: SingleplayerModeId
  // picks the other, which starts over
  chooseMode: (mode: SingleplayerModeId) => void
  view: BoardView
  // how long the game has been going, in whole seconds
  seconds: number
  // how much of the board has been dealt with, uncovered or flagged, 0 to 100
  progress: number
  // the game is over and its animation has played out: time for the result
  showResult: boolean
  // Whether this game counts: the server is running it (or will, from its first click), so its result is kept.
  // False for someone who isn't signed in, or whose connection to the server is down: they play in the browser alone
  saved: boolean
  // changes when a new game starts
  resetKey: number
  // where the win and loss animations spread out from
  origin: CellPosition | null
  chordHint: ChordHint | null
  reset: () => void
  click: (row: number, col: number) => void
  flag: (row: number, col: number) => void
}

// The singleplayer game. It is played in one of two ways, and everything that draws it is the same for both:
//
// - Signed in and connected, the server runs it. The first click is sent to the server, which lays the mines
//   around it and keeps them to itself; every click after that is sent too, and the board drawn is what the
//   server says is uncovered. The server times the game and keeps its result, so the result can be trusted.
// - Otherwise it is played right here in the browser (see lib/localGame.ts), and nothing about it is kept.
export function useSoloGame(): SoloGame {
  const connection = useConnection()
  const { session, refreshProfile } = useAccount()
  const { startSolo, endSolo, reveal, flag: sendFlag } = connection

  // the game chosen, kept from one visit to the next as the board is
  const [savedMode, setSavedMode] = useLocalStorage<string>("soloMode", DEFAULT_SOLO_MODE)
  const mode = isSingleplayerMode(savedMode) ? savedMode : DEFAULT_SOLO_MODE

  const [chosenRows, setRows] = useLocalStorage<number>("rows", FIRST_BOARD.rows)
  const [chosenCols, setCols] = useLocalStorage<number>("cols", FIRST_BOARD.cols)
  const [chosenMines, setMines] = useLocalStorage<number>("mines", FIRST_BOARD.mines)
  const { rows, cols, mines } = playable({ rows: chosenRows, cols: chosenCols, mines: chosenMines })
  const settings = useMemo(() => ({ rows, cols, mines }), [rows, cols, mines])

  // a game being played here in the browser
  const [local, setLocal] = useState<LocalGame | null>(null)
  // The first click of a game, sent to the server and not yet answered with the board it opens
  const [pending, setPending] = useState<{ settings: BoardSettings, opening: CellPosition } | null>(null)
  // the server didn't answer that first click, so this game is being played here instead (and isn't kept)
  const [fellBack, setFellBack] = useState(false)
  // a server game that has been put away here (by Reset), a moment before the server has heard and forgotten it
  const [putAwayId, setPutAwayId] = useState<number | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [lastClicked, setLastClicked] = useState<CellPosition | null>(null)
  const [chordHint, flashChordHint] = useChordHint()

  const online = Boolean(session) && connection.status === "connected"
  const serverSolo = ownGameIn(connection, "singleplayer")
  const serverGame = serverSolo && !fellBack && serverSolo.id !== putAwayId ? serverSolo : null
  const game: LiveGame | null = serverGame ?? local?.live ?? null
  const view = useMemo(() => (game ? viewOfGame(game) : readyView(settings)), [game, settings])
  const seconds = useGameClock(game)
  const over = view.status === "won" || view.status === "lost"

  // Starts over on a board with nothing played on it. A game the server is running is given up there
  // (or, if it is over, just put away)
  const reset = useCallback(() => {
    if (serverSolo) {
      setPutAwayId(serverSolo.id)
      endSolo()
    }
    setLocal(null)
    setPending(null)
    setFellBack(false)
    setLastClicked(null)
    setResetKey(key => key + 1)
  }, [serverSolo, endSolo])

  const chooseBoard = useCallback((chosen: BoardSettings) => {
    setRows(chosen.rows)
    setCols(chosen.cols)
    setMines(chosen.mines)
    reset()
  }, [setRows, setCols, setMines, reset])

  const chooseMode = useCallback((chosen: SingleplayerModeId) => {
    setSavedMode(chosen)
    reset()
  }, [setSavedMode, reset])

  // The server's game has arrived, or the connection has gone: either way the first click is no longer waiting
  const waiting = pending !== null && online && !serverGame
  // If the server doesn't answer the first click (it is being restarted, say), the game goes ahead here in the
  // browser rather than leave the player looking at a board that does nothing
  useEffect(() => {
    if (!waiting || !pending) return
    const timer = setTimeout(() => {
      setFellBack(true)
      setLocal(startLocalGame(mode, pending.settings, pending.opening, Date.now()))
      setPending(null)
    }, SERVER_ANSWER_MS)
    return () => clearTimeout(timer)
  }, [waiting, pending, mode])

  // ...and if its answer turns up after all, that game is given back
  useEffect(() => {
    if (!fellBack || !serverSolo || serverSolo.id === putAwayId) return
    setPutAwayId(serverSolo.id)
    endSolo()
  }, [fellBack, serverSolo, putAwayId, endSolo])

  // a game the server ran has just ended: the player's stats and level have changed
  const endedServerGame = serverGame && over ? serverGame.id : null
  useEffect(() => {
    if (endedServerGame === null) return
    const timer = setTimeout(refreshProfile, PROFILE_REFRESH_MS)
    return () => clearTimeout(timer)
  }, [endedServerGame, refreshProfile])

  // the result comes up only after the animations of the board ending have played out
  const [resultFor, setResultFor] = useState<LiveGame | null>(null)
  const endedGame = over ? game : null
  useEffect(() => {
    if (!endedGame) return
    const timer = setTimeout(() => setResultFor(endedGame), resultDelayMs(endedGame.settings))
    return () => clearTimeout(timer)
  }, [endedGame])
  const showResult = endedGame !== null && resultFor?.id === endedGame.id

  // what the latest state of things is, for the two handlers below: they are handed to every cell of the board,
  // and so must not change with every move
  const latest = useRef({ game, serverGame, local, view, pending, online, fellBack, settings })
  useEffect(() => {
    latest.current = { game, serverGame, local, view, pending, online, fellBack, settings }
  })

  const click = useCallback((row: number, col: number) => {
    const { game, serverGame, local, view, pending, online, fellBack, settings } = latest.current
    const opening = { row, col }

    // The first click of a game: the mines are laid around it. By the server if it is there to run the game...
    if (!game) {
      if (pending) return
      setLastClicked(opening)
      if (online && !fellBack) {
        setPending({ settings, opening })
        startSolo(mode, { settings, opening })
      } else {
        // ...and otherwise right here
        setLocal(startLocalGame(mode, settings, opening, Date.now()))
      }
      return
    }

    if (view.status !== "playing") return
    const at = cellAt(view.cols, row, col)
    const cell = view.cells[at]
    if (cell === CELL_FLAGGED || cell === CELL_MINE) return
    // A chord that can't happen yet flashes the cells it is waiting on; no need to ask anyone
    if (isUncovered(cell) && !canChord(view.cells, view.rows, view.cols, at)) return flashChordHint(row, col)

    setLastClicked(opening)
    // the server's game: it decides what a click does, because only it knows where the mines are
    if (serverGame) reveal(row, col)
    else if (local) setLocal(clickLocalGame(local, row, col, Date.now()))
  }, [mode, startSolo, reveal, flashChordHint])

  const flag = useCallback((row: number, col: number) => {
    const { serverGame, local } = latest.current
    if (serverGame) sendFlag(row, col)
    else if (local) setLocal(flagLocalGame(local, row, col, Date.now()))
  }, [sendFlag])

  // A loss plays out from the mine that was hit, which a chord may have uncovered some way from the click
  const origin = useMemo(() => {
    const hit = view.status === "lost" ? view.cells.indexOf(CELL_MINE) : -1
    return hit >= 0 ? { row: rowOf(view.cols, hit), col: colOf(view.cols, hit) } : lastClicked
  }, [view, lastClicked])

  return useMemo(() => ({
    settings,
    maxMines: Math.min(MINES_MAX, maxMines(rows, cols)),
    chooseBoard,
    // a game already going is the game it is, whatever has been chosen for the next one
    mode: game && isSingleplayerMode(game.mode) ? game.mode : mode,
    chooseMode,
    view,
    seconds,
    progress: progressOf(view),
    showResult,
    saved: serverGame !== null || (online && !game && !fellBack),
    resetKey,
    origin,
    chordHint,
    reset,
    click,
    flag,
  }), [settings, rows, cols, chooseBoard, mode, chooseMode, view, seconds, showResult, serverGame, online, game, fellBack, resetKey, origin, chordHint, reset, click, flag])
}

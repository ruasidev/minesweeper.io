import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useReportGameWidth } from "../../context/GameWidthContext"
import { useSettings } from "../../context/SettingsContext"
import { useBoardSounds } from "../../hooks/useBoardSounds"
import { useChordHint } from "../../hooks/useChordHint"
import type { OwnBoard } from "../../hooks/useMultiplayer"
import { boardFromCells } from "../../lib/multiplayerBoard"
import { playSound } from "../../lib/sounds"
import { knownMinesAround } from "../../../shared/board"
import type { BoardSettings } from "../../../shared/protocol"
import BoardGrid from "../minesweeper/BoardGrid"

// The board is only redrawn when the board itself changes, not for everything else going on around it
const Grid = memo(BoardGrid)

// Covers the board while this player sits out after uncovering a mine
function MineCooldown({ until }: { until: number }) {
  const [left, setLeft] = useState(() => until - Date.now())
  useEffect(() => {
    const tick = () => setLeft(until - Date.now())
    tick()
    const timer = setInterval(tick, 100)
    return () => clearInterval(timer)
  }, [until])

  if (left <= 0) return null
  return (
    <div className="absolute inset-0 z-10 grid place-items-center rounded bg-black/60 text-white text-2xl font-bold cursor-not-allowed">
      Mine! Back in {Math.ceil(left / 1000)}
    </div>
  )
}

// "Go!" stays up this long after play has begun
const GO_SHOWN_MS = 700

// What the countdown is showing at a moment: the seconds left (3, 2, 1), 0 for "Go!", or null once it has gone
function countAt(startsAt: number, now: number): number | null {
  const left = startsAt - now
  return left > 0 ? Math.ceil(left / 1000) : left > -GO_SHOWN_MS ? 0 : null
}

// The countdown before play begins. The board stays in view but dimmed, with the cell the opening click was
// made on ringed, and the dim lifts on the instant play begins: when a game is a race, that instant has to be
// unmistakable. Everything is timed to the moment itself, the sounds by the sound hardware's own clock
function StartCountdown({ startsAt, start }: { startsAt: number, start: { row: number, col: number } }) {
  const { settings } = useSettings()
  const [count, setCount] = useState(() => countAt(startsAt, Date.now()))
  const markerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const left = startsAt - Date.now()
    setCount(countAt(startsAt, Date.now()))
    const timers: ReturnType<typeof setTimeout>[] = []
    const cancelSounds: (() => void)[] = []

    // not when coming back to a game that is already under way
    if (left > -150) {
      // a beep and a new number on each second still to come, and the last of them is the start itself
      for (let seconds = Math.max(0, Math.ceil(left / 1000)); seconds >= 0; seconds--) {
        const wait = left - seconds * 1000
        if (wait < -150) continue
        cancelSounds.push(playSound(seconds > 0 ? "countdown" : "go", wait))
        timers.push(setTimeout(() => setCount(seconds), Math.max(0, wait)))
      }
    }
    timers.push(setTimeout(() => setCount(null), Math.max(0, left + GO_SHOWN_MS)))

    return () => {
      timers.forEach(clearTimeout)
      cancelSounds.forEach(cancel => cancel())
    }
  }, [startsAt])

  // on a board bigger than the screen, bring where it starts into view
  useEffect(() => {
    markerRef.current?.scrollIntoView({ block: "center", inline: "center" })
  }, [])

  if (count === null) return null
  const step = settings.cellSize + settings.cellGap
  return (
    <div className={`absolute inset-0 z-10 pointer-events-none rounded ${count > 0 ? "bg-black/45" : ""}`}>
      <div
        ref={markerRef}
        className="absolute rounded ring-4 ring-white shadow-[0_0_12px_4px_rgba(0,0,0,0.6)]"
        style={{ top: start.row * step, left: start.col * step, width: settings.cellSize, height: settings.cellSize }}
      />
      <div className="sticky top-1/3 flex justify-center">
        <span className={`text-7xl font-extrabold [text-shadow:0_2px_12px_rgba(0,0,0,0.9)] ${count > 0 ? "text-white" : "text-green-400"}`}>
          {count > 0 ? count : "Go!"}
        </span>
      </div>
    </div>
  )
}

type PlayableBoardProps = {
  settings: BoardSettings
  // this player's board as the server last sent it
  ownBoard: OwnBoard
  // when play begins, by this browser's clock
  startsAt: number | null
  // the cell the opening click was made on
  start: { row: number, col: number }
  finished: boolean
  onReveal: (row: number, col: number) => void
  onFlag: (row: number, col: number) => void
}

// A board in a game the server is running: a multiplayer game, or the daily challenge.
// The server decides what a click does, because it is the only one that knows where the mines are
export default function PlayableBoard({ settings, ownBoard, startsAt, start, finished, onReveal, onFlag }: PlayableBoardProps) {
  const { settings: display } = useSettings()
  const [chordHint, flashChordHint] = useChordHint()
  // where the win animation spreads out from
  const [lastClicked, setLastClicked] = useState<{ row: number, col: number } | null>(null)

  const board = useMemo(
    () => boardFromCells(settings, ownBoard.cells, finished),
    // the settings of a game never change, so its pieces are enough to go by
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ownBoard, settings.rows, settings.cols, settings.mines, finished],
  )
  useBoardSounds(board)
  // the app is told how wide the board is, so the left pane can make way for it in a narrow window
  useReportGameWidth(settings.cols * display.cellSize + (settings.cols - 1) * display.cellGap)

  const canPlay = useCallback(
    () => startsAt !== null && Date.now() >= startsAt && board.status === "playing" && Date.now() >= ownBoard.cooldownUntil,
    [startsAt, board, ownBoard],
  )

  const handleClick = useCallback((row: number, col: number) => {
    if (!canPlay()) return
    const cell = board.grid[row][col]
    if (cell.flagged || (cell.revealed && cell.hasMine)) return
    // A chord that can't happen yet flashes the cells it is waiting on, same as singleplayer; no need to ask the server
    if (cell.revealed && knownMinesAround(board, row, col) !== cell.neighborCount) return flashChordHint(row, col)
    setLastClicked({ row, col })
    onReveal(row, col)
  }, [board, canPlay, onReveal, flashChordHint])

  const handleRightClick = useCallback((row: number, col: number) => {
    if (canPlay()) onFlag(row, col)
  }, [canPlay, onFlag])

  return (
    <div className="overflow-x-auto hide-scrollbar pb-20">
      <div className="relative w-max">
        <Grid
          board={board}
          lastClicked={lastClicked}
          chordHint={chordHint}
          resetKey={0}
          onCellClick={handleClick}
          onCellRightClick={handleRightClick}
        />
        <MineCooldown until={ownBoard.cooldownUntil} />
        {startsAt !== null && <StartCountdown startsAt={startsAt} start={start} />}
      </div>
    </div>
  )
}

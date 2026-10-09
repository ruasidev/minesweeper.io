import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useReportGameWidth } from "../../context/GameWidthContext"
import { useSettings } from "../../context/SettingsContext"
import { useBoardSounds } from "../../hooks/useBoardSounds"
import { useChordHint } from "../../hooks/useChordHint"
import type { OwnBoard } from "../../hooks/useMultiplayer"
import { boardFromCells } from "../../lib/multiplayerBoard"
import { playSound } from "../../lib/sounds"
import type { Blast } from "../../game/types"
import { knownMinesAround } from "../../../shared/board"
import { CELL_FLAGGED, CELL_HIDDEN, CELL_MINE, mineBlastRadius, type BoardSettings } from "../../../shared/protocol"
import BoardGrid from "../minesweeper/BoardGrid"

// The board is only redrawn when the board itself changes, not for everything else going on around it
const Grid = memo(BoardGrid)

// Lies over the board for the moment a player sits out after a mine goes off: a faint red, and nothing can be clicked
function MineCooldown({ until }: { until: number }) {
  const [left, setLeft] = useState(() => until - Date.now())
  useEffect(() => {
    const tick = () => setLeft(until - Date.now())
    tick()
    const timer = setInterval(tick, 100)
    return () => clearInterval(timer)
  }, [until])

  if (left <= 0) return null
  return <div className="absolute inset-0 z-10 rounded bg-red-500/10 cursor-not-allowed" />
}

let nextBlastId = 1

// What a mine going off has just done to a board, worked out from how the board the server sent differs from the
// one before it: a mine uncovered that wasn't, and the cells around it that are covered again. Null when the
// latest change wasn't a mine going off
function useBlast(cells: string, cols: number): Blast | null {
  const [seen, setSeen] = useState<{ cells: string, blast: Blast | null }>({ cells, blast: null })
  // worked out while drawing, not after, so the blast is on screen in the same frame as the board it happened to
  if (cells !== seen.cells) {
    const before = seen.cells
    let blast: Blast | null = null
    const mineAt = before.length === cells.length ? [...cells].findIndex((char, at) => char === CELL_MINE && before[at] !== CELL_MINE) : -1
    if (mineAt >= 0) {
      const covered = new Set<string>()
      for (let at = 0; at < cells.length; at++) {
        if (cells[at] === CELL_HIDDEN && before[at] !== CELL_HIDDEN && before[at] !== CELL_FLAGGED) covered.add(`${Math.floor(at / cols)},${at % cols}`)
      }
      blast = { id: nextBlastId++, row: Math.floor(mineAt / cols), col: mineAt % cols, covered }
    }
    setSeen({ cells, blast })
  }
  return seen.blast
}

// The ring that spreads out from a mine as it goes off, as far as its blast reaches
export function BlastRing({ blast, radius }: { blast: Blast, radius: number }) {
  const { settings } = useSettings()
  const step = settings.cellSize + settings.cellGap
  const size = (2 * radius + 1) * step
  return (
    <div
      className="absolute z-10 rounded-full pointer-events-none game-motion animate-blastRing"
      style={{
        left: blast.col * step + settings.cellSize / 2 - size / 2,
        top: blast.row * step + settings.cellSize / 2 - size / 2,
        width: size,
        height: size,
      }}
    />
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
  // in the middle of the space it has, as the singleplayer board is, rather than against its left-hand edge
  centered?: boolean
  onReveal: (row: number, col: number) => void
  onFlag: (row: number, col: number) => void
}

// A board in a game the server is running: a multiplayer game, or the daily challenge.
// The server decides what a click does, because it is the only one that knows where the mines are
export default function PlayableBoard({ settings, ownBoard, startsAt, start, finished, centered, onReveal, onFlag }: PlayableBoardProps) {
  const { settings: display } = useSettings()
  const [chordHint, flashChordHint] = useChordHint()
  // where the win animation spreads out from
  const [lastClicked, setLastClicked] = useState<{ row: number, col: number } | null>(null)
  const blast = useBlast(ownBoard.cells, settings.cols)

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
      {/* centred while it fits; a board wider than its space starts at the left and scrolls */}
      <div className={`relative w-max ${centered ? "mx-auto" : ""}`}>
        <Grid
          board={board}
          lastClicked={lastClicked}
          chordHint={chordHint}
          blast={blast}
          resetKey={0}
          onCellClick={handleClick}
          onCellRightClick={handleRightClick}
        />
        <MineCooldown until={ownBoard.cooldownUntil} />
        {blast && <BlastRing key={blast.id} blast={blast} radius={mineBlastRadius(settings)} />}
        {startsAt !== null && <StartCountdown startsAt={startsAt} start={start} />}
      </div>
    </div>
  )
}

const nothing = () => {}

// Another player's board, watched by someone whose own game is over: the same board, but only to look at
export function SpectatedBoard({ settings, board: watched }: { settings: BoardSettings, board: OwnBoard }) {
  const { settings: display } = useSettings()
  const blast = useBlast(watched.cells, settings.cols)
  const board = useMemo(
    // never drawn as won: a board that is already finished shouldn't play its win all over again for whoever looks in
    () => boardFromCells(settings, watched.cells, false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [watched, settings.rows, settings.cols, settings.mines],
  )
  useReportGameWidth(settings.cols * display.cellSize + (settings.cols - 1) * display.cellGap)

  return (
    <div className="overflow-x-auto hide-scrollbar pb-20">
      <div className="relative w-max mx-auto pointer-events-none">
        <Grid board={board} lastClicked={null} chordHint={null} blast={blast} resetKey={0} onCellClick={nothing} onCellRightClick={nothing} />
        <MineCooldown until={watched.cooldownUntil} />
        {blast && <BlastRing key={blast.id} blast={blast} radius={mineBlastRadius(settings)} />}
      </div>
    </div>
  )
}

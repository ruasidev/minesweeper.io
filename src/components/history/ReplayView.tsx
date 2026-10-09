import { memo, useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, Pause, Play, SkipBack, StepBack, StepForward } from "lucide-react"
import { useReportGameWidth } from "../../context/GameWidthContext"
import { useSettings } from "../../context/SettingsContext"
import { useTheme } from "../../context/ThemeContext"
import type { Blast } from "../../game/types"
import { useFormStyles } from "../../hooks/useFormStyles"
import { getRecordedGame, type RecordedGame } from "../../lib/api"
import { avatarSrc } from "../../lib/avatar"
import { describeBoard, describeOutcome } from "../../lib/gameResults"
import { makeReplay, movesMadeBy, type Replay } from "../../lib/replay"
import { formatScore } from "../../lib/time"
import type { Board } from "../../../shared/board"
import { mineBlastRadius } from "../../../shared/protocol"
import BoardGrid from "../minesweeper/BoardGrid"
import { BlastRing } from "../multiplayer/PlayableBoard"

// The board is only redrawn when a move changes it, not for every tick of the clock in between
const Grid = memo(BoardGrid)
const nothing = () => {}

const KINDS: Record<RecordedGame["kind"], string> = { singleplayer: "Singleplayer", multiplayer: "Multiplayer", daily: "Daily challenge" }
const SPEEDS = [0.25, 0.5, 1, 2, 4, 8]
let nextBlastId = 1

// The board as it stood after some number of the moves, and the mine that went off getting there, if the board
// before it is the one that was showing: so a blast is drawn when playing forwards, and not when jumping about
type Shown = { moveCount: number, board: Board, blast: Blast | null }

function show(replay: Replay, moveCount: number, before: Shown | null): Shown {
  const board = replay.boardAfter(moveCount)
  let blast: Blast | null = null
  if (before && moveCount === before.moveCount + 1 && replay.mineHitsAfter(moveCount) > replay.mineHitsAfter(before.moveCount)) {
    const mine = board.grid.flat().find(cell => cell.hasMine && cell.revealed && !before.board.grid[cell.row][cell.col].revealed)
    const covered = new Set(board.grid.flat().filter(cell => !cell.revealed && before.board.grid[cell.row][cell.col].revealed).map(cell => `${cell.row},${cell.col}`))
    if (mine && covered.size > 0) blast = { id: nextBlastId++, row: mine.row, col: mine.col, covered }
  }
  return { moveCount, board, blast }
}

// A recorded game being played back. It can be paused, run faster or slower, stepped through a move at a time,
// or dragged to any moment; and the mines can be shown, which the player never saw
function Playback({ game, onBack }: { game: RecordedGame, onBack: () => void }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { settings: display } = useSettings()
  const replay = useMemo(() => makeReplay(game), [game])
  // how far into the replay, in milliseconds
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [showMines, setShowMines] = useState(false)

  const moveCount = movesMadeBy(replay, position)
  const [shown, setShown] = useState<Shown>(() => show(replay, 0, null))
  // worked out while drawing, so the board and the move it shows never fall out of step
  if (shown.moveCount !== moveCount) setShown(show(replay, moveCount, shown))
  // drawn as a game in progress whatever its end: a win or a loss playing out over it would get in the way of going back
  const board = useMemo(() => ({ ...shown.board, status: "playing" as const }), [shown.board])
  const atEnd = position >= replay.lengthMs

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const passed = now - last
      last = now
      setPosition(at => Math.min(replay.lengthMs, at + passed * speed))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, replay.lengthMs])

  // it stops by itself at the end
  useEffect(() => {
    if (atEnd) setPlaying(false)
  }, [atEnd])

  // to the moment a move was made (or back to the start)
  const goToMove = (count: number) => {
    const to = Math.max(0, Math.min(replay.moves.length, count))
    setPlaying(false)
    setPosition(to === 0 ? 0 : replay.times[to - 1])
  }
  const togglePlaying = () => {
    if (atEnd) setPosition(0)
    setPlaying(now => atEnd ? true : !now)
  }

  // Space plays and pauses, the arrow keys step a move at a time
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === " ") { e.preventDefault(); togglePlaying() }
      if (e.key === "ArrowLeft") goToMove(moveCount - 1)
      if (e.key === "ArrowRight") goToMove(moveCount + 1)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  })

  const step = display.cellSize + display.cellGap
  useReportGameWidth(game.cols * display.cellSize + (game.cols - 1) * display.cellGap)
  const lastMove = moveCount > 0 ? replay.moves[moveCount - 1] : null
  const lastHitMine = moveCount > 0 && replay.mineHitsAfter(moveCount) > replay.mineHitsAfter(moveCount - 1)
  const iconButton = `${styles.ghost} p-2!`

  return (
    <>
      <section className={`${styles.card} flex flex-wrap items-center gap-x-6 gap-y-3 p-4 cursor-default ${theme.textBody}`}>
        <div className="flex items-center gap-3 min-w-0">
          <img src={avatarSrc(game.image)} alt="" referrerPolicy="no-referrer" className={`w-9 h-9 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`} />
          <div className="min-w-0">
            <div className={`font-semibold truncate ${theme.textHead}`}>@{game.username} · {KINDS[game.kind]} · {describeBoard(game)}</div>
            <div className="text-sm opacity-70">
              {describeOutcome(game.outcome, game.durationMs)} · {new Date(game.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </div>
        </div>
        <button className={`${styles.ghost} ml-auto`} onClick={onBack}>Back to the history</button>
      </section>

      {/* stays in view while a tall board is scrolled */}
      <section className={`${styles.card} sticky top-0 z-20 flex flex-col gap-3 p-4 cursor-default ${theme.textBody}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1">
            <button className={iconButton} title="Back to the start" onClick={() => goToMove(0)}><SkipBack className="w-4 h-4" /></button>
            <button className={iconButton} title="Back one move (←)" onClick={() => goToMove(moveCount - 1)}><StepBack className="w-4 h-4" /></button>
            <button className={`${styles.button} p-2!`} title={playing ? "Pause (space)" : "Play (space)"} onClick={togglePlaying}>
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button className={iconButton} title="On one move (→)" onClick={() => goToMove(moveCount + 1)}><StepForward className="w-4 h-4" /></button>
          </div>

          <div className="flex items-center gap-1" role="group" aria-label="Speed">
            {SPEEDS.map(option => (
              <button key={option} aria-pressed={speed === option} className={`${styles.option(speed === option)} px-2! py-1! tabular-nums`} onClick={() => setSpeed(option)}>
                {option}×
              </button>
            ))}
          </div>

          <button className={`${styles.ghost} inline-flex items-center gap-2 text-sm`} aria-pressed={showMines} onClick={() => setShowMines(on => !on)}>
            {showMines ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showMines ? "Hide the mines" : "Show the mines"}
          </button>

          <span className="ml-auto text-sm font-semibold tabular-nums">
            Move {moveCount} of {replay.moves.length}
            {replay.mineHitsAfter(moveCount) > 0 && ` · ${replay.mineHitsAfter(moveCount)} ${replay.mineHitsAfter(moveCount) === 1 ? "mine" : "mines"} hit`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-16 text-sm font-semibold tabular-nums">{formatScore(replay.startMs + position)}</span>
          <input
            type="range"
            aria-label="Position in the replay"
            min={0}
            max={replay.lengthMs}
            step={1}
            value={position}
            onChange={e => setPosition(Number(e.target.value))}
            className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-red-500 ${theme.cellHidden}`}
          />
          <span className="w-16 text-right text-sm tabular-nums opacity-70">{formatScore(replay.startMs + replay.lengthMs)}</span>
        </div>
      </section>

      <div className="overflow-x-auto hide-scrollbar pb-20">
        <div className="relative w-max mx-auto pointer-events-none">
          <Grid board={board} lastClicked={null} chordHint={null} blast={shown.blast} resetKey={0} onCellClick={nothing} onCellRightClick={nothing} />
          {/* where the mines are: the player never saw this */}
          {showMines && board.grid.flat().filter(cell => cell.hasMine && !cell.revealed).map(cell => (
            <span
              key={`${cell.row}-${cell.col}`}
              className="absolute rounded-full bg-red-500 ring-2 ring-black/40"
              style={{
                top: cell.row * step + display.cellSize / 2 - display.cellSize * 0.14,
                left: cell.col * step + display.cellSize / 2 - display.cellSize * 0.14,
                width: display.cellSize * 0.28,
                height: display.cellSize * 0.28,
              }}
            />
          ))}
          {/* the cell the latest move was made on: red where it set a mine off, amber for a flag */}
          {lastMove && (
            <span
              className={`absolute rounded ring-[3px] ${lastHitMine ? "ring-red-500" : lastMove[1] === 1 ? "ring-amber-400" : "ring-white"} shadow-[0_0_8px_2px_rgba(0,0,0,0.5)]`}
              style={{ top: lastMove[2] * step, left: lastMove[3] * step, width: display.cellSize, height: display.cellSize }}
            />
          )}
          {shown.blast && <BlastRing key={shown.blast.id} blast={shown.blast} radius={mineBlastRadius(game)} />}
        </div>
      </div>
    </>
  )
}

// Fetches a recorded game and plays it back
export default function ReplayView({ gameId, onBack }: { gameId: number, onBack: () => void }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const [game, setGame] = useState<RecordedGame | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setGame(null)
    getRecordedGame(gameId)
      .then(loaded => { if (!cancelled) { setGame(loaded); setError(null) } })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [gameId])

  if (game) return <Playback key={game.id} game={game} onBack={onBack} />
  return (
    <div className={`${styles.card} flex flex-col items-start gap-3 p-4 ${theme.textBody}`}>
      {error ? <p role="alert" className="text-sm text-red-500 font-semibold">{error}</p> : <p className="text-sm opacity-70 cursor-default">Loading the game…</p>}
      <button className={styles.ghost} onClick={onBack}>Back to the history</button>
    </div>
  )
}

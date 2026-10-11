import { memo, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Check, Eye, EyeOff, Link, Pause, Play, SkipBack, StepBack, StepForward } from "lucide-react"
import { useReportGameWidth } from "../../context/GameWidthContext"
import { useSettings } from "../../context/SettingsContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useLayout } from "../../hooks/useLayout"
import { getRecordedGame, type OtherPlayersGame, type RecordedGame } from "../../lib/api"
import { blastBetween, type Blast } from "../../lib/blast"
import { boardSpan } from "../../lib/boardFit"
import { cellBox, dotIn } from "../../lib/boardMetrics"
import { viewOfBoard, type BoardView } from "../../lib/boardView"
import { avatarSrc } from "../../lib/avatar"
import { describeOutcome } from "../../lib/gameResults"
import { makeOtherReplay, makeReplay, movesMadeBy, progressAfter, type Replay } from "../../lib/replay"
import { playSound } from "../../lib/sounds"
import { formatScore } from "../../lib/time"
import { sectionSizeOf } from "../../../shared/engine/analysis"
import { boardName } from "../../../shared/game/boards"
import { gameName, mineBlastRadius, rulesOf } from "../../../shared/game/modes"
import { CELL_MINE } from "../../../shared/engine/view"
import { MOVE_CLICK, MOVE_FLAG } from "../../../shared/protocol"
import BoardGrid from "../minesweeper/BoardGrid"
import { BlastRing } from "../minesweeper/BoardOverlays"
import BoardStage from "../minesweeper/BoardStage"
import BoardViewport from "../minesweeper/BoardViewport"
import OpponentBox from "../multiplayer/OpponentBox"
import { plural } from "../../lib/text"

// The board is only redrawn when a move changes it, not for every tick of the clock in between
const Grid = memo(BoardGrid)
const nothing = () => {}

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8]

// The board as it stood after some number of the moves, and the mine that went off getting there, if the board
// before it is the one that was showing: so a blast is drawn when playing forwards, and not when jumping about
type Shown = { moveCount: number, view: BoardView, blast: Blast | null }

function show(replay: Replay, moveCount: number, before: Shown | null): Shown {
  // drawn as a game in progress whatever its end: a win or a loss playing out over it would get in the way of going back
  const view: BoardView = { ...viewOfBoard(replay.boardAfter(moveCount)), status: "playing" }
  const oneMoveOn = before !== null && moveCount === before.moveCount + 1
  const blast = oneMoveOn ? blastBetween(before.view.cells, view.cells, view.cols) : null
  // a mine that covered nothing back up has no blast worth drawing
  return { moveCount, view, blast: blast && blast.covered.size > 0 ? blast : null }
}

// One of the other players of a multiplayer game being played back: their small pixelated board, as far along as
// they were `gameMs` into the game. It is drawn by what draws it during a game, from their own recorded moves
function OtherPlayer({ game, other, gameMs, chip }: { game: RecordedGame, other: OtherPlayersGame, gameMs: number, chip?: boolean }) {
  const replay = useMemo(() => makeOtherReplay(game, other), [game, other])
  const moveCount = movesMadeBy(replay, gameMs - replay.startMs)
  const over = gameMs >= other.durationMs
  // worked out again when they make a move or their game ends, not for every tick of the clock in between
  const progress = useMemo(
    () => progressAfter(replay, { rows: game.rows, cols: game.cols, outcome: other.outcome, durationMs: other.durationMs }, moveCount, over),
    [replay, game.rows, game.cols, other.outcome, other.durationMs, moveCount, over],
  )
  return (
    <OpponentBox
      chip={chip}
      player={{ id: other.userId, username: other.username, image: other.image }}
      progress={progress}
      sectionCols={Math.ceil(game.cols / sectionSizeOf(game.rows, game.cols))}
    />
  )
}

// A recorded game being played back. It can be paused, run faster or slower, stepped through a move at a time,
// or dragged to any moment; and the mines can be shown, which the player never saw
function Playback({ game, onBack }: { game: RecordedGame, onBack: () => void }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { settings: display } = useSettings()
  const { compact, short } = useLayout()
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
  // The mines are in every board being played back. They are only drawn over it when asked for, and the board
  // itself is drawn without them, so a mine never looks any different from the cell beside it
  const drawn = useMemo(() => ({ ...shown.view, layout: null }), [shown.view])
  const hiddenMines = useMemo(
    () => (showMines ? Array.from(shown.view.cells, (cell, at) => (shown.view.layout?.[at] === "1" && cell !== CELL_MINE ? at : -1)).filter(at => at >= 0) : []),
    [showMines, shown.view],
  )
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

  // The link to this replay, put on the clipboard. Where the browser won't allow that, it is shown to be copied by hand
  const [copied, setCopied] = useState(false)
  function copyLink() {
    const link = window.location.href
    const done = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => window.prompt("Copy this link to the replay:", link))
    else window.prompt("Copy this link to the replay:", link)
  }

  // a sound for the game being opened (once, however many times the effect is run while developing)
  const announced = useRef(false)
  useEffect(() => {
    if (announced.current) return
    announced.current = true
    playSound("replayOpen")
  }, [])

  // The game's own sounds, as the moves are made: while it is playing, and when stepping on a move by hand.
  // Not when going back or jumping somewhere else, where they would be noise. Several moves can pass in one frame
  // at high speed; they make one sound between them, the most telling one
  const heardUpTo = useRef(0)
  useEffect(() => {
    const before = heardUpTo.current
    heardUpTo.current = moveCount
    const made = moveCount - before
    if (made < 1 || (made > 1 && !playing)) return

    if (replay.mineHitsAfter(moveCount) > replay.mineHitsAfter(before)) {
      // where a mine ends the game it was the end of this one; anywhere else it went off and the game carried on
      if (rulesOf(game.mode).mine === "ends") {
        playSound("mineClick")
        playSound("boardExplodes")
      } else {
        playSound("mineHit")
      }
    } else if (moveCount === replay.moves.length && game.outcome === "cleared") {
      playSound("win")
    } else if (replay.moves.slice(before, moveCount).some(move => move[1] === MOVE_CLICK)) {
      playSound("reveal")
    } else {
      playSound("flag")
    }
  }, [moveCount, playing, replay, game.mode, game.outcome])

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

  useReportGameWidth(boardSpan(game.cols, display.cellSize, display.cellGap))
  const lastMove = moveCount > 0 ? replay.moves[moveCount - 1] : null
  const lastHitMine = moveCount > 0 && replay.mineHitsAfter(moveCount) > replay.mineHitsAfter(moveCount - 1)
  const iconButton = `${styles.ghost} ${compact ? "p-2.5!" : "p-2!"}`
  // Everyone else who played a multiplayer game, each as far along as they were at the moment on show: beside the
  // board as they were during the game, or a strip of thumbnails on a small screen
  const others = (chip?: boolean) => game.others.map(other => (
    <OtherPlayer key={other.id} game={game} other={other} gameMs={replay.startMs + position} chip={chip} />
  ))

  const board = (
    <BoardViewport rows={game.rows} cols={game.cols} centered readOnly className="pb-4">
      <Grid view={drawn} origin={null} chordHint={null} blast={shown.blast} resetKey={0} onCellClick={nothing} onCellRightClick={nothing} />
      {/* where the mines are: the player never saw this */}
      {hiddenMines.map(at => (
        <span key={at} className="absolute rounded-full bg-red-500 ring-2 ring-black/40" style={dotIn(Math.floor(at / game.cols), at % game.cols, 0.28)} />
      ))}
      {/* the cell the latest move was made on: red where it set a mine off, amber for a flag */}
      {lastMove && (
        <span
          className={`absolute rounded ring-[3px] ${lastHitMine ? "ring-red-500" : lastMove[1] === MOVE_FLAG ? "ring-amber-400" : "ring-white"} shadow-[0_0_8px_2px_rgba(0,0,0,0.5)]`}
          style={cellBox(lastMove[2], lastMove[3])}
        />
      )}
      {shown.blast && <BlastRing key={shown.blast.id} blast={shown.blast} radius={mineBlastRadius(game)} />}
    </BoardViewport>
  )

  const transport = (
    <div className="flex items-center gap-1">
      <button className={iconButton} title="Back to the start" onClick={() => goToMove(0)}><SkipBack className="w-4 h-4" /></button>
      <button className={iconButton} title="Back one move (←)" onClick={() => goToMove(moveCount - 1)}><StepBack className="w-4 h-4" /></button>
      <button className={`${styles.button} ${compact ? "p-2.5!" : "p-2!"}`} title={playing ? "Pause (space)" : "Play (space)"} onClick={togglePlaying}>
        {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </button>
      <button className={iconButton} title="On one move (→)" onClick={() => goToMove(moveCount + 1)}><StepForward className="w-4 h-4" /></button>
    </div>
  )
  const scrubber = (
    <input
      type="range"
      aria-label="Position in the replay"
      min={0}
      max={replay.lengthMs}
      step={1}
      value={position}
      onChange={e => setPosition(Number(e.target.value))}
      className={`flex-1 min-w-0 h-2 rounded-lg appearance-none cursor-pointer accent-red-500 ${theme.cellHidden}`}
    />
  )
  const mineHits = replay.mineHitsAfter(moveCount)
  const moveCounter = (
    <>
      Move {moveCount} of {replay.moves.length}
      {mineHits > 0 && ` · ${plural(mineHits, "mine")} hit`}
    </>
  )

  // On a small screen the board has the room, and the controls are a dock under it, as they are on a video:
  // where it has got to on top, and under that what is pressed, with the speeds folded into one button that steps
  // through them and the mines behind an eye
  if (compact) {
    return (
      <BoardStage
        status={
          <div className="flex flex-col gap-2">
          <section className={`${styles.card} flex items-center gap-1 p-1.5 cursor-default ${short ? "flex-wrap" : ""} ${theme.textBody}`}>
            <button className={`${styles.ghost} shrink-0 p-2.5!`} title="Back to the history" aria-label="Back to the history" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0 text-sm">
              <div className={`font-semibold leading-tight truncate ${theme.textHead}`}>@{game.username} · {boardName(game)}</div>
              <div className="opacity-70 leading-tight truncate">{gameName(game.mode)} · {describeOutcome(game.outcome, game.durationMs)}</div>
            </div>
            <button className={`${styles.ghost} shrink-0 p-2.5!`} title={copied ? "Link copied" : "Copy a link to this replay"} aria-label="Copy a link to this replay" onClick={copyLink}>
              {copied ? <Check className="w-5 h-5" /> : <Link className="w-5 h-5" />}
            </button>
          </section>
          {game.others.length > 0 && <div className={`flex gap-2 ${short ? "flex-col" : "overflow-x-auto hide-scrollbar"}`}>{others(true)}</div>}
          </div>
        }
        dock={
          <section className={`${styles.card} flex flex-col gap-1 px-2 py-2 cursor-default ${theme.textBody}`}>
            <div className="flex items-center gap-2 px-1 text-xs font-semibold tabular-nums">
              <span>{formatScore(replay.startMs + position)}</span>
              {!short && scrubber}
              <span className={short ? "ml-auto opacity-70" : "opacity-70"}>{formatScore(replay.startMs + replay.lengthMs)}</span>
            </div>
            {short && <div className="flex px-1 py-2">{scrubber}</div>}
            <div className={`flex items-center gap-1 ${short ? "flex-wrap" : ""}`}>
              {transport}
              <span className="flex-1 min-w-0 px-1 text-center text-xs font-semibold tabular-nums truncate">{moveCounter}</span>
              <button
                className={`${styles.ghost} shrink-0 w-12 px-0! py-2.5! text-sm tabular-nums`}
                title="Playback speed: tap to change"
                onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
              >
                {speed}×
              </button>
              <button className={`${showMines ? styles.option(true) : styles.ghost} shrink-0 p-2.5!`} aria-pressed={showMines} title={showMines ? "Hide the mines" : "Show the mines"} onClick={() => setShowMines(on => !on)}>
                {showMines ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </section>
        }
      >
        {board}
      </BoardStage>
    )
  }

  return (
    <>
      <section className={`${styles.card} flex flex-wrap items-center gap-x-6 gap-y-3 p-4 cursor-default ${theme.textBody}`}>
        <div className="flex items-center gap-3 min-w-0">
          <img src={avatarSrc(game.image)} alt="" referrerPolicy="no-referrer" className={`w-9 h-9 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`} />
          <div className="min-w-0">
            <div className={`font-semibold truncate ${theme.textHead}`}>@{game.username} · {gameName(game.mode)} · {boardName(game)}</div>
            <div className="text-sm opacity-70">
              {describeOutcome(game.outcome, game.durationMs)} · {new Date(game.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* the page's own address is the link to this game: it names the player and the game */}
          <button className={`${styles.ghost} inline-flex items-center gap-2`} title="Copy a link to this replay" onClick={copyLink}>
            {copied ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
            {copied ? "Link copied" : "Share"}
          </button>
          <button className={styles.ghost} onClick={onBack}>Back to the history</button>
        </div>
      </section>

      {game.others.length > 0 && <div className={`flex flex-wrap justify-center gap-6 cursor-default ${theme.textBody}`}>{others()}</div>}

      {board}

      {/* The controls run along the bottom, as on a video. They stay there while a tall board is scrolled,
          and sit at the foot of the screen under a short one */}
      <section className={`${styles.card} sticky bottom-2 z-20 mt-auto flex flex-col gap-3 p-4 cursor-default ${theme.textBody}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {transport}

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

          <span className="ml-auto text-sm font-semibold tabular-nums">{moveCounter}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-16 text-sm font-semibold tabular-nums">{formatScore(replay.startMs + position)}</span>
          {scrubber}
          <span className="w-16 text-right text-sm tabular-nums opacity-70">{formatScore(replay.startMs + replay.lengthMs)}</span>
        </div>
      </section>
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

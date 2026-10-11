import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useReportGameWidth } from "../../context/GameWidthContext"
import { useSettings } from "../../context/SettingsContext"
import { useBlast } from "../../hooks/useBlast"
import { useBoardSounds } from "../../hooks/useBoardSounds"
import { useChordHint } from "../../hooks/useChordHint"
import { boardSpan } from "../../lib/boardFit"
import { boardView, viewOfGame } from "../../lib/boardView"
import type { LiveGame, WatchedGame } from "../../lib/connection"
import { cellAt } from "../../../shared/engine/field"
import { CELL_FLAGGED, CELL_MINE, canChord, isUncovered } from "../../../shared/engine/view"
import { mineBlastRadius, rulesOf } from "../../../shared/game/modes"
import type { BoardSettings, CellPosition } from "../../../shared/protocol"
import BoardGrid from "./BoardGrid"
import { BlastRing, MineCooldown, StartCountdown } from "./BoardOverlays"
import BoardViewport from "./BoardViewport"

// The board is only redrawn when the board itself changes, not for everything else going on around it
const Grid = memo(BoardGrid)

// how wide a board is drawn at the size the player has set, so the app can make room for it
function useBoardWidth({ cols }: BoardSettings): number {
  const { cellSize, cellGap } = useSettings().settings
  return boardSpan(cols, cellSize, cellGap)
}

type LiveBoardProps = {
  // the player's own game, as the server last reported it
  game: LiveGame
  // in the middle of the space it has, as the singleplayer board is, rather than against its left-hand edge
  centered?: boolean
  onReveal: (row: number, col: number) => void
  onFlag: (row: number, col: number) => void
}

// A player's board in a game the server is running, whatever game it is: what lies over it (a countdown, a mine
// going off) follows from the game's rules. The server decides what a click does, because it is the only one that
// knows where the mines are
export default function LiveBoard({ game, centered, onReveal, onFlag }: LiveBoardProps) {
  const { settings } = game
  const rules = rulesOf(game.mode)
  const [chordHint, flashChordHint] = useChordHint()
  // where the win animation spreads out from
  const [origin, setOrigin] = useState<CellPosition | null>(null)
  const blast = useBlast(game.cells, settings.cols)
  const view = useMemo(() => viewOfGame(game), [game])
  useBoardSounds(view)
  useReportGameWidth(useBoardWidth(settings))

  // the latest of the game, for the handlers below: they are handed to the grid, which shouldn't redraw for them
  const latest = useRef({ game, view })
  useEffect(() => {
    latest.current = { game, view }
  })
  // not during the countdown, not once it is over, and not while sitting out after a mine
  const canPlay = () => {
    const { game } = latest.current
    const now = Date.now()
    return game.outcome === "playing" && now >= game.startedAt && now >= game.cooldownUntil
  }

  const handleClick = useCallback((row: number, col: number) => {
    if (!canPlay()) return
    const { view } = latest.current
    const at = cellAt(view.cols, row, col)
    const cell = view.cells[at]
    if (cell === CELL_FLAGGED || cell === CELL_MINE) return
    // A chord that can't happen yet flashes the cells it is waiting on; no need to ask the server
    if (isUncovered(cell) && !canChord(view.cells, view.rows, view.cols, at)) return flashChordHint(row, col)
    setOrigin({ row, col })
    onReveal(row, col)
  }, [onReveal, flashChordHint])

  const handleRightClick = useCallback((row: number, col: number) => {
    if (canPlay()) onFlag(row, col)
  }, [onFlag])

  return (
    <BoardViewport rows={settings.rows} cols={settings.cols} centered={centered} className="pb-20">
      <Grid view={view} origin={origin} chordHint={chordHint} blast={blast} resetKey={0} onCellClick={handleClick} onCellRightClick={handleRightClick} />
      <MineCooldown until={game.cooldownUntil} />
      {blast && <BlastRing key={blast.id} blast={blast} radius={mineBlastRadius(settings)} />}
      {rules.opening === "dealt" && <StartCountdown startsAt={game.startedAt} opening={game.opening} />}
    </BoardViewport>
  )
}

const nothing = () => {}

// Another player's board, watched by someone whose own game is over: the same board, but only to look at
export function WatchedBoard({ settings, watched }: { settings: BoardSettings, watched: WatchedGame }) {
  const blast = useBlast(watched.cells, settings.cols)
  // never drawn as won: a board that is already finished shouldn't play its win all over again for whoever looks in
  const view = useMemo(() => boardView(settings, watched.cells, "playing"), [settings, watched.cells])
  useReportGameWidth(useBoardWidth(settings))

  return (
    <BoardViewport rows={settings.rows} cols={settings.cols} centered readOnly className="pb-20">
      <Grid view={view} origin={null} chordHint={null} blast={blast} resetKey={0} onCellClick={nothing} onCellRightClick={nothing} />
      <MineCooldown until={watched.cooldownUntil} />
      {blast && <BlastRing key={blast.id} blast={blast} radius={mineBlastRadius(settings)} />}
    </BoardViewport>
  )
}

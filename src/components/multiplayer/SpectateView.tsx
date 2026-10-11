import { ArrowLeft } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useLayout } from "../../hooks/useLayout"
import type { ServerConnection } from "../../hooks/useServerConnection"
import { describeResult } from "../../lib/gameResults"
import type { GameSummary } from "../../../shared/protocol"
import BoardStage from "../minesweeper/BoardStage"
import { WatchedBoard } from "../minesweeper/LiveBoard"
import { plural } from "../../lib/text"

type SpectateViewProps = {
  game: GameSummary
  // whose board
  playerId: string
  connection: ServerConnection
  onBack: () => void
  onWatch: (playerId: string) => void
}

// One player's board, for someone whose own game is over: live while that player is still going, and as they left
// it once they aren't. The others are a click away along the top
export default function SpectateView({ game, playerId, connection, onBack, onWatch }: SpectateViewProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { compact, short } = useLayout()
  const progress = game.progress[playerId]
  // the board that has arrived may still be the last player's, for a moment after switching
  const watched = connection.watching?.playerId === playerId ? connection.watching : null

  const players = game.players.map(player => (
    <button
      key={player.id}
      aria-pressed={player.id === playerId}
      className={`${styles.option(player.id === playerId)} shrink-0 px-3 ${compact ? "py-2" : "py-1"}`}
      onClick={() => onWatch(player.id)}
    >
      @{player.username}
    </button>
  ))
  const standing = progress && (
    <span className="inline-flex items-center gap-2 font-semibold tabular-nums">
      {progress.outcome === "playing" && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
      {describeResult(progress)}
      {progress.mineHits > 0 && ` · ${plural(progress.mineHits, "mine")} hit`}
    </span>
  )
  const board = watched
    ? <WatchedBoard settings={game.settings} watched={watched} />
    : <p className={`text-sm opacity-70 cursor-default ${compact ? "flex-1 p-4" : ""} ${theme.textBody}`}>Loading their board…</p>

  // On a small screen the board gets the room: the way back and whose board it is go in one strip, with the
  // players to switch between in a row that scrolls sideways (or, on a phone held sideways, down the side)
  if (compact) {
    return (
      <BoardStage
        status={
          <section className={`${styles.card} flex flex-col gap-2 p-2 cursor-default ${theme.textBody}`}>
            <div className="flex items-center gap-2 min-w-0">
              <button className={`${styles.ghost} shrink-0 p-2.5!`} title="Back to results" aria-label="Back to results" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0 text-sm">
                <div className="opacity-70 leading-tight">Spectating</div>
                <div className="truncate leading-tight">{standing}</div>
              </div>
            </div>
            <div className={`flex gap-1 ${short ? "flex-col" : "overflow-x-auto hide-scrollbar"}`}>{players}</div>
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm opacity-70">Spectating</span>
          {players}
        </div>
        {standing}
        <button className={`${styles.ghost} ml-auto`} onClick={onBack}>Back to results</button>
      </section>

      {board}
    </>
  )
}

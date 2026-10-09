import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import type { Multiplayer } from "../../hooks/useMultiplayer"
import { describeResult } from "../../lib/gameResults"
import type { GameSummary } from "../../../shared/protocol"
import { SpectatedBoard } from "./PlayableBoard"

type SpectateViewProps = {
  game: GameSummary
  // whose board
  playerId: string
  multiplayer: Multiplayer
  onBack: () => void
  onWatch: (playerId: string) => void
}

// One player's board, for someone whose own game is over: live while that player is still going, and as they left
// it once they aren't. The others are a click away along the top
export default function SpectateView({ game, playerId, multiplayer, onBack, onWatch }: SpectateViewProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const progress = game.progress[playerId]
  // the board that has arrived may still be the last player's, for a moment after switching
  const watched = multiplayer.watching?.playerId === playerId ? multiplayer.watching.board : null

  return (
    <>
      <section className={`${styles.card} flex flex-wrap items-center gap-x-6 gap-y-3 p-4 cursor-default ${theme.textBody}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm opacity-70">Spectating</span>
          {game.players.map(player => (
            <button
              key={player.id}
              aria-pressed={player.id === playerId}
              className={`${styles.option(player.id === playerId)} px-3 py-1`}
              onClick={() => onWatch(player.id)}
            >
              @{player.username}
            </button>
          ))}
        </div>
        {progress && (
          <span className="inline-flex items-center gap-2 font-semibold tabular-nums">
            {progress.outcome === "playing" && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
            {describeResult(progress)}
            {progress.mineHits > 0 && ` · ${progress.mineHits} ${progress.mineHits === 1 ? "mine" : "mines"} hit`}
          </span>
        )}
        <button className={`${styles.ghost} ml-auto`} onClick={onBack}>Back to results</button>
      </section>

      {watched
        ? <SpectatedBoard settings={game.settings} board={watched} />
        : <p className={`text-sm opacity-70 cursor-default ${theme.textBody}`}>Loading their board…</p>}
    </>
  )
}

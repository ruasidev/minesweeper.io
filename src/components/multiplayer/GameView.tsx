import { useEffect, useState } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import type { Multiplayer } from "../../hooks/useMultiplayer"
import { formatDuration } from "../../lib/time"
import type { GameSummary, RoomDetail } from "../../../shared/protocol"
import OpponentBox from "./OpponentBox"
import PlayableBoard from "./PlayableBoard"

// How long a game has been going, or how long this player took once they've finished
export function GameClock({ startedAt, finishedMs }: { startedAt: number | null, finishedMs: number | null }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (finishedMs !== null) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [finishedMs])
  return <span className="tabular-nums">{formatDuration(finishedMs ?? (startedAt === null ? 0 : now - startedAt))}</span>
}

// A multiplayer game in progress: this player's own board, and everyone else's progress above it
export default function GameView({ room, game, multiplayer }: { room: RoomDetail, game: GameSummary, multiplayer: Multiplayer }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { session } = useAccount()

  const myId = session?.user.id
  const mine = myId ? game.progress[myId] : undefined
  const finishedMs = mine?.finishedMs ?? null

  // 1 for the fastest finisher so far
  const place = finishedMs === null ? null
    : 1 + Object.values(game.progress).filter(other => other.finishedMs !== null && other.finishedMs < finishedMs).length
  const opponents = room.players.filter(player => player.id !== myId && game.progress[player.id])

  return (
    <>
      <section className={`${styles.card} flex flex-wrap items-center gap-x-6 gap-y-3 p-4 cursor-default ${theme.textBody}`}>
        <h2 className={`text-xl font-semibold truncate ${theme.textHead}`}>{room.name}</h2>
        <span className="font-semibold"><GameClock startedAt={multiplayer.gameStartedAt} finishedMs={finishedMs} /></span>
        {mine && <span className="font-semibold">{mine.percent}% uncovered</span>}
        {mine && mine.mineHits > 0 && <span className="font-semibold">{mine.mineHits} {mine.mineHits === 1 ? "mine" : "mines"} hit</span>}
        {place !== null && (
          <span className="font-semibold text-green-500">
            Finished: place {place} of {Object.keys(game.progress).length}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {room.hostId === myId && <button className={styles.button} onClick={multiplayer.endGame}>End game</button>}
          <button className={styles.button} onClick={multiplayer.leaveRoom}>Leave room</button>
        </div>
      </section>

      {opponents.length > 0 && (
        <div className="flex flex-wrap gap-6">
          {opponents.map(player => (
            <OpponentBox key={player.id} player={player} progress={game.progress[player.id]} game={game} />
          ))}
        </div>
      )}

      {multiplayer.board && (
        <PlayableBoard
          settings={game.settings}
          ownBoard={multiplayer.board}
          startsAt={multiplayer.gameStartedAt}
          start={game.start}
          finished={finishedMs !== null}
          onReveal={multiplayer.reveal}
          onFlag={multiplayer.flag}
        />
      )}
    </>
  )
}

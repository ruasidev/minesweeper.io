import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import type { Multiplayer } from "../../hooks/useMultiplayer"
import { useTimeLeft } from "../../hooks/useTimeLeft"
import { avatarSrc } from "../../lib/avatar"
import { describeResult, ordinal } from "../../lib/gameResults"
import { formatScore, formatTimeLeft } from "../../lib/time"
import type { GameSummary, PlayerProgress, RoomDetail } from "../../../shared/protocol"
import PlayerName from "../account/PlayerName"
import OpponentBox from "./OpponentBox"

type ResultsViewProps = {
  room: RoomDetail
  game: GameSummary
  multiplayer: Multiplayer
  onBackToRoom: () => void
  // look at one player's board
  onWatch: (playerId: string) => void
}

// What the top of the screen says about how this player's own game went
function headline(mine: PlayerProgress | undefined, playerCount: number): { title: string, detail: string, tone: string } {
  const hits = mine && mine.mineHits > 0 ? ` · ${mine.mineHits} ${mine.mineHits === 1 ? "mine" : "mines"} hit` : ""
  switch (mine?.outcome) {
    case "cleared":
      return {
        title: playerCount === 1 ? "Board cleared!" : mine.place === 1 ? "You won!" : `You finished ${ordinal(mine.place)}`,
        detail: `Cleared in ${formatScore(mine.finishedMs ?? 0)}${hits}`,
        tone: "text-green-500",
      }
    case "gaveUp":
      return { title: "You gave up", detail: `${mine.percent}% of the board uncovered${hits}`, tone: "text-red-500" }
    case "timedOut":
      return { title: "Did not finish", detail: `The game was stopped with ${mine.percent}% of your board uncovered${hits}`, tone: "text-red-500" }
    default:
      return { title: "Results", detail: "", tone: "" }
  }
}

function TimeLeft({ deadlineAt }: { deadlineAt: number }) {
  const left = useTimeLeft(deadlineAt)
  return <span className="font-bold tabular-nums">{formatTimeLeft(left)}</span>
}

// How far the game moved a player's rating
function RatingChange({ change, pending }: { change: number | null, pending: boolean }) {
  if (change === null) return <span className="opacity-50">{pending ? "…" : "–"}</span>
  if (change === 0) return <span className="opacity-70">±0</span>
  return <span className={`font-bold ${change > 0 ? "text-green-500" : "text-red-500"}`}>{change > 0 ? `+${change}` : `−${-change}`}</span>
}

// The finish screen: what a player sees once their own game is over, whether they cleared the board, gave up or were
// stopped. It says how they did, lists everyone whose game is over in the order they came, and under that shows
// the boards of whoever is still playing, each one a click away from being watched. It keeps itself up to date
// until the last player is done
export default function ResultsView({ room, game, multiplayer, onBackToRoom, onWatch }: ResultsViewProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { session } = useAccount()
  const myId = session?.user.id
  const mine = myId ? game.progress[myId] : undefined
  const { title, detail, tone } = headline(mine, game.players.length)

  // best first; among those who haven't cleared the board the order can still change while the game is on
  const rows = game.players
    .map(player => ({ player, progress: game.progress[player.id] }))
    .filter(row => row.progress)
    .sort((a, b) => a.progress.place - b.progress.place)
  const stillPlaying = rows.filter(row => row.progress.outcome === "playing")
  // the standings are of the players whose game is over; the rest are shown with their boards underneath
  const done = rows.filter(row => row.progress.outcome !== "playing")
  // ratings only move in a game that counts, and when there was somebody to be measured against
  const rated = game.rated && game.players.length > 1

  const headClass = `px-4 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${theme.textHead}`
  const cellClass = "px-4 py-2.5 whitespace-nowrap"

  return (
    <>
      <section className={`${styles.card} flex flex-wrap items-center gap-x-6 gap-y-4 p-5 cursor-default ${theme.textBody}`}>
        <div className="min-w-0">
          <div className="text-sm opacity-70 truncate">{room.name}</div>
          <h2 className={`text-3xl font-extrabold ${tone || theme.textHead}`}>{title}</h2>
          {detail && <div className="mt-1 font-semibold tabular-nums">{detail}</div>}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {room.hostId === myId && !game.over && (
            <button className={styles.ghost} title="Stop the game for everyone still playing" onClick={multiplayer.endGame}>End game</button>
          )}
          <button className={styles.button} onClick={onBackToRoom}>Back to room</button>
          <button className={styles.ghost} onClick={multiplayer.leaveRoom}>Leave room</button>
        </div>
      </section>

      <section className={`${styles.card} overflow-hidden cursor-default ${theme.textBody}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
          <h2 className={`text-xl font-semibold ${theme.textHead}`}>{game.over ? "Final standings" : "Standings so far"}</h2>
          <span className="text-sm opacity-70">{game.over ? "The game is over." : "Places are filled in as players finish."}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className={`border-y ${theme.itemBorder} ${theme.itemBg}`}>
                <th className={`${headClass} w-12`}>#</th>
                <th className={headClass}>Player</th>
                <th className={headClass}>Result</th>
                <th className={`${headClass} text-right`}>Mines hit</th>
                <th className={`${headClass} text-right`}>Rating</th>
                <th className={headClass} />
              </tr>
            </thead>
            <tbody>
              {done.map(({ player, progress }) => (
                <tr key={player.id} className={`border-b last:border-b-0 ${theme.itemBorder} ${player.id === myId ? theme.itemBg : ""}`}>
                  {/* a place is only shown once it can't change any more */}
                  <td className={`${cellClass} font-bold tabular-nums`}>{progress.outcome === "cleared" || game.over ? progress.place : "–"}</td>
                  <td className={cellClass}>
                    <div className="flex items-center gap-3">
                      <img
                        src={avatarSrc(player.image)}
                        alt=""
                        referrerPolicy="no-referrer"
                        className={`w-7 h-7 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
                      />
                      <PlayerName playerId={player.id} username={player.username} />
                      {player.id === myId && <span className={styles.tag}>You</span>}
                    </div>
                  </td>
                  <td className={`${cellClass} tabular-nums ${progress.outcome === "cleared" ? "font-bold" : ""}`}>{describeResult(progress)}</td>
                  <td className={`${cellClass} text-right tabular-nums`}>{progress.mineHits}</td>
                  <td className={`${cellClass} text-right tabular-nums`}>
                    <RatingChange change={progress.ratingChange} pending={rated && game.over} />
                  </td>
                  <td className={`${cellClass} text-right`}>
                    <button
                      className={styles.ghostSmall}
                      title="Look at the board as they left it"
                      onClick={() => onWatch(player.id)}
                    >
                      {player.id === myId ? "My board" : "View board"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!game.over || !game.rated) && game.players.length > 1 && (
          <p className={`px-4 py-3 text-xs opacity-70 border-t ${theme.itemBorder}`}>
            {game.rated
              ? "Ratings move once the game is over. Playing the same opponent again the same day counts for less each time."
              : "This game is unrated: only games in public rooms count towards ratings."}
          </p>
        )}
      </section>

      {stillPlaying.length > 0 && (
        <section className={`${styles.card} flex flex-col gap-4 p-4 cursor-default ${theme.textBody}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 className={`inline-flex items-center gap-2 text-xl font-semibold ${theme.textHead}`}>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Still playing ({stillPlaying.length})
            </h2>
            <span className="text-sm opacity-70">
              {multiplayer.gameDeadlineAt !== null
                ? <><TimeLeft deadlineAt={multiplayer.gameDeadlineAt} /> left to clear the board. Click a board to watch it.</>
                : "No time limit until half the players have finished. Click a board to watch it."}
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            {stillPlaying.map(({ player, progress }) => (
              <OpponentBox key={player.id} player={player} progress={progress} game={game} onSpectate={() => onWatch(player.id)} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

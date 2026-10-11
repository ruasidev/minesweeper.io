import { useEffect, useState } from "react"
import { useTheme } from "../../context/ThemeContext"
import { navigate } from "../../hooks/useRoute"
import { getSuspectGames, setScoresHidden, type ScoreSelection, type SuspectGame } from "../../lib/api"
import { formatScore } from "../../lib/time"
import { gameName, isSingleplayerMode } from "../../../shared/game/modes"
import { useFormStyles } from "../../hooks/useFormStyles"

// The latest games that were too fast to have been a person playing. Each was kept off the leaderboards when it
// happened; an admin who has looked into one and thinks it honest can put the player's results back
export default function SuspectGamesPanel() {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const [games, setGames] = useState<SuspectGame[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // the games whose results were put back just now
  const [restored, setRestored] = useState<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false
    getSuspectGames()
      .then(loaded => { if (!cancelled) setGames(loaded.games) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [])

  function restore(game: SuspectGame) {
    if (!window.confirm(`Put @${game.username}'s results on this board back on the leaderboards?`)) return
    const board = { userId: game.userId, rows: game.rows, cols: game.cols, mines: game.mines }
    const scores: ScoreSelection = game.kind === "daily"
      // a day's challenge belongs to the day (UTC) it was played on
      ? { kind: "daily", userId: game.userId, date: game.at.slice(0, 10) }
      // the leaderboards of the game it was: each singleplayer game has its own
      : isSingleplayerMode(game.mode) ? { kind: "singleplayer", mode: game.mode, ...board }
      : { kind: "multiplayer", ...board }
    setScoresHidden(scores, false).then(() => setRestored(done => new Set(done).add(game.id)), (e: Error) => setError(e.message))
  }

  return (
    <section className={`rounded-xl border shadow-lg shadow-black/40 ring-1 ring-white/10 overflow-hidden ${theme.menuBg} ${theme.menuBorder}`}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 p-4 cursor-default">
        <h2 className={`text-xl font-semibold ${theme.textHead}`}>Suspect games</h2>
        <span className={`text-sm opacity-70 ${theme.textBody}`}>
          Cleared faster than a person plays. They are kept off the leaderboards unless you put them back.
        </span>
      </div>

      {error && <p role="alert" className="px-4 pb-4 text-sm text-red-500 font-semibold">{error}</p>}

      <div className="overflow-x-auto">
        <table className={`w-full text-sm text-left select-text ${theme.textBody}`}>
          <thead>
            <tr className={`border-y ${theme.itemBorder} ${theme.itemBg}`}>
              <th className={styles.th}>When</th>
              <th className={styles.th}>Player</th>
              <th className={styles.th}>Game</th>
              <th className={styles.th}>Board</th>
              <th className={`${styles.th} text-right`}>Time</th>
              <th className={`${styles.th} text-right`}>Clicks needed</th>
              <th className={`${styles.th} text-right`}>Moves made</th>
              <th className={styles.th}>Why</th>
              <th className={`${styles.th} sticky right-0 ${theme.itemBg}`} />
            </tr>
          </thead>
          <tbody>
            {games?.map(game => (
              <tr key={game.id} className={`border-b last:border-b-0 ${theme.itemBorder}`}>
                <td className={styles.td}>{new Date(game.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td className={`${styles.td} font-semibold`}>@{game.username}</td>
                <td className={styles.td}>{gameName(game.mode)}</td>
                <td className={`${styles.td} tabular-nums`}>{game.rows} × {game.cols} · {game.mines}</td>
                <td className={`${styles.td} text-right tabular-nums`}>{formatScore(game.durationMs)}</td>
                <td className={`${styles.td} text-right tabular-nums`}>{game.clicksNeeded}</td>
                <td className={`${styles.td} text-right tabular-nums`}>{game.moves}</td>
                <td className="px-4 py-2 min-w-64">{game.reason}</td>
                <td className={`${styles.td} text-right sticky right-0 ${theme.menuBg}`}>
                  <button
                    className={`${styles.ghostSmall} mr-2 select-none`}
                    onClick={() => navigate("history", game.userId, game.id)}
                  >
                    Watch
                  </button>
                  {restored.has(game.id) ? <span className="text-xs opacity-70">Put back</span> : (
                    <button
                      className={`${styles.ghostSmall} select-none`}
                      onClick={() => restore(game)}
                    >
                      Put back
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {games?.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 opacity-70 cursor-default">Nothing has looked wrong so far.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

import { useEffect, useState } from "react"
import { useTheme } from "../../context/ThemeContext"
import { ghostColors } from "../../game/themes"
import { navigate } from "../../hooks/useRoute"
import { getSuspectGames, setScoresHidden, type SuspectGame } from "../../lib/api"
import { formatScore } from "../../lib/time"

const KINDS: Record<SuspectGame["kind"], string> = { singleplayer: "Singleplayer", multiplayer: "Multiplayer", daily: "Daily challenge" }

// The latest games that were too fast to have been a person playing. Each was kept off the leaderboards when it
// happened; an admin who has looked into one and thinks it honest can put the player's results back
export default function SuspectGamesPanel() {
  const { theme } = useTheme()
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
    const scores = game.kind === "daily"
      // a day's challenge belongs to the day (UTC) it was played on
      ? { kind: "daily" as const, userId: game.userId, date: game.at.slice(0, 10) }
      : { kind: game.kind, userId: game.userId, rows: game.rows, cols: game.cols, mines: game.mines }
    setScoresHidden(scores, false).then(() => setRestored(done => new Set(done).add(game.id)), (e: Error) => setError(e.message))
  }

  const headClass = `px-4 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${theme.textHead}`
  const cellClass = "px-4 py-2 whitespace-nowrap"

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
              <th className={headClass}>When</th>
              <th className={headClass}>Player</th>
              <th className={headClass}>Game</th>
              <th className={headClass}>Board</th>
              <th className={`${headClass} text-right`}>Time</th>
              <th className={`${headClass} text-right`}>Clicks needed</th>
              <th className={`${headClass} text-right`}>Moves made</th>
              <th className={headClass}>Why</th>
              <th className={`${headClass} sticky right-0 ${theme.itemBg}`} />
            </tr>
          </thead>
          <tbody>
            {games?.map(game => (
              <tr key={game.id} className={`border-b last:border-b-0 ${theme.itemBorder}`}>
                <td className={cellClass}>{new Date(game.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td className={`${cellClass} font-semibold`}>@{game.username}</td>
                <td className={cellClass}>{KINDS[game.kind]}</td>
                <td className={`${cellClass} tabular-nums`}>{game.rows} × {game.cols} · {game.mines}</td>
                <td className={`${cellClass} text-right tabular-nums`}>{formatScore(game.durationMs)}</td>
                <td className={`${cellClass} text-right tabular-nums`}>{game.clicksNeeded}</td>
                <td className={`${cellClass} text-right tabular-nums`}>{game.moves}</td>
                <td className="px-4 py-2 min-w-64">{game.reason}</td>
                <td className={`${cellClass} text-right sticky right-0 ${theme.menuBg}`}>
                  <button
                    className={`mr-2 px-2 py-1 rounded text-xs font-semibold pressable select-none ${ghostColors(theme)}`}
                    onClick={() => navigate("history", game.userId, game.id)}
                  >
                    Watch
                  </button>
                  {restored.has(game.id) ? <span className="text-xs opacity-70">Put back</span> : (
                    <button
                      className={`px-2 py-1 rounded text-xs font-semibold pressable select-none ${ghostColors(theme)}`}
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

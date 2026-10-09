import { useEffect, useState } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { getDaily, getLeaderboard, setScoresHidden, type ScoreEntry } from "../../lib/api"
import { BOARD_PRESETS } from "../../../shared/protocol"
import { NAV_SPACE } from "../app/MainNavigation"
import ScoreTable from "./ScoreTable"

// The boards with a leaderboard: the classic ones as played in multiplayer, and today's daily challenge
const BOARDS = [
  ...BOARD_PRESETS.map(preset => ({ id: preset.id, label: preset.label })),
  { id: "daily", label: "Today's challenge" },
]

// The leaderboards. They take the game's place beside the left pane
export default function LeaderboardScreen() {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { session, isAdmin } = useAccount()
  const [board, setBoard] = useState(BOARDS[1].id)
  const [mode, setMode] = useState<"multiplayer" | "singleplayer">("multiplayer")
  // null while it loads
  const [entries, setEntries] = useState<ScoreEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // the day the challenge on show belongs to
  const [dailyDate, setDailyDate] = useState<string | null>(null)
  // bumped to load the board again, after an admin has taken something off it
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    const loading = board === "daily"
      ? getDaily().then((daily) => { if (!cancelled) setDailyDate(daily.date); return daily })
      : getLeaderboard(board, mode)
    loading
      .then(loaded => { if (!cancelled) { setEntries(loaded.entries); setError(null) } })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [board, mode, reload])

  // Admins: takes a player's results off the board on show. (They come back from the admin screen.)
  function remove(entry: ScoreEntry) {
    const preset = BOARD_PRESETS.find(candidate => candidate.id === board)
    const scores = board === "daily"
      ? dailyDate && { kind: "daily" as const, userId: entry.userId, date: dailyDate }
      : preset && { kind: mode, userId: entry.userId, ...preset.settings }
    if (!scores || !window.confirm(`Take @${entry.username}'s results off this leaderboard?`)) return
    setScoresHidden(scores, true).then(() => setReload(n => n + 1), (e: Error) => setError(e.message))
  }

  return (
    <div className={`h-full overflow-y-auto hide-scrollbar ${theme.background}`} style={{ paddingLeft: NAV_SPACE }}>
      <div className="flex flex-col gap-4 py-4 pl-2 pr-4 max-w-4xl">
        <h1 className={`text-2xl font-semibold cursor-default ${theme.textHead}`}>Leaderboard</h1>

        <section className={`${styles.card} overflow-hidden`}>
          <div className="flex flex-col gap-3 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {BOARDS.map(option => (
                <button key={option.id} aria-pressed={board === option.id} className={styles.option(board === option.id)} onClick={() => setBoard(option.id)}>
                  {option.label}
                </button>
              ))}
            </div>
            {board !== "daily" && (
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <button aria-pressed={mode === "multiplayer"} className={styles.option(mode === "multiplayer")} onClick={() => setMode("multiplayer")}>Multiplayer</button>
                <button aria-pressed={mode === "singleplayer"} className={styles.option(mode === "singleplayer")} onClick={() => setMode("singleplayer")}>Singleplayer</button>
              </div>
            )}
            <p className={`text-sm opacity-70 cursor-default ${theme.textBody}`}>
              {board === "daily" ? "Everyone who has cleared today's board, quickest first."
                : mode === "multiplayer" ? "Each player's fastest clear of this board in a multiplayer game. These games are run by the server, so the times are checked."
                : "Each player's fastest singleplayer win on this board. The server runs these games too, so the times are checked."}
            </p>
          </div>

          {error && <p role="alert" className="px-4 pb-4 text-sm text-red-500 font-semibold">{error}</p>}
          {entries && (
            <ScoreTable
              entries={entries}
              emptyText={board === "daily" ? "Nobody has cleared today's board yet." : `Nobody has cleared this board in ${mode} yet.`}
              highlightUserId={session?.user.id}
              showDate={board !== "daily"}
              hideMineHits={board !== "daily" && mode === "singleplayer"}
              onRemove={isAdmin ? remove : undefined}
            />
          )}
        </section>
      </div>
    </div>
  )
}

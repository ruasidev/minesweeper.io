import { useEffect, useState } from "react"
import { CalendarDays, ShieldCheck, Swords, User } from "lucide-react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { getDaily, getLeaderboard, setScoresHidden, type ScoreEntry } from "../../lib/api"
import { ordinal } from "../../lib/gameResults"
import { formatScore } from "../../lib/time"
import { BOARD_PRESETS, DAILY_BOARD_SETTINGS, type BoardSettings } from "../../../shared/protocol"
import Page from "../app/Page"
import Segmented from "../app/Segmented"
import ScoreTable from "./ScoreTable"

// The kinds of game with a leaderboard, named and drawn as they are in the navigation
type Kind = "singleplayer" | "multiplayer" | "daily"
const KINDS = [
  { id: "singleplayer" as const, label: "Singleplayer", icon: <User className="max-sm:hidden w-4 h-4 shrink-0" /> },
  { id: "multiplayer" as const, label: "Multiplayer", icon: <Swords className="max-sm:hidden w-4 h-4 shrink-0" /> },
  { id: "daily" as const, label: "Daily", icon: <CalendarDays className="max-sm:hidden w-4 h-4 shrink-0" /> },
]
// ...and the boards each of the first two is ranked on
const BOARDS = BOARD_PRESETS.map(preset => ({ id: preset.id, label: preset.label }))

const describe = ({ rows, cols, mines }: BoardSettings) => `${rows} × ${cols}, ${mines} mines`
const WHAT: Record<Kind, string> = {
  singleplayer: "Each player's fastest singleplayer win",
  multiplayer: "Each player's fastest clear in a multiplayer game",
  daily: "Everyone who has cleared today's board, quickest first",
}

// The leaderboards. Two questions pick the one on show, asked in the order a player thinks of them: which kind of
// game, then (for the kinds played on more than one) which board. Under them, where this player stands on it,
// and then the board itself
export default function LeaderboardScreen() {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { session, isAdmin } = useAccount()
  const [kind, setKind] = useState<Kind>("singleplayer")
  const [board, setBoard] = useState(BOARD_PRESETS[1].id)
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
    const loading = kind === "daily"
      ? getDaily().then((daily) => { if (!cancelled) setDailyDate(daily.date); return daily })
      : getLeaderboard(board, kind)
    loading
      .then(loaded => { if (!cancelled) { setEntries(loaded.entries); setError(null) } })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [kind, board, reload])

  const preset = BOARD_PRESETS.find(candidate => candidate.id === board)
  const settings = kind === "daily" ? DAILY_BOARD_SETTINGS : preset?.settings

  // Admins: takes a player's results off the board on show. (They come back from the admin screen.)
  function remove(entry: ScoreEntry) {
    const scores = kind === "daily"
      ? dailyDate && { kind: "daily" as const, userId: entry.userId, date: dailyDate }
      : preset && { kind, userId: entry.userId, ...preset.settings }
    if (!scores || !window.confirm(`Take @${entry.username}'s results off this leaderboard?`)) return
    setScoresHidden(scores, true).then(() => setReload(n => n + 1), (e: Error) => setError(e.message))
  }

  const myId = session?.user.id
  const myPlace = entries && myId ? entries.findIndex(entry => entry.userId === myId) : -1

  return (
    <Page title="Leaderboard" maxWidth="max-w-3xl">
      <section className={`${styles.card} overflow-hidden`}>
        <div className="flex flex-col gap-3 p-4">
          <Segmented label="Kind of game" options={KINDS} value={kind} onChange={setKind} />
          {kind !== "daily" && <Segmented small label="Board" options={BOARDS} value={board} onChange={setBoard} />}
          <p className={`text-sm cursor-default ${theme.textBody}`}>
            <span className="opacity-70">{WHAT[kind]}</span>
            {settings && <span className="opacity-70"> · {describe(settings)}</span>}
            {kind === "daily" && dailyDate && <span className="opacity-70"> · {dailyDate}</span>}
          </p>
        </div>

        {/* where the player looking stands on this board, said outright rather than left for them to find in the list */}
        {myId && entries && (
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 border-t cursor-default ${theme.itemBorder} ${theme.textBody}`}>
            <span className="text-xs font-semibold uppercase tracking-wide opacity-60">You</span>
            {myPlace >= 0 ? (
              <>
                <span className={`font-bold ${theme.textHead}`}>{ordinal(myPlace + 1)} of {entries.length}</span>
                <span className={`ml-auto text-base font-bold tabular-nums ${theme.textHead}`}>{formatScore(entries[myPlace].durationMs)}</span>
              </>
            ) : (
              <span className="text-sm opacity-70">
                {kind === "daily" ? "You haven't cleared today's board yet." : "Not on this board yet: clear it to get a place."}
              </span>
            )}
          </div>
        )}

        {error && <p role="alert" className="px-4 py-3 text-sm text-red-500 font-semibold">{error}</p>}
        {!entries && !error && <p className={`px-4 py-10 border-t text-center text-sm opacity-70 cursor-default ${theme.itemBorder} ${theme.textBody}`}>Loading…</p>}
        {entries && (
          <ScoreTable
            entries={entries}
            emptyText={kind === "daily" ? "Nobody has cleared today's board yet. Be the first." : `Nobody has cleared this board in ${kind} yet. Be the first.`}
            highlightUserId={myId}
            showDate={kind !== "daily"}
            hideMineHits={kind === "singleplayer"}
            onRemove={isAdmin ? remove : undefined}
          />
        )}
      </section>

      <p className={`flex items-center gap-2 px-1 text-xs opacity-60 cursor-default ${theme.textBody}`}>
        <ShieldCheck className="w-4 h-4 shrink-0" />
        The server runs every ranked game and times it, so these times are checked.
      </p>
    </Page>
  )
}

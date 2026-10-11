import { Trophy } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { ghostColors } from "../../game/themes"
import { useFormStyles } from "../../hooks/useFormStyles"
import type { ScoreEntry } from "../../lib/api"
import { avatarSrc } from "../../lib/avatar"
import { MEDALS } from "../../lib/gameResults"
import { formatScore } from "../../lib/time"
import PlayerName from "../account/PlayerName"
import { plural } from "../../lib/text"

type ScoreTableProps = {
  entries: ScoreEntry[]
  // shown instead of the table when nobody is on it yet
  emptyText: string
  // this player's own row stands out
  highlightUserId?: string
  // show the day each time was set (not needed when they are all from today)
  showDate?: boolean
  // leave out how many mines were hit (in singleplayer a mine ends the game, so it's always none)
  hideMineHits?: boolean
  // For admins: takes that player's results off this leaderboard. Each row gets a button for it when this is given
  onRemove?: (entry: ScoreEntry) => void
}

const dayOf = (at: string | number | Date) => new Date(at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })

// A leaderboard: who cleared a board, quickest first. A row reads the way a result is said: where they came, who
// they are, and at the end of the row the time, which is what the board is ranked by. On a phone there is only room
// for those three, so the rest of each row (mines hit, the day) moves to a small line under the player's name
export default function ScoreTable({ entries, emptyText, highlightUserId, showDate, hideMineHits, onRemove }: ScoreTableProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  if (entries.length === 0) {
    return (
      <div className={`flex flex-col items-center gap-3 px-6 py-10 border-t text-center cursor-default ${theme.itemBorder} ${theme.textBody}`}>
        <Trophy className="w-8 h-8 opacity-40" />
        <p className="opacity-70">{emptyText}</p>
      </div>
    )
  }

  // shown as columns of their own only where there is room for them
  const wideOnly = "hidden sm:table-cell"

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm text-left cursor-default ${theme.textBody}`}>
        <thead>
          <tr className={`border-y ${theme.itemBorder} ${theme.itemBg}`}>
            <th className={`${styles.th} w-12 sm:w-14 text-center`}>#</th>
            <th className={styles.th}>Player</th>
            {!hideMineHits && <th className={`${styles.th} ${wideOnly} text-right`}>Mines hit</th>}
            {showDate && <th className={`${styles.th} ${wideOnly}`}>Set on</th>}
            <th className={`${styles.th} text-right`}>Time</th>
            {onRemove && <th className={styles.th} />}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const own = entry.userId === highlightUserId
            return (
              <tr key={entry.userId} className={`border-b last:border-b-0 ${theme.itemBorder} ${own ? theme.itemBg : ""}`}>
                <td className={`${styles.td} text-center`}>
                  {index < MEDALS.length
                    ? <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-extrabold tabular-nums ${MEDALS[index]}`}>{index + 1}</span>
                    : <span className="font-semibold tabular-nums opacity-70">{index + 1}</span>}
                </td>
                <td className={styles.td}>
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarSrc(entry.image)}
                      alt=""
                      referrerPolicy="no-referrer"
                      className={`w-7 h-7 shrink-0 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <PlayerName playerId={entry.userId} username={entry.username} />
                        {own && <span className={styles.tag}>You</span>}
                      </div>
                      {(showDate || !hideMineHits) && (
                        <div className="sm:hidden text-xs opacity-60">
                          {[!hideMineHits && `${plural(entry.mineHits, "mine")} hit`, showDate && dayOf(entry.at)].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                {!hideMineHits && <td className={`${styles.td} ${wideOnly} text-right tabular-nums`}>{entry.mineHits}</td>}
                {showDate && <td className={`${styles.td} ${wideOnly} opacity-80`}>{dayOf(entry.at)}</td>}
                <td className={`${styles.td} text-right text-base font-bold tabular-nums ${theme.textHead}`}>{formatScore(entry.durationMs)}</td>
                {onRemove && (
                  <td className={`${styles.td} text-right`}>
                    <button
                      className={`px-2 py-1 rounded text-xs font-semibold pressable ${ghostColors(theme)}`}
                      title="Admins: take this player's results off this leaderboard"
                      onClick={() => onRemove(entry)}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

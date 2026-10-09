import { useTheme } from "../../context/ThemeContext"
import { ghostColors } from "../../game/themes"
import type { ScoreEntry } from "../../lib/api"
import { avatarSrc } from "../../lib/avatar"
import { formatScore } from "../../lib/time"
import PlayerName from "../account/PlayerName"

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

// A leaderboard: who cleared a board, quickest first
export default function ScoreTable({ entries, emptyText, highlightUserId, showDate, hideMineHits, onRemove }: ScoreTableProps) {
  const { theme } = useTheme()
  if (entries.length === 0) return <p className={`px-4 pb-4 opacity-70 cursor-default ${theme.textBody}`}>{emptyText}</p>

  const headClass = `px-4 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${theme.textHead}`
  const cellClass = "px-4 py-2 whitespace-nowrap"

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm text-left cursor-default ${theme.textBody}`}>
        <thead>
          <tr className={`border-y ${theme.itemBorder} ${theme.itemBg}`}>
            <th className={`${headClass} w-12`}>#</th>
            <th className={headClass}>Player</th>
            <th className={`${headClass} text-right`}>Time</th>
            {!hideMineHits && <th className={`${headClass} text-right`}>Mines hit</th>}
            {showDate && <th className={headClass}>Set on</th>}
            {onRemove && <th className={headClass} />}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={entry.userId} className={`border-b last:border-b-0 ${theme.itemBorder} ${entry.userId === highlightUserId ? theme.itemBg : ""}`}>
              <td className={`${cellClass} font-semibold tabular-nums`}>{index + 1}</td>
              <td className={cellClass}>
                <div className="flex items-center gap-3">
                  <img
                    src={avatarSrc(entry.image)}
                    alt=""
                    referrerPolicy="no-referrer"
                    className={`w-7 h-7 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
                  />
                  <PlayerName playerId={entry.userId} username={entry.username} />
                </div>
              </td>
              <td className={`${cellClass} text-right font-semibold tabular-nums`}>{formatScore(entry.durationMs)}</td>
              {!hideMineHits && <td className={`${cellClass} text-right tabular-nums`}>{entry.mineHits}</td>}
              {showDate && <td className={cellClass}>{new Date(entry.at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</td>}
              {onRemove && (
                <td className={`${cellClass} text-right`}>
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
          ))}
        </tbody>
      </table>
    </div>
  )
}

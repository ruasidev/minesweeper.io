import { useTheme } from "../../context/ThemeContext"
import type { Profile } from "../../lib/api"
import SidebarSectionHeader from "../menu/SidebarSectionHeader"

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`

// 5025 → "1h 23m"
const formatPlayTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

type ProfileStatsProps = Pick<Profile, "stats" | "elo" | "gamesStarted" | "playSeconds">

// How a player has done: their rating and how much they have played in every mode, their singleplayer record,
// and their fastest singleplayer win on the boards they've won most
export default function ProfileStats({ stats, elo, gamesStarted, playSeconds }: ProfileStatsProps) {
  const { theme } = useTheme()
  const boxClass = `p-3 rounded border cursor-default ${theme.itemBg} ${theme.itemBorder} ${theme.textBody}`
  const winRate = stats.gamesPlayed > 0 ? Math.round(stats.wins / stats.gamesPlayed * 100) : 0

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div>
        <SidebarSectionHeader text="All modes" />
        <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
          <div className={boxClass} title="Multiplayer rating. Everyone starts at 1000"><div className="text-lg">{elo}</div>Rating</div>
          <div className={boxClass}><div className="text-lg">{gamesStarted}</div>Started</div>
          <div className={boxClass}><div className="text-lg">{formatPlayTime(playSeconds)}</div>In games</div>
        </div>
      </div>

      <div>
        <SidebarSectionHeader text="Singleplayer" />
        <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
          <div className={boxClass}><div className="text-lg">{stats.gamesPlayed}</div>Games</div>
          <div className={boxClass}><div className="text-lg">{stats.wins}</div>Wins</div>
          <div className={boxClass}><div className="text-lg">{winRate}%</div>Win rate</div>
        </div>
      </div>

      {stats.bestTimes.length > 0 && (
        <div>
          <SidebarSectionHeader text="Best Times" />
          <div className="flex flex-col gap-2 text-sm font-semibold">
            {stats.bestTimes.map(best => (
              <div key={`${best.rows}x${best.cols}x${best.mines}`} className={`${boxClass} flex justify-between`}>
                <span>{best.rows} × {best.cols}, {best.mines} {best.mines === 1 ? "mine" : "mines"}</span>
                <span className="tabular-nums">{formatTime(best.seconds)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

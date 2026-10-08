import { useTheme } from "../../context/ThemeContext"
import { formatDuration } from "../../lib/time"
import { SECTION_LEVELS, type GameSummary, type Player, type PlayerProgress } from "../../../shared/protocol"

// The box is at most about this wide, however many sections the board has
const BOX_WIDTH = 132

// Another player's board, seen from a distance: one square per section of it, greener the more of that section is done
export default function OpponentBox({ player, progress, game }: { player: Player, progress: PlayerProgress, game: GameSummary }) {
  const { theme } = useTheme()
  const pixel = Math.max(4, Math.min(12, Math.floor(BOX_WIDTH / game.sectionCols)))

  return (
    <div className={`flex flex-col items-start gap-1 cursor-default ${theme.textBody}`}>
      <span className="max-w-36 text-sm font-semibold truncate">@{player.username}</span>
      <div
        className={`grid gap-px p-1 border ${theme.menuBg} ${theme.menuBorder}`}
        style={{ gridTemplateColumns: `repeat(${game.sectionCols}, ${pixel}px)`, gridAutoRows: `${pixel}px` }}
      >
        {progress.sections.map((level, section) => (
          <div key={section} className={theme.cellHidden}>
            <div className="w-full h-full bg-green-500" style={{ opacity: level / SECTION_LEVELS }} />
          </div>
        ))}
      </div>
      <span className="text-xs opacity-70 tabular-nums">
        {progress.finishedMs !== null ? `Finished in ${formatDuration(progress.finishedMs)}` : `${progress.percent}%`}
        {progress.mineHits > 0 && ` · ${progress.mineHits} ${progress.mineHits === 1 ? "mine" : "mines"} hit`}
      </span>
    </div>
  )
}

import type { ReactNode } from "react"
import { Eye } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { describeResult } from "../../lib/gameResults"
import { SECTION_LEVELS, type GameSummary, type Player, type PlayerProgress } from "../../../shared/protocol"

// The box is at most about this wide, however many sections the board has
const BOX_WIDTH = 132

type OpponentBoxProps = {
  player: Player
  progress: PlayerProgress
  game: GameSummary
  // Given where the box can be clicked to watch this player's board: it is then drawn as a button, and a little larger
  onSpectate?: () => void
}

// Another player's board, seen from a distance: one square per section of it, greener the more of that section is done
export default function OpponentBox({ player, progress, game, onSpectate }: OpponentBoxProps) {
  const { theme } = useTheme()
  const width = onSpectate ? BOX_WIDTH * 1.25 : BOX_WIDTH
  const pixel = Math.max(4, Math.min(onSpectate ? 16 : 12, Math.floor(width / game.sectionCols)))

  const box: ReactNode = (
    <>
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
        {progress.outcome === "cleared" ? `Finished in ${describeResult(progress)}`
          : progress.outcome === "playing" ? `${progress.percent}%`
          : describeResult(progress)}
        {progress.mineHits > 0 && ` · ${progress.mineHits} ${progress.mineHits === 1 ? "mine" : "mines"} hit`}
      </span>
    </>
  )

  if (!onSpectate) return <div className={`flex flex-col items-start gap-1 cursor-default ${theme.textBody}`}>{box}</div>
  return (
    <button
      className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left pressable cursor-pointer
        ${theme.itemBg} ${theme.itemBorder} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.textBody}`}
      title={`Watch @${player.username} play`}
      onClick={onSpectate}
    >
      {box}
      <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold">
        <Eye className="w-3.5 h-3.5" />
        Spectate
      </span>
    </button>
  )
}

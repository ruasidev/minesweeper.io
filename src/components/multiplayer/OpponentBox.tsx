import type { ReactNode } from "react"
import { Eye } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { useLayout } from "../../hooks/useLayout"
import { describeResult } from "../../lib/gameResults"
import { SECTION_LEVELS, type Player, type PlayerProgress } from "../../../shared/protocol"
import { plural } from "../../lib/text"

// The box is at most about this wide, however many sections the board has
const BOX_WIDTH = 132
// ...and the thumbnail on a chip
const CHIP_WIDTH = 32

type OpponentBoxProps = {
  player: Player
  progress: PlayerProgress
  // how many sections across the board is divided into
  sectionCols: number
  // Given where the box can be clicked to watch this player's board: it is then drawn as a button, and a little larger
  onSpectate?: () => void
  // Cut down to a chip: a thumbnail of the board with the name and the figure beside it. For a phone, where the
  // other players share a strip above the board
  chip?: boolean
}

// Another player's board, seen from a distance: one square per section of it, greener the more of that section is done
export default function OpponentBox({ player, progress, sectionCols, onSpectate, chip }: OpponentBoxProps) {
  const { theme } = useTheme()
  const { mode } = useLayout()
  // two of the boxes that can be clicked fit side by side on a phone at the usual size
  const width = chip ? CHIP_WIDTH : onSpectate && mode !== "phone" ? BOX_WIDTH * 1.25 : BOX_WIDTH
  const pixel = Math.max(chip ? 2 : 4, Math.min(onSpectate ? 16 : 12, Math.floor(width / sectionCols)))

  const map = (
    <div
      className={`shrink-0 grid gap-px border ${chip ? "p-0.5" : "p-1"} ${theme.menuBg} ${theme.menuBorder}`}
      style={{ gridTemplateColumns: `repeat(${sectionCols}, ${pixel}px)`, gridAutoRows: `${pixel}px` }}
    >
      {progress.sections.map((level, section) => (
        <div key={section} className={theme.cellHidden}>
          <div className="w-full h-full bg-green-500" style={{ opacity: level / SECTION_LEVELS }} />
        </div>
      ))}
    </div>
  )

  if (chip) {
    return (
      <div className={`shrink-0 flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-default ${theme.menuBg} ${theme.menuBorder} ${theme.textBody}`}>
        {map}
        <div className="min-w-0">
          <div className="max-w-24 text-xs font-semibold leading-tight truncate">@{player.username}</div>
          <div className="text-[11px] leading-tight opacity-70 tabular-nums whitespace-nowrap">
            {progress.outcome === "playing" ? `${progress.percent}%` : describeResult(progress)}
          </div>
        </div>
      </div>
    )
  }

  const box: ReactNode = (
    <>
      <span className="max-w-36 text-sm font-semibold truncate">@{player.username}</span>
      {map}
      <span className="text-xs opacity-70 tabular-nums">
        {progress.outcome === "cleared" ? `Finished in ${describeResult(progress)}`
          : progress.outcome === "playing" ? `${progress.percent}%`
          : describeResult(progress)}
        {progress.mineHits > 0 && ` · ${plural(progress.mineHits, "mine")} hit`}
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

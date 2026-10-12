import { useTheme } from "../../context/ThemeContext"
import type { Tally } from "../../../shared/training/queue"

// How far through a kind of training a player is: how many of its patterns they know, out of how many, as a bar.
// The lighter stretch of it is the ones they have met and are still learning
export default function TrainingProgress({ tally, compact }: { tally: Tally, compact?: boolean }) {
  const { theme } = useTheme()
  const share = (count: number) => `${count / tally.total * 100}%`
  const note = tally.due > 0 ? `${tally.due} due` : tally.learning > 0 ? `${tally.learning} in hand` : tally.learned === tally.total ? "all learned" : ""
  return (
    <div className={`flex flex-col gap-1 cursor-default ${theme.textBody}`}>
      <div className={`flex items-baseline justify-between gap-3 ${compact ? "text-xs" : "text-sm"}`}>
        <span className="font-semibold">{tally.learned} of {tally.total} learned</span>
        <span className={tally.due > 0 ? "font-semibold text-green-500" : "opacity-70"}>{note}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={tally.total}
        aria-valuenow={tally.learned}
        aria-label="Patterns learned"
        className={`flex rounded-full overflow-hidden ${compact ? "h-1.5" : "h-2"} ${theme.cellHidden}`}
      >
        <div className="h-full bg-green-500" style={{ width: share(tally.learned) }} />
        <div className="h-full bg-green-500/40" style={{ width: share(tally.learning) }} />
      </div>
    </div>
  )
}

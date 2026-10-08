import { useTheme } from "../../context/ThemeContext"
import { levelFromXp, xpForLevel } from "../../../shared/progression"

// A player's level, and how far they are towards the next one
export default function LevelBar({ xp, compact }: { xp: number, compact?: boolean }) {
  const { theme } = useTheme()
  const level = levelFromXp(xp)
  const from = xpForLevel(level)
  const to = xpForLevel(level + 1)

  return (
    <div className={`flex flex-col gap-1 cursor-default ${theme.textBody}`} title={`${xp} experience in all`}>
      <div className={`flex items-baseline justify-between ${compact ? "text-xs" : "text-sm"}`}>
        <span className="font-semibold">Level {level}</span>
        <span className="opacity-70 tabular-nums">{xp - from} / {to - from} XP</span>
      </div>
      <div className={`rounded-full overflow-hidden ${compact ? "h-1.5" : "h-2"} ${theme.cellHidden}`}>
        <div className="h-full bg-green-500" style={{ width: `${(xp - from) / (to - from) * 100}%` }} />
      </div>
    </div>
  )
}

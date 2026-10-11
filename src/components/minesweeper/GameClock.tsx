import { useGameClock } from "../../hooks/useGameClock"
import { formatDuration } from "../../lib/time"

// How long a game has been going, or how long it lasted once it is over
export default function GameClock({ startedAt, durationMs }: { startedAt: number | null, durationMs: number | null }) {
  const seconds = useGameClock(startedAt === null ? null : { startedAt, durationMs })
  return <span className="tabular-nums">{formatDuration(seconds * 1000)}</span>
}

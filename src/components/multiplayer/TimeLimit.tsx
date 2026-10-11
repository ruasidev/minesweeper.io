import { useTimeLeft } from "../../hooks/useTimeLeft"
import { formatTimeLeft } from "../../lib/time"

// The clock on the players still going, which starts once enough of the others have finished: how it looks, to
// whoever is shown it (a player who is on it, or somebody watching one who is).
//
// Wherever it is shown to a player, it takes up no room that wasn't already set aside for it: it starts in the
// middle of a game, and a board that moved under the pointer just then would be a click on the wrong cell.

// when it turns red: the last of the time
const LAST_MS = 10_000

// On a big screen: a pill that floats over the head of the game, and stays in view however far down the board
// the player has scrolled. `spare` is the same pill with nothing in it to see: what keeps its room for it
export function TimeLimitPill({ deadlineAt, spare }: { deadlineAt: number, spare?: boolean }) {
  const left = useTimeLeft(deadlineAt)
  return (
    <div
      role={spare ? undefined : "timer"}
      aria-hidden={spare}
      className={`flex items-center gap-3 px-4 py-1.5 rounded-xl font-semibold whitespace-nowrap cursor-default text-white
        ${spare ? "invisible" : `shadow-lg shadow-black/40 ${left <= LAST_MS ? "bg-red-600 animate-pulse" : "bg-amber-600"}`}`}
    >
      <span className="text-2xl font-extrabold tabular-nums">{spare ? "00:00" : formatTimeLeft(left)}</span>
      <span>left to finish</span>
    </div>
  )
}

// As a figure among other figures: counting down where a clock was, or beside one
export function TimeLeftFigure({ deadlineAt, className = "" }: { deadlineAt: number, className?: string }) {
  const left = useTimeLeft(deadlineAt)
  return <span role="timer" className={`tabular-nums ${className} ${left <= LAST_MS ? "text-red-500! animate-pulse" : "text-amber-500!"}`}>{formatTimeLeft(left)}</span>
}

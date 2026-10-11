import { useEffect, useState } from "react"

// how often a running clock is looked at: often enough that a second never shows late
const TICK_MS = 250

// What a game's clock needs: when it started (by this browser's clock), and how long the game lasted once it is over
export type Timed = { startedAt: number, durationMs: number | null }

// How long a game has been going, in whole seconds, kept up to date while it is being played. Nought before play
// begins, and for no game at all; once the game is over, how long it lasted
export function useGameClock(game: Timed | null): number {
  const startedAt = game?.startedAt ?? null
  const durationMs = game?.durationMs ?? null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (startedAt === null || durationMs !== null) return
    const tick = () => setNow(Date.now())
    tick()
    const timer = setInterval(tick, TICK_MS)
    return () => clearInterval(timer)
  }, [startedAt, durationMs])

  if (startedAt === null) return 0
  return Math.floor(Math.max(0, durationMs ?? now - startedAt) / 1000)
}

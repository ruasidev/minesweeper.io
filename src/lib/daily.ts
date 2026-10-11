import type { DailyInfo } from "./api"

// Where a player who has cleared the day's board stands on it
export type DailyStanding = {
  durationMs: number
  mineHits: number
  // Their place among everyone who has cleared it. None for a time that was kept off the board
  place: number | null
  // how many have cleared it, this player among them if they are on the board
  cleared: number
  // How they compare with the quickest: how far behind it they are or, being the quickest, how far ahead of the
  // next. None while they are the only one, or off the board
  gap: { label: string, ms: number } | null
}

// How the signed-in player's go at the day's board stands, once they have cleared it
export function dailyStanding({ entries, cleared, mine }: Pick<DailyInfo, "entries" | "cleared" | "mine">, userId: string): DailyStanding | null {
  if (!mine || mine.durationMs === null) return null
  const { durationMs, place } = mine
  // the quickest of everyone else: the list is in order, quickest first
  const rival = entries.find(entry => entry.userId !== userId)
  const gap = place === null || !rival ? null
    : place === 1 ? { label: "Ahead of 2nd", ms: Math.max(0, rival.durationMs - durationMs) }
    : { label: "Behind 1st", ms: Math.max(0, durationMs - rival.durationMs) }
  return { durationMs, mineHits: mine.mineHits ?? 0, place, cleared, gap }
}

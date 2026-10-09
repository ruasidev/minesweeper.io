import type { PlayerOutcome, PlayerProgress } from "../../shared/protocol"
import { formatScore } from "./time"

// What each way of not clearing the board is called
const STOPPED: Record<Exclude<PlayerOutcome, "playing" | "cleared">, string> = {
  gaveUp: "Gave up",
  timedOut: "Did not finish",
  left: "Left",
}

// How one player's game stands, in a few words: their time, or how far they have got (and why they stopped)
export function describeResult(progress: PlayerProgress): string {
  if (progress.outcome === "cleared") return formatScore(progress.finishedMs ?? 0)
  if (progress.outcome === "playing") return `Playing · ${progress.percent}%`
  return `${STOPPED[progress.outcome]} · ${progress.percent}%`
}

// 1 → "1st", 2 → "2nd", 11 → "11th"
export function ordinal(place: number): string {
  const lastTwo = place % 100
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : ["th", "st", "nd", "rd"][place % 10] ?? "th"
  return `${place}${suffix}`
}

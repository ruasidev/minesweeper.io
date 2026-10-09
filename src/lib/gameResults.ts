import { BOARD_PRESETS, type PlayerOutcome, type PlayerProgress } from "../../shared/protocol"
import { formatScore } from "./time"

// What each way of not clearing the board is called
const STOPPED: Record<Exclude<PlayerOutcome, "playing" | "cleared">, string> = {
  gaveUp: "Gave up",
  timedOut: "Did not finish",
  left: "Left",
  lost: "Hit a mine",
}

// How one player's game stands, in a few words: their time, or how far they have got (and why they stopped)
export function describeResult(progress: PlayerProgress): string {
  if (progress.outcome === "cleared") return formatScore(progress.finishedMs ?? 0)
  if (progress.outcome === "playing") return `Playing · ${progress.percent}%`
  return `${STOPPED[progress.outcome]} · ${progress.percent}%`
}

// How a recorded game ended, in a few words, for a match history
export function describeOutcome(outcome: string, durationMs: number): string {
  const time = formatScore(durationMs)
  switch (outcome) {
    case "cleared": return `Cleared in ${time}`
    case "lost": return `Hit a mine at ${time}`
    case "abandoned": return `Abandoned at ${time}`
    case "gaveUp": return `Gave up at ${time}`
    case "timedOut": return `Did not finish`
    case "left": return `Left at ${time}`
    default: return time
  }
}

// What a board is called: the classic one it matches, or its size
export function describeBoard({ rows, cols, mines }: { rows: number, cols: number, mines: number }): string {
  const preset = BOARD_PRESETS.find(({ settings }) => settings.rows === rows && settings.cols === cols && settings.mines === mines)
  return preset ? preset.label : `${rows} × ${cols} · ${mines} ${mines === 1 ? "mine" : "mines"}`
}

// 1 → "1st", 2 → "2nd", 11 → "11th"
export function ordinal(place: number): string {
  const lastTwo = place % 100
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : ["th", "st", "nd", "rd"][place % 10] ?? "th"
  return `${place}${suffix}`
}

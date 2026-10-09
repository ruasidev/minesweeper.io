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

// gold, silver and bronze, for the first three places of anything that is ranked
export const MEDALS = ["bg-[#e9b949] text-[#3b2a05]", "bg-[#c4c8cf] text-[#2a2d33]", "bg-[#c98a5a] text-[#33190a]"]

// What a game in a match history came to: the few words for it, whether that is a good end or a bad one, and what
// goes under those words in smaller ones
export type Verdict = { word: string, tone: "good" | "bad" | "plain", detail: string }

type PlayedGame = {
  kind: "singleplayer" | "multiplayer" | "daily"
  outcome: string
  durationMs: number
  mineHits: number
  place: number | null
  players: number | null
}

export function verdictOf(game: PlayedGame): Verdict {
  const time = formatScore(game.durationMs)
  const hits = game.mineHits > 0 ? ` · ${game.mineHits} ${game.mineHits === 1 ? "mine" : "mines"} hit` : ""
  const cleared = game.outcome === "cleared"

  // singleplayer is won or lost; a game thrown away is neither
  if (game.kind === "singleplayer") {
    if (cleared) return { word: "Won", tone: "good", detail: `Cleared in ${time}` }
    if (game.outcome === "lost") return { word: "Lost", tone: "bad", detail: `Hit a mine at ${time}` }
    return { word: "Abandoned", tone: "plain", detail: `Left at ${time}` }
  }
  if (game.kind === "daily") {
    return cleared
      ? { word: "Cleared", tone: "good", detail: `In ${time}${hits}` }
      : { word: "Not finished", tone: "plain", detail: `Stopped at ${time}${hits}` }
  }
  // multiplayer is where they came, where there was anyone to come ahead of or behind
  const placed = game.place !== null && game.players !== null && game.players > 1
  const position = placed ? `${ordinal(game.place!)} of ${game.players}` : null
  if (cleared) return { word: position ?? "Cleared", tone: "good", detail: `Cleared in ${time}${hits}` }
  const stopped = STOPPED[game.outcome as keyof typeof STOPPED] ?? "Did not finish"
  return { word: position ? `${stopped} · ${position}` : stopped, tone: "bad", detail: `Stopped at ${time}${hits}` }
}

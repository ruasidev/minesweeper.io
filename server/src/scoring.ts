import { boardDifficulty } from "../../shared/progression.js"
import type { BoardSettings } from "../../shared/protocol.js"

// The rules for what a game is worth: experience, ratings, and whether a result can be believed.
// Nothing here touches the database: these only work things out. (Keeping what they work out is progression.ts
// and records.ts.)

// --- How much experience things are worth -------------------------------------------------------------------

// Winning a singleplayer game: a little, and nothing at all for a board too easy to count.
// (About 2 for Beginner, 12 for Intermediate, 40 for Expert.)
export const singleplayerXp = (settings: BoardSettings): number => Math.floor(boardDifficulty(settings) * 2)

// Clearing the daily challenge: a lot, to make it worth coming back for
export const DAILY_XP = 150

// How one player came out of a multiplayer game
export type MultiplayerOutcome = {
  // null if they didn't clear the board
  finishedMs: number | null
  // how much of what the opening click left covered they uncovered, 0 to 1
  share: number
  mineHits: number
  // 1 for whoever did best, counting everyone who took part
  place: number
  playerCount: number
}

// A multiplayer game: far more than singleplayer for the same board, because the server ran it.
// Clearing the board earns the full amount (about 37 for Intermediate, 120 for Expert), half as much again for
// coming first against someone, and less for every mine hit. Not clearing it earns a share for the part uncovered
export function multiplayerXp(settings: BoardSettings, outcome: MultiplayerOutcome): number {
  const base = boardDifficulty(settings) * 6
  if (outcome.finishedMs === null) return Math.round(base * 0.3 * outcome.share)

  const winner = outcome.place === 1 && outcome.playerCount > 1 ? 1.5 : 1
  const careful = Math.max(0.5, 1 - 0.05 * outcome.mineHits)
  return Math.round(base * winner * careful)
}

// --- Ratings ------------------------------------------------------------------------------------------------

// How far a rating can move in one game
const ELO_K = 32

// A primitive Elo for games of any number of players: a game counts as a match against each of the others
// (won, lost, or drawn if both placed the same), and the changes those matches would bring are averaged.
// `ratings` is what each player's rating was going in, and `places` their place in the game, 1 being best.
// `weight` says how much the match between two of them counts, from 1 (fully) down to 0 (not at all).
// Gives how far each player's rating moves. Anyone without a rating is left out, of the answer and of the sums
export function eloChanges(ratings: Map<string, number>, places: Map<string, number>, weight: (a: string, b: string) => number = () => 1): Map<string, number> {
  const changes = new Map<string, number>()
  if (places.size < 2) return changes
  const ids = [...places.keys()]

  for (const id of ids) {
    const mine = ratings.get(id)
    if (mine === undefined) continue
    let change = 0
    for (const other of ids) {
      const theirs = ratings.get(other)
      if (other === id || theirs === undefined) continue
      const expected = 1 / (1 + 10 ** ((theirs - mine) / 400))
      const actual = places.get(id)! < places.get(other)! ? 1 : places.get(id)! > places.get(other)! ? 0 : 0.5
      change += weight(id, other) * (actual - expected)
    }
    changes.set(id, Math.round(ELO_K * change / (ids.length - 1)))
  }
  return changes
}

// --- Whether a result can be believed -------------------------------------------------------------------------

// How fast a person can get through a board, in the clicks it needs per second (players call this "3BV/s").
// The very fastest in the world reach about ten on small boards. Nobody keeps up more than this
const CLICKS_PER_SECOND_MAX = 12
// a board that needs this few clicks is over too quickly for its speed to mean anything
const CLICKS_MIN_TO_JUDGE = 8
// this many moves thrown away in one game for coming too fast is not a person clicking
const DROPPED_MOVES_MAX = 20

// Why a cleared board doesn't look as if a person cleared it, or null if it does.
// A result this is true of is still kept, but stays off the leaderboards until an admin has looked at it
export function suspicion(game: { bv: number }, result: { durationMs: number, dropped: number }): string | null {
  if (result.dropped > DROPPED_MOVES_MAX) return `${result.dropped} moves came faster than a person can click`
  const perSecond = game.bv / Math.max(result.durationMs, 1) * 1000
  if (game.bv >= CLICKS_MIN_TO_JUDGE && perSecond > CLICKS_PER_SECOND_MAX) {
    return `Cleared at ${perSecond.toFixed(1)} needed clicks a second: faster than anyone plays`
  }
  return null
}

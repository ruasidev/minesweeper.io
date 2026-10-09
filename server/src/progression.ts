import { eq, inArray, sql } from "drizzle-orm"
import { boardDifficulty } from "../../shared/progression.js"
import type { BoardSettings } from "../../shared/protocol.js"
import { db } from "./db/index.js"
import { profile } from "./db/schema.js"

// --- How much experience things are worth -------------------------------------------------------------------

// Winning a singleplayer game: a little, and nothing at all for a board too easy to count.
// (About 2 for Beginner, 12 for Intermediate, 40 for Expert.)
export const singleplayerXp = (settings: BoardSettings): number => Math.floor(boardDifficulty(settings) * 2)

// Clearing the daily challenge: a lot, to make it worth coming back for
export const DAILY_XP = 150

// One play can't add more than this to the time someone has spent in games, however long its clock ran
const PLAY_SECONDS_MAX = 60 * 60

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

// --- Keeping score ------------------------------------------------------------------------------------------

// Adds to what a player has done. Their profile must exist already
export async function addProgress(userId: string, { xp = 0, playSeconds = 0, gamesStarted = 0 }: { xp?: number, playSeconds?: number, gamesStarted?: number }) {
  const seconds = Math.round(Math.min(PLAY_SECONDS_MAX, Math.max(0, playSeconds)))
  await db.update(profile).set({
    xp: sql`${profile.xp} + ${Math.max(0, Math.round(xp))}`,
    playSeconds: sql`${profile.playSeconds} + ${seconds}`,
    gamesStarted: sql`${profile.gamesStarted} + ${gamesStarted}`,
  }).where(eq(profile.userId, userId))
}

// How far a rating can move in one game
const ELO_K = 32

// A primitive Elo for games of any number of players: a game counts as a match against each of the others
// (won, lost, or drawn if both placed the same), and the changes those matches would bring are averaged.
// `places` gives each player's place in the game, 1 being best. Resolves to how far each player's rating moved
export async function updateElo(places: Map<string, number>): Promise<Map<string, number>> {
  const changes = new Map<string, number>()
  if (places.size < 2) return changes
  const ids = [...places.keys()]
  const ratings = new Map((await db.select({ userId: profile.userId, elo: profile.elo }).from(profile).where(inArray(profile.userId, ids)))
    .map(row => [row.userId, row.elo]))

  for (const id of ids) {
    const mine = ratings.get(id)
    if (mine === undefined) continue
    let change = 0
    for (const other of ids) {
      const theirs = ratings.get(other)
      if (other === id || theirs === undefined) continue
      const expected = 1 / (1 + 10 ** ((theirs - mine) / 400))
      const actual = places.get(id)! < places.get(other)! ? 1 : places.get(id)! > places.get(other)! ? 0 : 0.5
      change += actual - expected
    }
    const rounded = Math.round(ELO_K * change / (ids.length - 1))
    changes.set(id, rounded)
    if (rounded !== 0) await db.update(profile).set({ elo: sql`${profile.elo} + ${rounded}` }).where(eq(profile.userId, id))
  }
  return changes
}

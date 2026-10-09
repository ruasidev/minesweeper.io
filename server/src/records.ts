import { and, eq, gt, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "./db/index.js"
import { gameRecord } from "./db/schema.js"
import { layoutOf, recordOf, type Game } from "./multiplayer/game.js"

// The kinds of game the server runs
export type GameKind = "singleplayer" | "multiplayer" | "daily"

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

type RecordDetails = {
  // how the game ended for the player, where that isn't what the game itself says (a singleplayer game thrown away)
  outcome?: string
  suspectReason?: string | null
}

// Keeps one player's game, move by move, with the board it was played on
export async function saveRecord(kind: GameKind, game: Game, playerId: string, now: number, { outcome, suspectReason = null }: RecordDetails = {}) {
  const result = recordOf(game, playerId, now)
  if (!result) return
  await db.insert(gameRecord).values({
    userId: playerId,
    kind,
    match: game.key,
    rated: game.rated,
    ...game.settings,
    layout: layoutOf(game),
    openRow: game.start.row,
    openCol: game.start.col,
    outcome: outcome ?? result.outcome,
    durationMs: Math.round(result.durationMs),
    mineHits: result.mineHits,
    bv: game.bv,
    moves: result.moves,
    suspect: suspectReason !== null,
    suspectReason,
    createdAt: new Date(now),
  })
}

// How many rated games two players have played against each other in the last day
export async function ratedGamesBetween(a: string, b: string): Promise<number> {
  const theirs = alias(gameRecord, "theirs")
  const [{ games }] = await db.select({ games: sql<number>`count(distinct ${gameRecord.match})`.mapWith(Number) })
    .from(gameRecord)
    .innerJoin(theirs, eq(theirs.match, gameRecord.match))
    .where(and(
      eq(gameRecord.userId, a), eq(theirs.userId, b), eq(gameRecord.rated, true),
      gt(gameRecord.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
    ))
  return games
}

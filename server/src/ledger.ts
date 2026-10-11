import { and, eq, gt, inArray, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { colOf, rowOf } from "../../shared/engine/field.js"
import { layoutOf, recordOf, type Game } from "../../shared/game/game.js"
import { GAME_MODES, type SingleplayerModeId } from "../../shared/game/modes.js"
import type { BoardSettings } from "../../shared/protocol.js"
import { db } from "./db/index.js"
import { dailyAttempt, gameRecord, gameResult, multiplayerResult, profile, user } from "./db/schema.js"
import { env } from "./env.js"
import { eloChanges } from "./scoring.js"

// Everything the running of games keeps: results, records, experience, ratings. The games themselves only ever
// ask for these to be kept, through this one interface, and never touch the database. That keeps what a game is
// worth (scoring.ts, modes/) apart from where it is written down, and lets the lobby be tested with a ledger that
// writes nothing down at all.

// what a player has done, to be added to their profile
export type Progress = { xp?: number, playSeconds?: number, gamesStarted?: number }

// Why a result is kept off the leaderboards (too fast to have been a person), or null where it isn't
type HiddenReason = string | null

export type RecordDetails = {
  // how the game ended for the player, where that isn't what the game itself says: "abandoned", for one put away unfinished
  outcome?: string
  suspectReason?: HiddenReason
  // a game played against others: where the player came, out of how many, and how far it moved their rating
  place?: number
  players?: number
  ratingChange?: number | null
}

export type DailyAttempt = {
  // when the player's clock for the day started, or starts
  startedAt: number
  // whether this was the start that set it going
  first: boolean
  // they have cleared the day's board already
  cleared: boolean
}

export type Ledger = {
  // Adds to what a player has done. Their profile must exist already
  addProgress(userId: string, progress: Progress): Promise<void>
  // Keeps one player's game, move by move, with the board it was played on
  saveRecord(game: Game, playerId: string, now: number, details?: RecordDetails): Promise<void>

  // A singleplayer game that ended, won or lost, for the player's stats and the singleplayer leaderboards
  saveSingleplayerResult(result: { userId: string, mode: SingleplayerModeId, settings: BoardSettings, won: boolean, durationMs: number, hiddenReason: HiddenReason }): Promise<void>
  // A board cleared in a multiplayer game, for the multiplayer leaderboards
  saveMultiplayerResult(result: { userId: string, settings: BoardSettings, durationMs: number, mineHits: number, hiddenReason: HiddenReason }): Promise<void>

  // Starts a player's go at a day's challenge, or finds the one they started: the first start sets their clock
  // (to begin at `startsAt`), and later ones leave it alone
  openDailyAttempt(userId: string, date: string, startsAt: number): Promise<DailyAttempt>
  saveDailyResult(result: { userId: string, date: string, durationMs: number, mineHits: number, hiddenReason: HiddenReason }): Promise<void>

  // Which of these accounts' games may move ratings
  ratedAccounts(userIds: string[]): Promise<Set<string>>
  // How many rated games two players have played against each other since a moment
  ratedGamesBetween(a: string, b: string, since: number): Promise<number>
  // Moves the ratings of everyone who played a game. `places` gives each player's place in it, 1 being best, and
  // `weight` how much the match between two of them counts (see eloChanges). Resolves to how far each rating moved
  moveRatings(places: Map<string, number>, weight: (a: string, b: string) => number): Promise<Map<string, number>>
}

// One play can't add more than this to the time someone has spent in games, however long its clock ran
const PLAY_SECONDS_MAX = 60 * 60

// The ledger that is the database
export const databaseLedger: Ledger = {
  async addProgress(userId, { xp = 0, playSeconds = 0, gamesStarted = 0 }) {
    const seconds = Math.round(Math.min(PLAY_SECONDS_MAX, Math.max(0, playSeconds)))
    await db.update(profile).set({
      xp: sql`${profile.xp} + ${Math.max(0, Math.round(xp))}`,
      playSeconds: sql`${profile.playSeconds} + ${seconds}`,
      gamesStarted: sql`${profile.gamesStarted} + ${gamesStarted}`,
    }).where(eq(profile.userId, userId))
  },

  async saveRecord(game, playerId, now, { outcome, suspectReason = null, place, players, ratingChange } = {}) {
    const result = recordOf(game, playerId, now)
    if (!result) return
    await db.insert(gameRecord).values({
      userId: playerId,
      kind: GAME_MODES[game.mode].family,
      mode: game.mode,
      match: game.key,
      rated: game.rated,
      ...game.settings,
      layout: layoutOf(game),
      openRow: rowOf(game.settings.cols, game.opening),
      openCol: colOf(game.settings.cols, game.opening),
      outcome: outcome ?? result.outcome,
      durationMs: Math.round(result.durationMs),
      mineHits: result.mineHits,
      place,
      players,
      ratingChange,
      bv: game.bv,
      moves: result.moves,
      suspect: suspectReason !== null,
      suspectReason,
      createdAt: new Date(now),
    })
  },

  async saveSingleplayerResult({ userId, mode, settings, won, durationMs, hiddenReason }) {
    await db.insert(gameResult).values({
      userId, mode, ...settings, won,
      durationSeconds: Math.round(durationMs / 1000), durationMs: Math.round(durationMs),
      // the server ran the game itself
      verified: true,
      hidden: hiddenReason !== null, hiddenReason,
    })
  },

  async saveMultiplayerResult({ userId, settings, durationMs, mineHits, hiddenReason }) {
    await db.insert(multiplayerResult).values({ userId, ...settings, durationMs: Math.round(durationMs), mineHits, hidden: hiddenReason !== null, hiddenReason })
  },

  async openDailyAttempt(userId, date, startsAt) {
    const started = await db.insert(dailyAttempt)
      .values({ userId, date, startedAt: new Date(startsAt) })
      .onConflictDoNothing()
      .returning({ date: dailyAttempt.date })
    const [attempt] = await db.select().from(dailyAttempt).where(and(eq(dailyAttempt.userId, userId), eq(dailyAttempt.date, date)))
    return { startedAt: attempt.startedAt.getTime(), first: started.length > 0, cleared: attempt.durationMs !== null }
  },

  async saveDailyResult({ userId, date, durationMs, mineHits, hiddenReason }) {
    await db.update(dailyAttempt).set({ durationMs: Math.round(durationMs), mineHits, hidden: hiddenReason !== null, hiddenReason })
      .where(and(eq(dailyAttempt.userId, userId), eq(dailyAttempt.date, date)))
  },

  // Once the site can send the email to confirm an address, only accounts that have confirmed theirs are rated
  async ratedAccounts(userIds) {
    if (!env.emailEnabled || userIds.length === 0) return new Set(userIds)
    const confirmed = await db.select({ id: user.id }).from(user).where(and(inArray(user.id, userIds), eq(user.emailVerified, true)))
    return new Set(confirmed.map(row => row.id))
  },

  async ratedGamesBetween(a, b, since) {
    const theirs = alias(gameRecord, "theirs")
    const [{ games }] = await db.select({ games: sql<number>`count(distinct ${gameRecord.match})`.mapWith(Number) })
      .from(gameRecord)
      .innerJoin(theirs, eq(theirs.match, gameRecord.match))
      .where(and(eq(gameRecord.userId, a), eq(theirs.userId, b), eq(gameRecord.rated, true), gt(gameRecord.createdAt, new Date(since))))
    return games
  },

  async moveRatings(places, weight) {
    if (places.size < 2) return new Map()
    const ratings = new Map((await db.select({ userId: profile.userId, elo: profile.elo }).from(profile).where(inArray(profile.userId, [...places.keys()])))
      .map(row => [row.userId, row.elo]))

    const changes = eloChanges(ratings, places, weight)
    for (const [id, change] of changes) {
      if (change !== 0) await db.update(profile).set({ elo: sql`${profile.elo} + ${change}` }).where(eq(profile.userId, id))
    }
    return changes
  },
}

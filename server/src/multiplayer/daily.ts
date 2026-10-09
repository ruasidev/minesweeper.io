import { createHmac } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { DAILY_BOARD_SETTINGS, START_COUNTDOWN_MS } from "../../../shared/protocol.js"
import { db } from "../db/index.js"
import { dailyAttempt } from "../db/schema.js"
import { env } from "../env.js"
import { startGame, type Game } from "./game.js"

// The daily challenge: one board a day, the same for everybody, played alone against the clock.
// A player's clock starts the first time they start the day's board and keeps running whatever they do,
// so leaving and coming back for a second look costs time rather than saving it

// The day a moment belongs to, as YYYY-MM-DD in UTC
export const dailyDate = (now: number): string => new Date(now).toISOString().slice(0, 10)

// A stream of random numbers that is the same every time for the same seed (the "mulberry32" generator)
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The day's randomness comes from the date mixed with the server's secret. From the date alone, anyone who
// read this code could work out tomorrow's board at home
function dailyRandom(date: string): () => number {
  return seededRandom(createHmac("sha256", env.authSecret).update(`daily:${date}`).digest().readUInt32BE(0))
}

// Starts a player's go at the day's board, or picks it back up. Null if they have already cleared it.
// `firstStart` says whether this was the start that set their clock going
export async function openDailyGame(userId: string, now: number): Promise<{ date: string, game: Game, firstStart: boolean } | null> {
  const date = dailyDate(now)
  // the first start of the day sets the clock (after the usual countdown); later ones leave it alone
  const started = await db.insert(dailyAttempt)
    .values({ userId, date, startedAt: new Date(now + START_COUNTDOWN_MS) })
    .onConflictDoNothing()
    .returning({ date: dailyAttempt.date })
  const [attempt] = await db.select().from(dailyAttempt).where(and(eq(dailyAttempt.userId, userId), eq(dailyAttempt.date, date)))
  if (attempt.durationMs !== null) return null

  return {
    date,
    firstStart: started.length > 0,
    game: startGame(DAILY_BOARD_SETTINGS, [userId], now, { random: dailyRandom(date), startedAt: attempt.startedAt.getTime() }),
  }
}

// `hiddenReason` is why the result should be kept off the leaderboard (too fast to have been a person), if it should
export async function saveDailyResult(userId: string, date: string, durationMs: number, mineHits: number, hiddenReason: string | null = null) {
  await db.update(dailyAttempt).set({ durationMs, mineHits, hidden: hiddenReason !== null, hiddenReason })
    .where(and(eq(dailyAttempt.userId, userId), eq(dailyAttempt.date, date)))
}

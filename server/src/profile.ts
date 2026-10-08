import { randomInt } from "node:crypto"
import { and, count, desc, eq, min, ne, sql } from "drizzle-orm"
import { db } from "./db/index.js"
import { gameResult, profile, user } from "./db/schema.js"

// A starting username from the name an account was created with
function usernameFrom(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20)
  return cleaned.length >= 3 ? cleaned : "player"
}

// Every account gets a profile the first time it is needed
export async function getOrCreateProfile(account: { id: string, name: string }) {
  const [existing] = await db.select().from(profile).where(eq(profile.userId, account.id))
  if (existing) return existing

  const base = usernameFrom(account.name)
  for (let attempt = 0; attempt < 10; attempt++) {
    // the name as it is first, then with a random number on the end until one is free
    const username = attempt === 0 ? base : `${base.slice(0, 16)}${randomInt(1000, 10000)}`
    const [created] = await db.insert(profile).values({ userId: account.id, username }).onConflictDoNothing().returning()
    if (created) return created

    // Nothing inserted: the username is taken, or a parallel request already made this account's profile
    const [raced] = await db.select().from(profile).where(eq(profile.userId, account.id))
    if (raced) return raced
  }
  throw new Error("Could not find a free username")
}

export async function isUsernameTaken(username: string, exceptUserId: string): Promise<boolean> {
  const [taken] = await db.select({ userId: profile.userId }).from(profile)
    .where(and(eq(sql`lower(${profile.username})`, username.toLowerCase()), ne(profile.userId, exceptUserId)))
  return taken !== undefined
}

export async function getStats(userId: string) {
  const [totals] = await db.select({
    gamesPlayed: count(),
    wins: sql<number>`count(*) filter (where ${gameResult.won})`.mapWith(Number),
  }).from(gameResult).where(eq(gameResult.userId, userId))

  // Fastest win on each of the boards this player has won most often
  const bestTimes = await db.select({
    rows: gameResult.rows,
    cols: gameResult.cols,
    mines: gameResult.mines,
    seconds: sql<number>`${min(gameResult.durationSeconds)}`.mapWith(Number),
  }).from(gameResult)
    .where(and(eq(gameResult.userId, userId), eq(gameResult.won, true)))
    .groupBy(gameResult.rows, gameResult.cols, gameResult.mines)
    .orderBy(desc(count()))
    .limit(5)

  return { ...totals, bestTimes }
}

export async function getJoinDate(userId: string): Promise<Date> {
  const [row] = await db.select({ createdAt: user.createdAt }).from(user).where(eq(user.id, userId))
  return row.createdAt
}

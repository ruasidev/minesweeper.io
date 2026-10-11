import { and, count, eq, isNotNull, sql } from "drizzle-orm"
import type { BadgeId } from "../../shared/badges.js"
import { BOARD_PRESETS } from "../../shared/game/boards.js"
import { db } from "./db/index.js"
import { dailyAttempt, gameResult, multiplayerResult } from "./db/schema.js"

// Accounts made before this moment are early supporters. Move it to the day the game leaves beta
const EARLY_SUPPORTER_UNTIL = new Date("2027-01-01T00:00:00Z")

const LIGHTNING_UNDER_MS = 60_000
const DAILY_DEVOTEE_CLEARS = 7
const VETERAN_GAMES = 100
const BOMB_MAGNET_MINES = 25

// a multiplayer result having been played on one of the classic boards
const playedOn = (presetId: string) => {
  const { rows, cols, mines } = BOARD_PRESETS.find(preset => preset.id === presetId)!.settings
  return sql`(${multiplayerResult.rows} = ${rows} and ${multiplayerResult.cols} = ${cols} and ${multiplayerResult.mines} = ${mines})`
}

// The badges an account has earned, worked out afresh from what it has done. Nothing is stored:
// a badge appears the moment its condition is met
export async function badgesOf(account: { id: string, createdAt: Date, role?: string | null }): Promise<BadgeId[]> {
  const [multiplayer] = await db.select({
    expert: sql<boolean>`coalesce(bool_or(${playedOn("expert")}), false)`,
    flawless: sql<boolean>`coalesce(bool_or(${multiplayerResult.mineHits} = 0 and (${playedOn("intermediate")} or ${playedOn("expert")})), false)`,
    lightning: sql<boolean>`coalesce(bool_or(${playedOn("intermediate")} and ${multiplayerResult.durationMs} < ${LIGHTNING_UNDER_MS}), false)`,
    minesHit: sql<number>`coalesce(sum(${multiplayerResult.mineHits}), 0)`.mapWith(Number),
  }).from(multiplayerResult).where(eq(multiplayerResult.userId, account.id))

  const [daily] = await db.select({ clears: count() }).from(dailyAttempt)
    .where(and(eq(dailyAttempt.userId, account.id), isNotNull(dailyAttempt.durationMs)))
  const [singleplayer] = await db.select({ games: count() }).from(gameResult).where(eq(gameResult.userId, account.id))

  const earned: Record<BadgeId, boolean> = {
    "admin": account.role?.split(",").includes("admin") ?? false,
    "early-supporter": account.createdAt < EARLY_SUPPORTER_UNTIL,
    "expert": multiplayer.expert,
    "flawless": multiplayer.flawless,
    "lightning": multiplayer.lightning,
    "daily-devotee": daily.clears >= DAILY_DEVOTEE_CLEARS,
    "veteran": singleplayer.games >= VETERAN_GAMES,
    "bomb-magnet": multiplayer.minesHit >= BOMB_MAGNET_MINES,
  }
  return (Object.keys(earned) as BadgeId[]).filter(id => earned[id])
}

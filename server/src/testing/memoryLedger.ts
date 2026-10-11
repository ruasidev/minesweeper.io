import { recordOf, type Game } from "../../../shared/game/game.js"
import type { Ledger, Progress, RecordDetails } from "../ledger.js"
import { eloChanges } from "../scoring.js"

// For tests: a ledger that keeps everything in memory, and lets a test look at what was kept

type KeptRecord = RecordDetails & { mode: string, playerId: string, key: string, gameOutcome: string, durationMs: number, at: number }

export function memoryLedger() {
  const progress: ({ userId: string } & Progress)[] = []
  const records: KeptRecord[] = []
  const singleplayer: Parameters<Ledger["saveSingleplayerResult"]>[0][] = []
  const multiplayer: Parameters<Ledger["saveMultiplayerResult"]>[0][] = []
  const daily: Parameters<Ledger["saveDailyResult"]>[0][] = []
  // by "user date"
  const attempts = new Map<string, { startedAt: number, cleared: boolean }>()
  const ratings = new Map<string, number>()
  // accounts whose games don't count towards ratings
  const unrated = new Set<string>()

  const ledger: Ledger = {
    async addProgress(userId, added) {
      progress.push({ userId, ...added })
    },
    async saveRecord(game: Game, playerId, now, details = {}) {
      const result = recordOf(game, playerId, now)
      if (result) records.push({ ...details, mode: game.mode, playerId, key: game.key, gameOutcome: result.outcome, durationMs: result.durationMs, at: now })
    },
    async saveSingleplayerResult(result) {
      singleplayer.push(result)
    },
    async saveMultiplayerResult(result) {
      multiplayer.push(result)
    },
    async openDailyAttempt(userId, date, startsAt) {
      const key = `${userId} ${date}`
      const existing = attempts.get(key)
      if (existing) return { ...existing, first: false }
      attempts.set(key, { startedAt: startsAt, cleared: false })
      return { startedAt: startsAt, cleared: false, first: true }
    },
    async saveDailyResult(result) {
      daily.push(result)
      const attempt = attempts.get(`${result.userId} ${result.date}`)
      if (attempt) attempt.cleared = true
    },
    async ratedAccounts(userIds) {
      return new Set(userIds.filter(id => !unrated.has(id)))
    },
    async ratedGamesBetween(a, b, since) {
      const recent = records.filter(record => record.place !== undefined && record.at > since)
      const mine = new Set(recent.filter(record => record.playerId === a).map(record => record.key))
      return new Set(recent.filter(record => record.playerId === b && mine.has(record.key)).map(record => record.key)).size
    },
    async moveRatings(places, weight) {
      const before = new Map([...places.keys()].map(id => [id, ratings.get(id) ?? 1000]))
      const changes = eloChanges(before, places, weight)
      for (const [id, change] of changes) ratings.set(id, before.get(id)! + change)
      return changes
    },
  }

  // experience a player has been given in all
  const xpOf = (userId: string): number => progress.filter(entry => entry.userId === userId).reduce((sum, entry) => sum + (entry.xp ?? 0), 0)
  const gamesStartedBy = (userId: string): number =>
    progress.filter(entry => entry.userId === userId).reduce((sum, entry) => sum + (entry.gamesStarted ?? 0), 0)

  return { ledger, progress, records, singleplayer, multiplayer, daily, attempts, ratings, unrated, xpOf, gamesStartedBy }
}

export type MemoryLedger = ReturnType<typeof memoryLedger>

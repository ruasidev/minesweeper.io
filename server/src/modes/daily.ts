import { createHmac, randomUUID } from "node:crypto"
import { SEED_BYTES } from "../../../shared/engine/seed.js"
import { DAILY_BOARD_SETTINGS } from "../../../shared/game/boards.js"
import { recordOf, startGame, type Game } from "../../../shared/game/game.js"
import { START_COUNTDOWN_MS } from "../../../shared/game/modes.js"
import { inBackground } from "../background.js"
import { DAILY_XP, suspicion } from "../scoring.js"
import type { ModeServices, SoloMode } from "./types.js"

// The daily challenge: one board a day, the same for everybody, played alone against the clock.
// A player's clock starts the first time they start the day's board and keeps running whatever they do,
// so leaving and coming back for a second look costs time rather than saving it

// The day a moment belongs to, as YYYY-MM-DD in UTC
export const dailyDate = (now: number): string => new Date(now).toISOString().slice(0, 10)

// Where each day's seed comes from: the date mixed with a secret only the server has. From the date alone, anyone
// who read this code could work out tomorrow's board at home
export const dailySeedFrom = (secret: string) => (date: string): Uint8Array =>
  new Uint8Array(createHmac("sha256", secret).update(`daily:${date}`).digest().subarray(0, SEED_BYTES))

export function dailyMode({ ledger, dailySeed }: ModeServices): SoloMode {
  // which day each game being played belongs to: the day it was started on, whatever the time is by the end of it
  const dateOf = new WeakMap<Game, string>()

  return {
    id: "daily",

    async open(player, _request, now) {
      const date = dailyDate(now)
      // the first start of the day sets the clock (after the usual countdown); later ones leave it alone
      const attempt = await ledger.openDailyAttempt(player.id, date, now + START_COUNTDOWN_MS)
      if (attempt.cleared) return "You have already finished today's challenge"
      if (attempt.first) inBackground(ledger.addProgress(player.id, { gamesStarted: 1 }))

      // The same board as everyone else's, started afresh: what they had uncovered before putting it down is gone,
      // and the clock has been running all the while
      const game = startGame("daily", DAILY_BOARD_SETTINGS, [player.id], now, { seed: dailySeed(date), key: randomUUID(), startedAt: attempt.startedAt })
      dateOf.set(game, date)
      return game
    },

    async finished(game, playerId, now) {
      const result = recordOf(game, playerId, now)
      const date = dateOf.get(game)
      if (!result || !date || result.outcome !== "cleared") return
      // a board cleared faster than a person could have is kept, but off the leaderboard, and earns nothing
      const reason = suspicion(game, result)
      await ledger.saveDailyResult({ userId: playerId, date, durationMs: result.durationMs, mineHits: result.mineHits, hiddenReason: reason })
      await ledger.addProgress(playerId, { xp: reason ? 0 : DAILY_XP, playSeconds: result.durationMs / 1000 })
      await ledger.saveRecord(game, playerId, now, { suspectReason: reason })
    },

    // putting the challenge down is not the end of it: the clock runs on, and it can be picked back up
    async abandoned() {},
  }
}

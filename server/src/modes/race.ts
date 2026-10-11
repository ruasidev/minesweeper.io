import { randomUUID } from "node:crypto"
import { recordOf, standings, startGame } from "../../../shared/game/game.js"
import { inBackground } from "../background.js"
import { multiplayerXp, suspicion } from "../scoring.js"
import type { ModeServices, RoomMode } from "./types.js"

// How much a rated game between two players counts when they have already played each other that many times
// in the last day: fully, then less each time, then not at all. It takes the point out of two accounts playing
// each other over and over to move a rating
const REPEAT_WEIGHTS = [1, 0.5, 0.25]
const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000

const pairKey = (a: string, b: string): string => (a < b ? `${a} ${b}` : `${b} ${a}`)

// A race: everyone in the room on the same board at once, and the first to clear it wins
export function raceMode({ ledger, freshSeed }: ModeServices): RoomMode {
  // how much the match between each two players of a game counts towards their ratings, by pairKey
  async function matchWeights(playerIds: string[], now: number): Promise<Map<string, number>> {
    const rated = await ledger.ratedAccounts(playerIds)
    const weights = new Map<string, number>()
    for (const a of playerIds) {
      for (const b of playerIds) {
        if (a >= b) continue
        // a match with an account that isn't rated moves nobody's rating
        const counts = rated.has(a) && rated.has(b)
        weights.set(pairKey(a, b), counts ? REPEAT_WEIGHTS[await ledger.ratedGamesBetween(a, b, now - REPEAT_WINDOW_MS)] ?? 0 : 0)
      }
    }
    return weights
  }

  return {
    id: "race",

    start(settings, players, now, { visibility }) {
      for (const player of players) inBackground(ledger.addProgress(player.id, { gamesStarted: 1 }))
      // Only games in public rooms count towards ratings: a private room is for playing friends, and would be
      // the easy place to trade wins
      return startGame("race", settings, players.map(player => player.id), now, { seed: freshSeed(), key: randomUUID(), rated: visibility === "public" })
    },

    // a board cleared is a time for the leaderboards, unless no person could have cleared it that fast
    async cleared(game, playerId, now) {
      const result = recordOf(game, playerId, now)
      if (!result || result.outcome !== "cleared") return
      await ledger.saveMultiplayerResult({
        userId: playerId, settings: game.settings, durationMs: result.durationMs, mineHits: result.mineHits, hiddenReason: suspicion(game, result),
      })
    },

    // Everyone who took part gets their experience and their time played, and ratings move if there was anyone
    // to be measured against
    async finished(game, now) {
      const results = standings(game, now)
      const reasons = new Map(results.map((result) => {
        const record = recordOf(game, result.playerId, now)!
        return [result.playerId, record.outcome === "cleared" ? suspicion(game, record) : null]
      }))

      for (const result of results) {
        await ledger.addProgress(result.playerId, {
          // a board cleared faster than a person could have earns nothing
          xp: reasons.get(result.playerId) ? 0 : multiplayerXp(game.settings, { ...result, playerCount: results.length }),
          playSeconds: result.elapsedMs / 1000,
        })
      }

      if (game.rated && results.length > 1) {
        const weights = await matchWeights(results.map(result => result.playerId), now)
        game.ratingChanges = await ledger.moveRatings(
          new Map(results.map(result => [result.playerId, result.place])),
          (a, b) => weights.get(pairKey(a, b)) ?? 0,
        )
      }

      // kept after the ratings are worked out, so this game isn't counted among the ones already played
      for (const result of results) {
        await ledger.saveRecord(game, result.playerId, now, {
          suspectReason: reasons.get(result.playerId),
          place: result.place,
          players: results.length,
          ratingChange: game.ratingChanges?.get(result.playerId) ?? null,
        })
      }
    },
  }
}

import { randomUUID } from "node:crypto"
import { isOnBoard } from "../../../shared/engine/field.js"
import { boardSettingsFrom } from "../../../shared/engine/generate.js"
import { recordOf, startGame, type Game } from "../../../shared/game/game.js"
import type { SingleplayerModeId } from "../../../shared/game/modes.js"
import { inBackground } from "../background.js"
import { singleplayerXp, suspicion } from "../scoring.js"
import type { ModeServices, SoloMode } from "./types.js"

// Singleplayer: any board the player likes, opened by their own first click, over at the first mine.
// The server holds the mines and times the game, so a win can go on the leaderboards.
//
// There are two of these, alike in everything but how their boards are made (see their rules): one whose boards
// never need a guess, and one whose mines fall wherever chance puts them. What comes of a game is the same for
// both, and each result is kept with which of the two it was
export function singleplayerMode(id: SingleplayerModeId, { ledger, freshSeed }: ModeServices): SoloMode {
  // A game is over, or was thrown away part-way. Either way it is kept, for the player's stats and time played;
  // only one that ended is a result, and only a win earns experience. All of it is the server's own account of the game
  async function settle(game: Game, playerId: string, now: number, abandoned: boolean): Promise<void> {
    const result = recordOf(game, playerId, now)
    if (!result) return
    const won = result.outcome === "cleared"
    // a win no person could have played stays off the leaderboards and earns nothing
    const reason = won ? suspicion(game, result) : null

    if (!abandoned) {
      await ledger.saveSingleplayerResult({ userId: playerId, mode: id, settings: game.settings, won, durationMs: result.durationMs, hiddenReason: reason })
    }
    await ledger.addProgress(playerId, { xp: won && !reason ? singleplayerXp(game.settings) : 0, playSeconds: result.durationMs / 1000 })
    await ledger.saveRecord(game, playerId, now, { outcome: abandoned ? "abandoned" : undefined, suspectReason: reason })
  }

  return {
    id,

    async open(player, request, now) {
      const settings = boardSettingsFrom(request.settings)
      const opening = request.opening
      if (!settings || !opening || !isOnBoard(settings, opening.row, opening.col)) return "That board isn't possible"

      inBackground(ledger.addProgress(player.id, { gamesStarted: 1 }))
      // the mines are laid around the click that asked for the game, and the clock starts with it
      return startGame(id, settings, [player.id], now, { seed: freshSeed(), key: randomUUID(), opening })
    },

    finished: (game, playerId, now) => settle(game, playerId, now, false),
    abandoned: (game, playerId, now) => settle(game, playerId, now, true),
  }
}

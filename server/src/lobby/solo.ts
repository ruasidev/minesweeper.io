import { isPlaying, ownGame } from "../../../shared/game/game.js"
import type { SoloModeId } from "../../../shared/game/modes.js"
import type { PlayerOutcome } from "../../../shared/protocol.js"
import { inBackground } from "../background.js"
import type { Modes, SoloRequest } from "../modes/index.js"
import type { Connection } from "./types.js"

// Games played alone: classic singleplayer, the daily challenge, and whatever else is added to them.
// A player has at most one going, and never while they are in a room

export function createSoloPlay(modes: Modes["solo"], isLive: (connection: Connection) => boolean) {
  // the player's own game as they see it, or word that they no longer have one
  function send(connection: Connection): void {
    const solo = connection.solo
    connection.send({ type: "game", game: solo && ownGame(solo.game, connection.player.id, Date.now()) })
  }

  // Has what comes of a game kept, once: it ended, or it was put away while still going
  function settle(connection: Connection, how: "finished" | "abandoned"): void {
    const solo = connection.solo
    if (!solo || solo.settled) return
    solo.settled = true
    inBackground(solo.mode[how](solo.game, connection.player.id, Date.now()))
  }

  // Puts a player's game away, and tells them so if they had one. One still being played is given up
  function end(connection: Connection): void {
    if (!connection.solo) return
    settle(connection, "abandoned")
    connection.solo = null
    send(connection)
  }

  // Starts a game for a player, or picks one of theirs back up. Tells them why if it can't be
  async function start(connection: Connection, mode: SoloModeId, request: SoloRequest): Promise<void> {
    if (connection.room) return
    const opened = await modes[mode].open(connection.player, request, Date.now())
    // gone, or into a room, while the game was being made
    if (!isLive(connection) || connection.room) return
    if (typeof opened === "string") return connection.send({ type: "error", action: "startSolo", message: opened })

    // whatever they were playing before is given up
    if (connection.solo) settle(connection, "abandoned")
    connection.solo = { mode: modes[mode], game: opened, settled: false }
    // a board so small that the first click cleared it is won there and then
    if (!isPlaying(opened, connection.player.id)) settle(connection, "finished")
    send(connection)
  }

  // The player has made a move in their game, which left them standing as `outcome`
  function moved(connection: Connection, outcome: PlayerOutcome): void {
    if (outcome !== "playing") settle(connection, "finished")
    send(connection)
  }

  return { start, end, moved }
}

export type SoloPlays = ReturnType<typeof createSoloPlay>

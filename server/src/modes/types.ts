import type { Game } from "../../../shared/game/game.js"
import type { RoomModeId, SoloModeId } from "../../../shared/game/modes.js"
import type { BoardSettings, CellPosition, Player, RoomVisibility } from "../../../shared/protocol.js"
import type { Ledger } from "../ledger.js"

// The server's half of a game mode. The rules a mode is played by are in shared/game/modes.ts, where the site can
// see them too. What is here is what only the server decides: how a game of it is started, and what comes of its
// results (experience, leaderboards, ratings, the records kept).
//
// A mode never touches the lobby, a connection or the database: it is handed a ledger to keep things in, and is
// told when things happen to a game of its own.

export type ModeServices = {
  ledger: Ledger
  // The seed of a new board: one nobody could guess, or try their way to. A board is its seed, so this is what
  // keeps the mines secret
  freshSeed: () => Uint8Array
  // The seed of the board everybody plays on a given day (YYYY-MM-DD): the same every time it is asked for,
  // and impossible to work out for anyone but the server
  dailySeed: (date: string) => Uint8Array
}

// what a player asked for in starting a game alone: all of it unchecked, as it arrived
export type SoloRequest = {
  settings?: BoardSettings
  opening?: CellPosition
}

// A game one player plays alone
export type SoloMode = {
  id: SoloModeId
  // Starts a game for a player, or picks back up one of theirs that is still going.
  // Resolves to the reason, in words they can be shown, when there is no game to give them
  open(player: Player, request: SoloRequest, now: number): Promise<Game<SoloModeId> | string>
  // the player's game has ended: the board cleared, or lost
  finished(game: Game, playerId: string, now: number): Promise<void>
  // the player put the game away, or went away, while it was still going
  abandoned(game: Game, playerId: string, now: number): Promise<void>
}

// A game the players in a room play together
export type RoomMode = {
  id: RoomModeId
  // starts a game for everyone in a room
  start(settings: BoardSettings, players: Player[], now: number, room: { visibility: RoomVisibility }): Game<RoomModeId>
  // one of the players has just cleared the board, while the game goes on for the others
  cleared(game: Game, playerId: string, now: number): Promise<void>
  // Nobody is playing any more. Resolves once everything that comes of the game has been kept, with what the
  // players are to be told of it (how far their ratings moved) written into the game
  finished(game: Game, now: number): Promise<void>
}

export type Modes = {
  solo: Record<SoloModeId, SoloMode>
  room: Record<RoomModeId, RoomMode>
}

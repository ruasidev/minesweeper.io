import type { Game } from "../../../shared/game/game.js"
import type { RoomModeId, SoloModeId } from "../../../shared/game/modes.js"
import type { BoardSettings, Player, RoomVisibility, ServerMessage } from "../../../shared/protocol.js"
import type { SoloMode } from "../modes/index.js"
import type { ChatLog } from "./chat.js"
import type { MoveLimiter } from "./moveLimiter.js"

// How a connection reaches its browser: all the lobby knows of the socket underneath
export type Transport = {
  send: (message: ServerMessage) => void
  close: (code: number, reason: string) => void
}

// One player's live connection. An account has one: connecting again takes over from the last
export type Connection = Transport & {
  player: Player
  // the room they are in, if they are in one
  room: Room | null
  // the game they are playing alone, if they are playing one (never at the same time as being in a room)
  solo: SoloPlay | null
  // the player whose board they are watching in their room's game, if they are watching one
  watching: string | null
  // when they last said something in a chat
  lastChatAt: number
  moves: MoveLimiter
}

// A game someone is playing alone, from when it starts until it is put away
export type SoloPlay = {
  mode: SoloMode
  game: Game<SoloModeId>
  // its result has been kept: a game is settled once, however many things then put it away
  settled: boolean
}

export type Room = {
  id: string
  name: string
  visibility: RoomVisibility
  // private rooms only; never sent to anyone
  passcode: string | null
  host: Connection
  // in the order they joined
  members: Connection[]
  // the game the room plays next, and the board it will be played on
  mode: RoomModeId
  settings: BoardSettings
  // the game being played, or the last one played, kept for its results until the next one starts
  game: Game<RoomModeId> | null
  // everyone who started that game, in the order they joined the room
  roster: Player[]
  // stops whoever is still playing when their time runs out
  deadlineTimer: ReturnType<typeof setTimeout> | null
  chat: ChatLog
  // the accounts the host has removed, which can't join again
  kicked: Set<string>
}

import { GAME_MODES, type GameFamily } from "../../shared/game/modes"
import type { ChatMessage, ClientMessage, OwnGame, RoomDetail, RoomSummary, ServerMessage } from "../../shared/protocol"

// What the browser knows from the game server, and how each thing the server says changes it.
// The server is the source of truth: it says what rooms there are, which one this player is in, what game they
// are playing and how their board looks, and what is said in the chats. Nothing here talks to anything: it only
// works out the next state from the last one (the socket itself is in useServerConnection).

// "replaced": this account opened the game somewhere else, which took the connection over.
// "outdated": this page is from before the server was last updated, and has to be loaded again
export type ConnectionStatus = "connecting" | "connected" | "replaced" | "outdated"

export type ConnectionError = { action: ClientMessage["type"], message: string }

// The server says how long ago things happened and how long is left; these are those same moments by this
// browser's clock, worked out once when they were first heard of, so they don't wobble with every message after

// The game this player is playing, with its times as moments
export type LiveGame = OwnGame & {
  // when play began, or begins once the countdown is over
  startedAt: number
  // when they can play again after a mine went off
  cooldownUntil: number
}

// A board being watched
export type WatchedGame = {
  playerId: string
  cells: string
  cooldownUntil: number
}

export type ConnectionState = {
  status: ConnectionStatus
  rooms: RoomSummary[]
  room: RoomDetail | null
  // when play began in the room's game, and when the players still going in it are stopped (null until that clock starts)
  gameStartedAt: number | null
  gameDeadlineAt: number | null
  // the game this player is playing themselves: in their room, or alone
  game: LiveGame | null
  // the board of another player this one is watching, once their own game is over
  watching: WatchedGame | null
  // what has been said in the room this player is in, and in the chat everyone shares, oldest first
  chat: ChatMessage[]
  globalChat: ChatMessage[]
  error: ConnectionError | null
  // something the player should know that they didn't ask for: being removed from a room
  notice: string | null
}

export const DISCONNECTED: ConnectionState = {
  status: "connecting",
  rooms: [],
  room: null,
  gameStartedAt: null,
  gameDeadlineAt: null,
  game: null,
  watching: null,
  chat: [],
  globalChat: [],
  error: null,
  notice: null,
}

const familyOf = (game: OwnGame): GameFamily => GAME_MODES[game.mode].family

// The player's own game, if it is one of this kind: each page of the site shows the kind that is its own
export const ownGameIn = (state: Pick<ConnectionState, "game">, family: GameFamily): LiveGame | null =>
  state.game && familyOf(state.game) === family ? state.game : null

// The state after something the server said, at `now` by this browser's clock
export function receive(state: ConnectionState, message: ServerMessage, now: number): ConnectionState {
  switch (message.type) {
    case "rooms":
      return { ...state, rooms: message.rooms }

    case "room": {
      const room = message.room
      const game = room?.game ?? null
      // one game can follow straight on from another, so the times kept for it have to be started afresh
      const sameGame = game !== null && game.id === state.room?.game?.id
      return {
        ...state,
        room,
        gameStartedAt: !game ? null : sameGame && state.gameStartedAt !== null ? state.gameStartedAt : now - game.elapsedMs,
        gameDeadlineAt: !game || game.timeLeftMs === null ? null
          : sameGame && state.gameDeadlineAt !== null ? state.gameDeadlineAt : now + game.timeLeftMs,
        // whatever was being watched was in the last game
        watching: sameGame ? state.watching : null,
        // out of the room, its chat and their board in its game went with it
        chat: room ? state.chat : [],
        game: !room && state.game && familyOf(state.game) === "multiplayer" ? null : state.game,
      }
    }

    case "game": {
      const game = message.game
      if (!game) return { ...state, game: null }
      const sameGame = game.id === state.game?.id
      return { ...state, game: { ...game, startedAt: sameGame ? state.game!.startedAt : now - game.elapsedMs, cooldownUntil: now + game.cooldownMs } }
    }

    case "watching":
      return { ...state, watching: { playerId: message.playerId, cells: message.board.cells, cooldownUntil: now + message.board.cooldownMs } }

    case "chatHistory":
      return { ...state, chat: message.messages }
    case "chat":
      return { ...state, chat: [...state.chat, message.message] }
    case "globalChatHistory":
      return { ...state, globalChat: message.messages }
    case "globalChat":
      return { ...state, globalChat: [...state.globalChat, message.message] }

    case "kicked":
      return { ...state, notice: `The host removed you from "${message.roomName}".` }
    case "error":
      return { ...state, error: { action: message.action, message: message.message } }
  }
}

// The state after asking the server for something: whatever went wrong last time is behind the player now
export function asked(state: ConnectionState, message: ClientMessage): ConnectionState {
  // anything they go on to do in the list of rooms puts the notice behind them too
  const notice = message.type === "createRoom" || message.type === "joinRoom" ? null : state.notice
  // no longer watching, without waiting to be told
  const watching = message.type === "spectate" && message.playerId === null ? null : state.watching
  return state.error === null && notice === state.notice && watching === state.watching ? state : { ...state, error: null, notice, watching }
}

// The state once the connection has gone: whatever room or game this player was in, the server has taken them out
// of it. What everyone was saying is kept, for when the connection comes back, and so is anything they have yet to read
export function dropped(state: ConnectionState, status: ConnectionStatus): ConnectionState {
  return { ...DISCONNECTED, status, globalChat: state.globalChat, error: state.error, notice: state.notice }
}

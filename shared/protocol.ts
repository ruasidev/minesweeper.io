// What the browser and the server say to each other over the game's WebSocket (/api/ws), as JSON.
// Imported by both sides. The rules of the games themselves are in engine/ and game/

import type { BoardSettings } from "./engine/field.js"
import type { GameModeId, RoomModeId, SoloModeId } from "./game/modes.js"

export type { BoardSettings } from "./engine/field.js"

// Goes up whenever a message changes shape. The site says which it speaks as it connects (?v=), and a server that
// speaks another closes the connection with CLOSE_OUTDATED: a page left open across an update is told to reload,
// rather than left half working
export const PROTOCOL_VERSION = 2

// The code a connection is closed with when the same account connects again somewhere else
export const CLOSE_REPLACED = 4000
// ...when the account has been banned
export const CLOSE_BANNED = 4003
// ...and when the page is from before the server was last updated
export const CLOSE_OUTDATED = 4004

export const ROOM_NAME_MAX = 40
export const PASSCODE_MIN = 4
export const PASSCODE_MAX = 32

export const CHAT_TEXT_MAX = 300
// A room remembers this many of its latest chat messages, for showing to players who join later
export const CHAT_HISTORY_MAX = 50

// How finished one section of a player's board is goes from 0 to this
export const SECTION_LEVELS = 10

export type CellPosition = { row: number, col: number }

// How a player's game has gone: still at it, or how it ended for them.
// "timedOut" is being stopped with the board uncleared: by the time limit, or by the host ending the game.
// "lost" is uncovering a mine in a game where that ends it
export type PlayerOutcome = "playing" | "cleared" | "gaveUp" | "timedOut" | "left" | "lost"

// One thing a player did in a game: how far into the game (in milliseconds), what it was (0 clicking a cell, which
// uncovers or chords it; 1 flagging or unflagging one), and the cell. Every game is kept as a list of these
export type Move = [ms: number, kind: 0 | 1, row: number, col: number]
export const MOVE_CLICK = 0
export const MOVE_FLAG = 1

// The game a player is playing themselves, whatever kind of game it is: their own board as they see it, and how
// they stand. The server holds the mines and the clock, which is what lets a result be trusted
export type OwnGame = {
  // different for every game
  id: number
  mode: GameModeId
  settings: BoardSettings
  // the cell the board was opened on
  opening: CellPosition
  // How long the game's clock had been running when this was sent.
  // Negative during the countdown before a dealt board may be played: play begins when this reaches 0
  elapsedMs: number
  // their board, one character per cell, row after row (see engine/view.ts)
  cells: string
  // how long they still have to sit out after a mine went off
  cooldownMs: number
  outcome: PlayerOutcome
  // how long their game lasted, once it is over for them
  durationMs: number | null
  mineHits: number
  // how much of the board they have uncovered, 0 to 100
  percent: number
  // Where every mine was, one character per cell, row after row ("1" a mine, "0" not). Only once their game is over,
  // and only in a game whose rules show it: until then nothing about a covered cell leaves the server
  layout: string | null
}

// A board someone is watching: another player's, as that player sees it
export type WatchedBoard = {
  cells: string
  cooldownMs: number
}

// How far along one player is, as everyone in the room sees it
export type PlayerProgress = {
  // How finished each section of their board is (0 to SECTION_LEVELS), row after row.
  // Sections are squares of several cells, so this shows roughly where they have got to and no more
  sections: number[]
  // how much of the board they have uncovered, 0 to 100
  percent: number
  mineHits: number
  // how long they took, once they have uncovered everything
  finishedMs: number | null
  outcome: PlayerOutcome
  // 1 for whoever is doing best; equal results share a place. Settled once a player has cleared the board.
  // For anyone who hasn't, it can still change until the game is over
  place: number
  // How far the game moved their rating, once it is over and that has been worked out.
  // Null until then, and for a game that didn't count (nobody to be measured against)
  ratingChange: number | null
}

// The game being played in a room, or the last one played there, as everyone in the room sees it
export type GameSummary = {
  // different for every game, so one game can be told from the next
  id: number
  mode: GameModeId
  settings: BoardSettings
  // whether the game counts towards ratings (see README: only some rooms' games do)
  rated: boolean
  // everyone who started the game, in the order they joined the room, including anyone who has left since
  players: Player[]
  // Nobody is playing any more: everyone has cleared the board, given up, left or been stopped.
  // The game stays with the room, for its results, until the next one starts
  over: boolean
  // How long the players still going have left before they are stopped. Null until that clock starts:
  // when at least half of the players who haven't given up or left have cleared the board
  timeLeftMs: number | null
  // how many sections the board is divided into each way
  sectionRows: number
  sectionCols: number
  // the cell the board was opened on for everyone
  opening: CellPosition
  // How long the game had been going when this was sent.
  // Negative during the countdown before it starts: play begins when this reaches 0
  elapsedMs: number
  // by player id, for everyone in `players`
  progress: Record<string, PlayerProgress>
}

export type RoomVisibility = "public" | "private"

export type Player = {
  id: string
  username: string
  image: string | null
}

// Something a player said in a chat
export type ChatMessage = {
  id: number
  playerId: string
  username: string
  text: string
  // when the server received it, in milliseconds since 1970
  sentAt: number
}

// A room as it appears in the list of rooms
export type RoomSummary = {
  id: string
  name: string
  visibility: RoomVisibility
  hostUsername: string
  playerCount: number
  // a room can't be joined while a game is being played in it
  inGame: boolean
}

// A room as the players inside it see it
export type RoomDetail = {
  id: string
  name: string
  visibility: RoomVisibility
  hostId: string
  // in the order they joined
  players: Player[]
  // the game the room plays next, and the board it will be played on; the host chooses both
  mode: RoomModeId
  settings: BoardSettings
  game: GameSummary | null
}

export type ClientMessage =
  // a passcode is needed for a private room, and ignored for a public one
  | { type: "createRoom", name: string, visibility: RoomVisibility, passcode?: string }
  | { type: "joinRoom", roomId: string, passcode?: string }
  | { type: "leaveRoom" }
  // say something to everyone in the room
  | { type: "chat", text: string }
  // say something to everyone who is online
  | { type: "globalChat", text: string }
  // host only: hand the room over to another player in it
  | { type: "makeHost", playerId: string }
  // host only: remove a player from the room. They can't come back into it
  | { type: "kick", playerId: string }
  // host only, between games: what the room plays next, and on what board
  | { type: "setMode", mode: RoomModeId }
  | { type: "setSettings", settings: BoardSettings }
  | { type: "startGame" }
  // host only: stop the game for everyone still playing it
  | { type: "endGame" }
  // stop playing the room's game without clearing the board
  | { type: "giveUp" }
  // Watch another player's board in the room's game, or stop watching (null).
  // Only for someone whose own game is over: everyone plays the same board
  | { type: "spectate", playerId: string | null }
  // Start a game played alone, or pick one back up where its rules allow. Not while in a room; whatever was being
  // played alone before is given up. A game whose board opens on the player's own click is started by that click,
  // on the board asked for: `settings` and `opening`. One whose board is dealt takes neither
  | { type: "startSolo", mode: SoloModeId, settings?: BoardSettings, opening?: CellPosition }
  // put the game being played alone away: giving it up, if it isn't over
  | { type: "endSolo" }
  // click a cell (which uncovers it, or chords it if it is uncovered already), or flag one, in whatever game this
  // player is playing
  | { type: "reveal", row: number, col: number }
  | { type: "flag", row: number, col: number }

export type ServerMessage =
  // every room there is; sent on connecting and again whenever it changes
  | { type: "rooms", rooms: RoomSummary[] }
  // the room this player is in, or null; sent whenever it changes, including anyone's progress in a game
  | { type: "room", room: RoomDetail | null }
  // what has been said lately in the chat everyone shares; sent once, on connecting
  | { type: "globalChatHistory", messages: ChatMessage[] }
  // something just said there
  | { type: "globalChat", message: ChatMessage }
  // what has been said in the room lately; sent once, on joining it
  | { type: "chatHistory", messages: ChatMessage[] }
  // something just said in the room
  | { type: "chat", message: ChatMessage }
  // The game this player is playing themselves, or null once there isn't one. Sent when it starts, whenever their
  // board or their standing in it changes, and when it is put away
  | { type: "game", game: OwnGame | null }
  // the board of the player being watched; sent on starting to watch and whenever that board changes
  | { type: "watching", playerId: string, board: WatchedBoard }
  // this player was removed from their room by its host
  | { type: "kicked", roomName: string }
  // something this player asked for couldn't be done
  | { type: "error", action: ClientMessage["type"], message: string }

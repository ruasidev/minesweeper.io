// What the browser and the server say to each other over the multiplayer WebSocket (/api/ws), as JSON.
// Imported by both sides, so this file must not import anything else

export const ROOM_NAME_MAX = 40
export const PASSCODE_MIN = 4
export const PASSCODE_MAX = 32

// The code a connection is closed with when the same account connects again somewhere else
export const CLOSE_REPLACED = 4000

export const CHAT_TEXT_MAX = 300
// A room remembers this many of its latest chat messages, for showing to players who join later
export const CHAT_HISTORY_MAX = 50

export const BOARD_SIZE_MAX = 99
export const MINES_MAX = 99

// How long players get to look at the board, and where it opens, before a game lets them play
export const START_COUNTDOWN_MS = 3000

// How long a player sits out after uncovering a mine
export const MINE_COOLDOWN_MS = 3000

// How finished one section of a player's board is goes from 0 to this
export const SECTION_LEVELS = 10

// A player's own board is sent as one character per cell, row after row:
// one of these, or "0" to "8" for an uncovered cell with that many mines around it
export const CELL_HIDDEN = "."
export const CELL_FLAGGED = "F"
export const CELL_MINE = "*"

export type BoardSettings = {
  rows: number
  cols: number
  mines: number
}

// The classic boards. Any other board is a custom one
export const BOARD_PRESETS: { id: string, label: string, settings: BoardSettings }[] = [
  { id: "beginner", label: "Beginner", settings: { rows: 9, cols: 9, mines: 10 } },
  { id: "intermediate", label: "Intermediate", settings: { rows: 16, cols: 16, mines: 40 } },
  { id: "expert", label: "Expert", settings: { rows: 16, cols: 30, mines: 99 } },
]

// what a new room starts with: Intermediate
export const DEFAULT_BOARD_SETTINGS: BoardSettings = BOARD_PRESETS[1].settings

// the board every day's challenge is played on: Intermediate
export const DAILY_BOARD_SETTINGS: BoardSettings = BOARD_PRESETS[1].settings

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
}

// A player's go at today's challenge, while they are playing it
export type DailyState = {
  // the day it belongs to, as YYYY-MM-DD (the server's day, in UTC)
  date: string
  settings: BoardSettings
  // the cell the opening click was made on
  start: { row: number, col: number }
  // How long their clock had been running when this was sent: it starts the first time they start
  // the challenge that day and never stops. Negative during the countdown before that
  elapsedMs: number
  percent: number
  mineHits: number
  finishedMs: number | null
}

// The game being played in a room, as everyone in the room sees it
export type GameSummary = {
  settings: BoardSettings
  // how many sections the board is divided into each way
  sectionRows: number
  sectionCols: number
  // the cell the opening click was made on for everyone
  start: { row: number, col: number }
  // How long the game had been going when this was sent.
  // Negative during the countdown before it starts: play begins when this reaches 0
  elapsedMs: number
  // by player id
  progress: Record<string, PlayerProgress>
}

export type RoomVisibility = "public" | "private"

export type Player = {
  id: string
  username: string
  image: string | null
}

// Something a player said in their room's chat
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
  // a room can't be joined while it is in the middle of a game
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
  // the board the next game will be played on; the host chooses
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
  // host only, between games
  | { type: "setSettings", settings: BoardSettings }
  | { type: "startGame" }
  // host only: stop the game and go back to the room
  | { type: "endGame" }
  // start today's challenge, or pick it back up; not while in a room
  | { type: "startDaily" }
  // uncover a cell, or chord it if it is already uncovered: in the room's game, or in the daily challenge
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
  // this player's go at today's challenge; sent when they start it and whenever it changes
  | { type: "daily", daily: DailyState | null }
  // this player's own board in the game, and how long they still have to sit out;
  // sent when the game starts and whenever their board changes
  | { type: "board", cells: string, cooldownMs: number }
  // this player was removed from their room by its host
  | { type: "kicked", roomName: string }
  // something this player asked for couldn't be done
  | { type: "error", action: ClientMessage["type"], message: string }

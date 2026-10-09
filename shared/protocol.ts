// What the browser and the server say to each other over the multiplayer WebSocket (/api/ws), as JSON.
// Imported by both sides, so this file must not import anything else

export const ROOM_NAME_MAX = 40
export const PASSCODE_MIN = 4
export const PASSCODE_MAX = 32

// The code a connection is closed with when the same account connects again somewhere else
export const CLOSE_REPLACED = 4000
// ...and when the account has been banned
export const CLOSE_BANNED = 4003

export const CHAT_TEXT_MAX = 300
// A room remembers this many of its latest chat messages, for showing to players who join later
export const CHAT_HISTORY_MAX = 50

export const BOARD_SIZE_MAX = 99
export const MINES_MAX = 99

// How long players get to look at the board, and where it opens, before a game lets them play
export const START_COUNTDOWN_MS = 3000

// A mine going off doesn't end a game the server runs. It covers back up everything the player had uncovered
// within this many cells of it (a smaller blast on a small board), and they sit out while it plays out
export const mineBlastRadius = ({ rows, cols }: { rows: number, cols: number }): number =>
  Math.max(2, Math.min(3, Math.round(Math.min(rows, cols) / 5))) + 0.5
export const MINE_COOLDOWN_MS = 800

// Once at least half of the players have cleared the board, the rest get this long to finish before they are
// stopped: a bigger board gives more time. (About 55 seconds for Beginner, 1:45 for Intermediate, 2:55 for Expert.)
const FINISH_TIME_BASE_MS = 30_000
const FINISH_TIME_PER_CELL_MS = 300
const FINISH_TIME_MAX_MS = 10 * 60_000
export const finishTimeMs = ({ rows, cols }: { rows: number, cols: number }): number =>
  Math.min(FINISH_TIME_MAX_MS, FINISH_TIME_BASE_MS + rows * cols * FINISH_TIME_PER_CELL_MS)

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

// How a player's game has gone: still at it, or how it ended for them.
// "timedOut" is being stopped with the board uncleared: by the time limit, or by the host ending the game.
// "lost" is uncovering a mine in a game where that ends it: singleplayer
export type PlayerOutcome = "playing" | "cleared" | "gaveUp" | "timedOut" | "left" | "lost"

// One thing a player did in a game the server ran: how far into the game (in milliseconds), what it was
// (0 uncovering or chording a cell, 1 flagging or unflagging one), and the cell. Every game is kept as a list of these
export type Move = [ms: number, kind: 0 | 1, row: number, col: number]

// A singleplayer game the server is running for a signed-in player. The server holds the mines and times the game,
// which is what lets the result be trusted
export type SoloState = {
  // different for every game
  id: number
  settings: BoardSettings
  // how long the game had been going when this was sent: its clock starts with the first click
  elapsedMs: number
  outcome: "playing" | "cleared" | "lost"
  // how long the game lasted, once it is over
  endedMs: number | null
  // Where every mine was, one character per cell, row after row ("1" a mine, "0" not).
  // Only once the game is over: until then nothing about a covered cell leaves the server
  mines: string | null
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

// The game being played in a room, or the last one played there, as everyone in the room sees it
export type GameSummary = {
  // different for every game, so one game can be told from the next
  id: number
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
  // the cell the opening click was made on for everyone
  start: { row: number, col: number }
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
  // host only: stop the game for everyone still playing it
  | { type: "endGame" }
  // stop playing the room's game without clearing the board
  | { type: "giveUp" }
  // Watch another player's board in the room's game, or stop watching (null).
  // Only for someone whose own game is over: everyone plays the same board
  | { type: "spectate", playerId: string | null }
  // start today's challenge, or pick it back up; not while in a room
  | { type: "startDaily" }
  // Start a singleplayer game with its first click: the mines are laid around that cell, as they would be in the
  // browser. Not while in a room. Whatever singleplayer game was going before is given up
  | { type: "soloStart", settings: BoardSettings, row: number, col: number }
  // give up the singleplayer game (or put away one that is over)
  | { type: "soloEnd" }
  // uncover a cell, or chord it if it is already uncovered: in the room's game, the daily challenge, or singleplayer
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
  // this player's singleplayer game; sent when it starts, when it ends, and when it is put away
  | { type: "solo", solo: SoloState | null }
  // this player's own board in the game, and how long they still have to sit out;
  // sent when the game starts and whenever their board changes
  | { type: "board", cells: string, cooldownMs: number }
  // the board of the player being watched; sent on starting to watch and whenever that board changes
  | { type: "watching", playerId: string, cells: string, cooldownMs: number }
  // this player was removed from their room by its host
  | { type: "kicked", roomName: string }
  // something this player asked for couldn't be done
  | { type: "error", action: ClientMessage["type"], message: string }

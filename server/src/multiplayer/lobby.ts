import { randomBytes, timingSafeEqual } from "node:crypto"
import { getMaxMines, MIN_BOARD_SIZE } from "../../../shared/board.js"
import {
  BOARD_SIZE_MAX, CHAT_HISTORY_MAX, CHAT_TEXT_MAX, CLOSE_REPLACED, DEFAULT_BOARD_SETTINGS, MINES_MAX, PASSCODE_MAX, PASSCODE_MIN, ROOM_NAME_MAX,
  finishTimeMs,
  type BoardSettings, type ChatMessage, type ClientMessage, type DailyState, type Player, type RoomDetail, type RoomSummary, type RoomVisibility, type ServerMessage,
} from "../../../shared/protocol.js"
import { db } from "../db/index.js"
import { multiplayerResult } from "../db/schema.js"
import { openDailyGame, saveDailyResult } from "./daily.js"
import { addProgress, DAILY_XP, multiplayerXp, updateElo } from "../progression.js"
import {
  boardView, flag, giveUp, isPlaying, leaveGame, progressFor, reveal, standings, startGame, stillPlaying, stopEveryone, summarize, timeLimitDue,
  type Game,
} from "./game.js"

// One player's live connection
export type Connection = {
  player: Player
  send: (message: ServerMessage) => void
  close: (code: number, reason: string) => void
  room: Room | null
  // their go at the daily challenge, while they are playing it (never at the same time as being in a room)
  daily: { date: string, game: Game, firstStart: boolean } | null
  // the player whose board they are watching in their room's game, if they are watching one
  watching: string | null
  // when they last said something in chat
  lastChatAt: number
}

type Room = {
  id: string
  name: string
  visibility: RoomVisibility
  // private rooms only; never sent to anyone
  passcode: string | null
  host: Connection
  // in the order they joined
  members: Connection[]
  // the board the next game will be played on
  settings: BoardSettings
  // the game being played, or the last one played, kept for its results until the next one starts
  game: Game | null
  // everyone who started that game, in the order they joined the room
  roster: Player[]
  // stops whoever is still playing when their time runs out
  deadlineTimer: ReturnType<typeof setTimeout> | null
  // the latest messages, oldest first
  chat: ChatMessage[]
  // the accounts the host has removed, which can't join again
  kicked: Set<string>
}

// The shortest gap between two chat messages from one player. Not moderation, just a brake on flooding
const CHAT_GAP_MS = 500
let nextChatId = 1

// Everything here lives in memory: a room exists only while players are connected to it,
// and restarting the server clears them all
const connections = new Map<string, Connection>() // by account id
const rooms = new Map<string, Room>()

const summary = (room: Room): RoomSummary => ({
  id: room.id,
  name: room.name,
  visibility: room.visibility,
  hostUsername: room.host.player.username,
  playerCount: room.members.length,
  inGame: room.game !== null && !room.game.over,
})

const detail = (room: Room): RoomDetail => ({
  id: room.id,
  name: room.name,
  visibility: room.visibility,
  hostId: room.host.player.id,
  players: room.members.map(member => member.player),
  settings: room.settings,
  game: room.game && summarize(room.game, room.roster, Date.now()),
})

// Every room there is, as the list of rooms shows them
export const openRooms = (): RoomSummary[] => [...rooms.values()].map(summary)

const roomList = (): ServerMessage => ({ type: "rooms", rooms: openRooms() })

function broadcastRooms() {
  const message = roomList()
  for (const connection of connections.values()) connection.send(message)
}

function sendRoomToMembers(room: Room) {
  const message: ServerMessage = { type: "room", room: detail(room) }
  for (const member of room.members) member.send(message)
}

// The game a player is in, if any: their room's, or the daily challenge
const gameOf = (connection: Connection): Game | null => connection.room?.game ?? connection.daily?.game ?? null

// A player's own board in the game they are in
function sendBoard(connection: Connection) {
  const game = gameOf(connection)
  const view = game && boardView(game, connection.player.id, Date.now())
  if (view) connection.send({ type: "board", ...view })
}

function sendDaily(connection: Connection) {
  const daily = connection.daily
  const progress = daily && progressFor(daily.game, connection.player.id)
  const state: DailyState | null = daily && progress && {
    date: daily.date,
    settings: daily.game.settings,
    start: daily.game.start,
    elapsedMs: Date.now() - daily.game.startedAt,
    percent: progress.percent,
    mineHits: progress.mineHits,
    finishedMs: progress.finishedMs,
  }
  connection.send({ type: "daily", daily: state })
}

// Saving a result must never get in the way of the game it came from
const inBackground = (saving: Promise<unknown>) => { saving.catch(error => console.error("Could not save a result:", error)) }

// The board of the player someone is watching
function sendWatched(connection: Connection) {
  const game = connection.room?.game
  const view = game && connection.watching !== null && boardView(game, connection.watching, Date.now())
  if (view) connection.send({ type: "watching", playerId: connection.watching!, ...view })
}

// A player's board has changed: whoever is watching it sees that too
function sendToWatchers(room: Room, playerId: string) {
  for (const member of room.members) {
    if (member.watching === playerId) sendWatched(member)
  }
}

// A multiplayer game is over, because nobody is playing it any more: everyone who took part gets their
// experience and their time played, and ratings move if there was anyone to be measured against
function finishGame(room: Room, game: Game) {
  game.over = true
  if (room.deadlineTimer) clearTimeout(room.deadlineTimer)
  room.deadlineTimer = null

  const results = standings(game, Date.now())
  inBackground((async () => {
    for (const result of results) {
      await addProgress(result.playerId, {
        xp: multiplayerXp(game.settings, { ...result, playerCount: results.length }),
        playSeconds: result.elapsedMs / 1000,
      })
    }
    game.ratingChanges = await updateElo(new Map(results.map(result => [result.playerId, result.place])))
    // the results everyone is looking at can now say how far each rating moved
    if (rooms.get(room.id) === room && room.game === game) sendRoomToMembers(room)
  })())
}

// Moves a room's game along after anything that changes who is still playing it: starts the clock on the players
// still going once enough of the others have finished, and ends the game once nobody is playing.
// Returns whether the game ended just now. Telling the room is left to whoever called
function advanceGame(room: Room): boolean {
  const game = room.game
  if (!game || game.over) return false
  if (stillPlaying(game) === 0) {
    finishGame(room, game)
    return true
  }
  if (timeLimitDue(game)) {
    const allowed = finishTimeMs(game.settings)
    game.deadline = Date.now() + allowed
    room.deadlineTimer = setTimeout(() => {
      // the room, or this game in it, may be gone by now
      if (rooms.get(room.id) !== room || room.game !== game || game.over) return
      stopEveryone(game, Date.now())
      finishGame(room, game)
      sendRoomToMembers(room)
      broadcastRooms()
    }, allowed)
  }
  return false
}

// What has been said lately in the chat everyone shares, oldest first
let globalChat: ChatMessage[] = []

const isIntBetween = (value: unknown, low: number, high: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= low && value <= high

// The same limits the singleplayer sliders have
function validSettings(settings: unknown): BoardSettings | null {
  const { rows, cols, mines } = (settings ?? {}) as Record<string, unknown>
  const valid =
    isIntBetween(rows, MIN_BOARD_SIZE, BOARD_SIZE_MAX) &&
    isIntBetween(cols, MIN_BOARD_SIZE, BOARD_SIZE_MAX) &&
    isIntBetween(mines, 1, Math.min(MINES_MAX, getMaxMines(rows, cols)))
  return valid ? { rows, cols, mines } : null
}

function sameText(a: string, b: string): boolean {
  const [left, right] = [Buffer.from(a), Buffer.from(b)]
  return left.length === right.length && timingSafeEqual(left, right)
}

// An account has one live connection: connecting again (another tab, another device) takes over from the old one
export function connect(player: Player, transport: Pick<Connection, "send" | "close">): Connection {
  const previous = connections.get(player.id)
  if (previous) {
    disconnect(previous)
    previous.close(CLOSE_REPLACED, "Opened somewhere else")
  }

  const connection: Connection = { player, ...transport, room: null, daily: null, watching: null, lastChatAt: 0 }
  connections.set(player.id, connection)
  connection.send(roomList())
  connection.send({ type: "globalChatHistory", messages: globalChat })
  return connection
}

export function disconnect(connection: Connection) {
  // already taken over by a newer connection of the same account
  if (connections.get(connection.player.id) !== connection) return
  leaveRoom(connection)
  connections.delete(connection.player.id)
}

function joinRoom(connection: Connection, room: Room) {
  // going into a room puts the daily challenge down (its clock keeps running)
  if (connection.daily) {
    connection.daily = null
    sendDaily(connection)
  }
  room.members.push(connection)
  connection.room = room
  sendRoomToMembers(room)
  // what was said before they arrived
  connection.send({ type: "chatHistory", messages: room.chat })
  broadcastRooms()
}

function leaveRoom(connection: Connection) {
  const room = connection.room
  if (!room) return
  connection.room = null
  connection.watching = null
  room.members = room.members.filter(member => member !== connection)
  // walking out of a game that is still being played is one way of not finishing it
  if (room.game && !room.game.over) leaveGame(room.game, connection.player.id, Date.now())
  connection.send({ type: "room", room: null })

  if (room.members.length === 0) {
    // a game nobody is left in is over
    if (room.game && !room.game.over) finishGame(room, room.game)
    rooms.delete(room.id)
  } else {
    // the longest-standing member takes over a room its host has left
    if (room.host === connection) room.host = room.members[0]
    // they may have been the last one still playing, or the one the others were waiting for
    advanceGame(room)
    sendRoomToMembers(room)
  }
  broadcastRooms()
}

export function handleMessage(connection: Connection, raw: string) {
  let message: Partial<ClientMessage> & Record<string, unknown>
  try {
    message = JSON.parse(raw)
  } catch {
    return
  }
  if (typeof message !== "object" || message === null) return
  const fail = (action: ClientMessage["type"], text: string) => connection.send({ type: "error", action, message: text })

  switch (message.type) {
    case "createRoom": {
      const name = typeof message.name === "string" ? message.name.trim() : ""
      if (name.length < 1 || name.length > ROOM_NAME_MAX) return fail("createRoom", `Room names are 1-${ROOM_NAME_MAX} characters`)
      if (message.visibility !== "public" && message.visibility !== "private") return fail("createRoom", "Rooms are either public or private")

      let passcode: string | null = null
      if (message.visibility === "private") {
        const given = typeof message.passcode === "string" ? message.passcode : ""
        if (given.length < PASSCODE_MIN || given.length > PASSCODE_MAX) {
          return fail("createRoom", `Passcodes are ${PASSCODE_MIN}-${PASSCODE_MAX} characters`)
        }
        passcode = given
      }

      // a player is only ever in one room
      leaveRoom(connection)
      const room: Room = {
        id: randomBytes(6).toString("base64url"),
        name,
        visibility: message.visibility,
        passcode,
        host: connection,
        members: [],
        settings: DEFAULT_BOARD_SETTINGS,
        game: null,
        roster: [],
        deadlineTimer: null,
        chat: [],
        kicked: new Set(),
      }
      rooms.set(room.id, room)
      joinRoom(connection, room)
      return
    }

    case "joinRoom": {
      const room = typeof message.roomId === "string" ? rooms.get(message.roomId) : undefined
      if (!room) return fail("joinRoom", "That room is gone")
      if (connection.room === room) return connection.send({ type: "room", room: detail(room) })
      if (room.kicked.has(connection.player.id)) return fail("joinRoom", "The host removed you from that room")
      if (room.game && !room.game.over) return fail("joinRoom", "That room is in the middle of a game")
      if (room.passcode !== null && !(typeof message.passcode === "string" && sameText(message.passcode, room.passcode))) {
        return fail("joinRoom", "Wrong passcode")
      }

      leaveRoom(connection)
      joinRoom(connection, room)
      return
    }

    case "leaveRoom":
      leaveRoom(connection)
      return

    case "chat": {
      const room = connection.room
      const text = typeof message.text === "string" ? message.text.trim() : ""
      const now = Date.now()
      if (!room || text.length < 1 || text.length > CHAT_TEXT_MAX || now - connection.lastChatAt < CHAT_GAP_MS) return
      connection.lastChatAt = now

      const said: ChatMessage = { id: nextChatId++, playerId: connection.player.id, username: connection.player.username, text, sentAt: now }
      room.chat = [...room.chat, said].slice(-CHAT_HISTORY_MAX)
      for (const member of room.members) member.send({ type: "chat", message: said })
      return
    }

    case "globalChat": {
      const text = typeof message.text === "string" ? message.text.trim() : ""
      const now = Date.now()
      if (text.length < 1 || text.length > CHAT_TEXT_MAX || now - connection.lastChatAt < CHAT_GAP_MS) return
      connection.lastChatAt = now

      const said: ChatMessage = { id: nextChatId++, playerId: connection.player.id, username: connection.player.username, text, sentAt: now }
      globalChat = [...globalChat, said].slice(-CHAT_HISTORY_MAX)
      for (const everyone of connections.values()) everyone.send({ type: "globalChat", message: said })
      return
    }

    case "makeHost": {
      const room = connection.room
      if (!room || room.host !== connection) return
      const next = room.members.find(member => member.player.id === message.playerId)
      if (!next || next === connection) return
      room.host = next
      sendRoomToMembers(room)
      // the list of rooms names each room's host
      broadcastRooms()
      return
    }

    case "kick": {
      const room = connection.room
      if (!room || room.host !== connection) return
      const removed = room.members.find(member => member.player.id === message.playerId)
      if (!removed || removed === connection) return
      room.kicked.add(removed.player.id)
      // takes them out of the room, and out of its game if one is on
      leaveRoom(removed)
      removed.send({ type: "kicked", roomName: room.name })
      return
    }

    case "setSettings": {
      const room = connection.room
      if (!room || room.host !== connection || (room.game && !room.game.over)) return
      const settings = validSettings(message.settings)
      if (!settings) return fail("setSettings", "That board isn't possible")
      room.settings = settings
      sendRoomToMembers(room)
      return
    }

    case "startGame": {
      const room = connection.room
      // a game that is over makes way for the next one
      if (!room || room.host !== connection || (room.game && !room.game.over)) return
      room.roster = room.members.map(member => member.player)
      room.game = startGame(room.settings, room.roster.map(player => player.id), Date.now())
      for (const member of room.members) {
        // whatever they were watching was in the last game
        member.watching = null
        inBackground(addProgress(member.player.id, { gamesStarted: 1 }))
      }
      // a board so small that the opening click cleared it is over before it began
      advanceGame(room)
      sendRoomToMembers(room)
      for (const member of room.members) sendBoard(member)
      broadcastRooms()
      return
    }

    case "endGame": {
      const room = connection.room
      if (!room || room.host !== connection || !room.game || room.game.over) return
      stopEveryone(room.game, Date.now())
      finishGame(room, room.game)
      sendRoomToMembers(room)
      broadcastRooms()
      return
    }

    case "giveUp": {
      const room = connection.room
      if (!room?.game || !giveUp(room.game, connection.player.id, Date.now())) return
      const ended = advanceGame(room)
      sendRoomToMembers(room)
      if (ended) broadcastRooms()
      return
    }

    case "spectate": {
      const game = connection.room?.game
      if (!game) return
      if (message.playerId === null) {
        connection.watching = null
        return
      }
      // Everyone plays the same board, so another player's would show where it is safe:
      // watching is only for someone whose own game is over (or who wasn't in it)
      if (typeof message.playerId !== "string" || !game.players.has(message.playerId) || isPlaying(game, connection.player.id)) return
      connection.watching = message.playerId
      sendWatched(connection)
      return
    }

    case "startDaily": {
      if (connection.room) return
      openDailyGame(connection.player.id, Date.now()).then((daily) => {
        // gone, or into a room, while the database was being asked
        if (connections.get(connection.player.id) !== connection || connection.room) return
        if (!daily) return fail("startDaily", "You have already finished today's challenge")
        if (daily.firstStart) inBackground(addProgress(connection.player.id, { gamesStarted: 1 }))
        connection.daily = daily
        sendDaily(connection)
        sendBoard(connection)
      }).catch((error) => {
        console.error("Could not start the daily challenge:", error)
        fail("startDaily", "The daily challenge couldn't be started")
      })
      return
    }

    case "reveal": {
      const game = gameOf(connection)
      const id = connection.player.id
      const wasFinished = game ? progressFor(game, id)?.finishedMs != null : true
      if (!game || !reveal(game, id, message.row as number, message.col as number, Date.now())) return
      sendBoard(connection)

      // a board cleared just now is a result worth keeping
      const progress = progressFor(game, id)
      const finishedMs = wasFinished ? null : progress?.finishedMs ?? null
      if (connection.room) {
        // clearing the board may start the clock on the others, or end the game
        const ended = advanceGame(connection.room)
        // everyone in the room sees the progress
        sendRoomToMembers(connection.room)
        sendToWatchers(connection.room, id)
        if (ended) broadcastRooms()
        if (finishedMs !== null) {
          inBackground(db.insert(multiplayerResult).values({ userId: id, ...game.settings, durationMs: finishedMs, mineHits: progress!.mineHits }))
        }
      } else if (connection.daily) {
        sendDaily(connection)
        if (finishedMs !== null) {
          inBackground(saveDailyResult(id, connection.daily.date, finishedMs, progress!.mineHits))
          inBackground(addProgress(id, { xp: DAILY_XP, playSeconds: finishedMs / 1000 }))
        }
      }
      return
    }

    case "flag": {
      const game = gameOf(connection)
      if (!game || !flag(game, connection.player.id, message.row as number, message.col as number, Date.now())) return
      // flags are a player's own notes: only they, and anyone watching their board, see them
      sendBoard(connection)
      if (connection.room) sendToWatchers(connection.room, connection.player.id)
      return
    }
  }
}

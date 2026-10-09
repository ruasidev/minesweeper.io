import { randomBytes, timingSafeEqual } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { getMaxMines, MIN_BOARD_SIZE } from "../../../shared/board.js"
import {
  BOARD_SIZE_MAX, CHAT_HISTORY_MAX, CHAT_TEXT_MAX, CLOSE_BANNED, CLOSE_REPLACED, DEFAULT_BOARD_SETTINGS, MINES_MAX, PASSCODE_MAX, PASSCODE_MIN, ROOM_NAME_MAX,
  finishTimeMs,
  type BoardSettings, type ChatMessage, type ClientMessage, type DailyState, type Player, type RoomDetail, type RoomSummary, type RoomVisibility,
  type ServerMessage, type SoloState,
} from "../../../shared/protocol.js"
import { db } from "../db/index.js"
import { gameResult, multiplayerResult, user } from "../db/schema.js"
import { env } from "../env.js"
import { openDailyGame, saveDailyResult } from "./daily.js"
import { addProgress, DAILY_XP, multiplayerXp, singleplayerXp, updateElo } from "../progression.js"
import { ratedGamesBetween, saveRecord, suspicion } from "../records.js"
import {
  boardView, flag, giveUp, isPlaying, layoutOf, leaveGame, noteDropped, progressFor, recordOf, reveal, standings, startGame, stillPlaying,
  stopEveryone, summarize, timeLimitDue,
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
  // Their singleplayer game, from its first click until it is put away. `settled` once its result has been kept
  solo: { game: Game, settled: boolean } | null
  // how many moves they may make right now, and when that was last worked out (see allowMove)
  moveTokens: number
  moveStamp: number
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

// The game a player is in, if any: their room's, the daily challenge, or their singleplayer game
const gameOf = (connection: Connection): Game | null =>
  connection.room?.game ?? connection.daily?.game ?? connection.solo?.game ?? null

// Moves are let through at this rate at the very most: well beyond what the fastest players manage, and well
// short of what a program can send. A short burst above it is allowed for
const MOVES_PER_SECOND = 15
const MOVES_BURST = 30

// Whether a player may make a move right now. One that comes too soon is simply thrown away
function allowMove(connection: Connection, now: number): boolean {
  connection.moveTokens = Math.min(MOVES_BURST, connection.moveTokens + (now - connection.moveStamp) / 1000 * MOVES_PER_SECOND)
  connection.moveStamp = now
  if (connection.moveTokens < 1) return false
  connection.moveTokens--
  return true
}

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

function sendSolo(connection: Connection) {
  const solo = connection.solo
  const now = Date.now()
  const result = solo && recordOf(solo.game, connection.player.id, now)
  const over = result !== null && result.outcome !== "playing"
  const state: SoloState | null = solo && result && {
    id: solo.game.id,
    settings: solo.game.settings,
    elapsedMs: now - solo.game.startedAt,
    outcome: result.outcome === "cleared" ? "cleared" : result.outcome === "playing" ? "playing" : "lost",
    endedMs: over ? result.durationMs : null,
    // the mines are only told once there is nothing left to gain from knowing them
    mines: over ? layoutOf(solo.game) : null,
  }
  connection.send({ type: "solo", solo: state })
}

// A singleplayer game is over: won, lost, or thrown away part-way. Its result is kept for the player's stats and
// the leaderboards, and a win earns its experience. All of it is the server's own account of the game
function settleSolo(connection: Connection, abandoned: boolean) {
  const solo = connection.solo
  if (!solo || solo.settled) return
  solo.settled = true

  const { game } = solo
  const id = connection.player.id
  const now = Date.now()
  const result = recordOf(game, id, now)!
  const won = result.outcome === "cleared"
  // a win no person could have played stays off the leaderboards and earns nothing
  const reason = won ? suspicion(game, result) : null

  inBackground((async () => {
    // a game thrown away counts as started and as time played, but isn't a result
    if (!abandoned) {
      await db.insert(gameResult).values({
        userId: id, ...game.settings, won,
        durationSeconds: Math.round(result.durationMs / 1000), durationMs: Math.round(result.durationMs),
        verified: true, hidden: reason !== null, hiddenReason: reason,
      })
    }
    await addProgress(id, { xp: won && !reason ? singleplayerXp(game.settings) : 0, playSeconds: result.durationMs / 1000 })
    await saveRecord("singleplayer", game, id, now, { outcome: abandoned ? "abandoned" : undefined, suspectReason: reason })
  })())
}

// Puts a player's singleplayer game away. One still being played is thrown away
function endSolo(connection: Connection) {
  if (!connection.solo) return
  settleSolo(connection, true)
  connection.solo = null
}

// How much a rated game between two players counts when they have already played each other that many times
// in the last day: fully, then less each time, then not at all. It takes the point out of two accounts playing
// each other over and over to move a rating
const REPEAT_WEIGHTS = [1, 0.5, 0.25]

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

  const now = Date.now()
  const results = standings(game, now)
  inBackground((async () => {
    // a board cleared faster than a person could have earns nothing
    const reasons = new Map(results.map((result) => {
      const record = recordOf(game, result.playerId, now)!
      return [result.playerId, record.outcome === "cleared" ? suspicion(game, record) : null]
    }))
    for (const result of results) {
      await addProgress(result.playerId, {
        xp: reasons.get(result.playerId) ? 0 : multiplayerXp(game.settings, { ...result, playerCount: results.length }),
        playSeconds: result.elapsedMs / 1000,
      })
    }

    if (game.rated && results.length > 1) {
      const ids = results.map(result => result.playerId)
      // Once the site can send the email to confirm an address, only accounts that have confirmed theirs are rated
      const confirmed = env.emailEnabled
        ? new Set((await db.select({ id: user.id }).from(user).where(and(inArray(user.id, ids), eq(user.emailVerified, true)))).map(row => row.id))
        : new Set(ids)
      const weights = new Map<string, number>()
      for (const a of ids) {
        for (const b of ids) {
          if (a >= b) continue
          const counts = confirmed.has(a) && confirmed.has(b)
          weights.set(`${a} ${b}`, counts ? REPEAT_WEIGHTS[await ratedGamesBetween(a, b)] ?? 0 : 0)
        }
      }
      game.ratingChanges = await updateElo(
        new Map(results.map(result => [result.playerId, result.place])),
        (a, b) => weights.get(a < b ? `${a} ${b}` : `${b} ${a}`) ?? 0,
      )
    }
    // kept after the ratings are worked out, so this game isn't counted among the ones already played
    for (const result of results) {
      await saveRecord("multiplayer", game, result.playerId, now, { suspectReason: reasons.get(result.playerId) })
    }
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

  const connection: Connection = {
    player, ...transport, room: null, daily: null, solo: null, watching: null, lastChatAt: 0, moveTokens: MOVES_BURST, moveStamp: Date.now(),
  }
  connections.set(player.id, connection)
  connection.send(roomList())
  connection.send({ type: "globalChatHistory", messages: globalChat })
  return connection
}

export function disconnect(connection: Connection) {
  // already taken over by a newer connection of the same account
  if (connections.get(connection.player.id) !== connection) return
  leaveRoom(connection)
  endSolo(connection)
  connections.delete(connection.player.id)
}

// Cuts an account off at once, wherever it is: for one that has just been banned
export function dropPlayer(playerId: string) {
  const connection = connections.get(playerId)
  if (!connection) return
  disconnect(connection)
  connection.close(CLOSE_BANNED, "Banned")
}

function joinRoom(connection: Connection, room: Room) {
  // going into a room puts the daily challenge down (its clock keeps running), and gives up a singleplayer game
  if (connection.daily) {
    connection.daily = null
    sendDaily(connection)
  }
  if (connection.solo) {
    endSolo(connection)
    sendSolo(connection)
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
      // Only games in public rooms count towards ratings: a private room is for playing friends, and would be
      // the easy place to trade wins
      room.game = startGame(room.settings, room.roster.map(player => player.id), Date.now(), { rated: room.visibility === "public" })
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

    case "soloStart": {
      if (connection.room) return
      const settings = validSettings(message.settings)
      const { row, col } = message
      if (!settings || !isIntBetween(row, 0, settings.rows - 1) || !isIntBetween(col, 0, settings.cols - 1)) {
        return fail("soloStart", "That board isn't possible")
      }
      // whatever they were playing before is given up, and the daily challenge is put down
      endSolo(connection)
      if (connection.daily) {
        connection.daily = null
        sendDaily(connection)
      }

      const now = Date.now()
      // no countdown: the clock starts with the click that opens the board, and a mine ends the game
      connection.solo = { game: startGame(settings, [connection.player.id], now, { opening: { row, col }, startedAt: now, mineEnds: true }), settled: false }
      inBackground(addProgress(connection.player.id, { gamesStarted: 1 }))
      // a board so small that the first click cleared it is won there and then
      if (!isPlaying(connection.solo.game, connection.player.id)) settleSolo(connection, false)
      sendBoard(connection)
      sendSolo(connection)
      return
    }

    case "soloEnd": {
      endSolo(connection)
      sendSolo(connection)
      return
    }

    case "startDaily": {
      if (connection.room) return
      openDailyGame(connection.player.id, Date.now()).then((daily) => {
        // gone, or into a room, while the database was being asked
        if (connections.get(connection.player.id) !== connection || connection.room) return
        if (!daily) return fail("startDaily", "You have already finished today's challenge")
        if (daily.firstStart) inBackground(addProgress(connection.player.id, { gamesStarted: 1 }))
        // starting the challenge gives up a singleplayer game
        if (connection.solo) {
          endSolo(connection)
          sendSolo(connection)
        }
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
      const now = Date.now()
      if (!game) return
      if (!allowMove(connection, now)) return noteDropped(game, id)
      const wasFinished = progressFor(game, id)?.finishedMs != null
      if (!reveal(game, id, message.row as number, message.col as number, now)) return
      sendBoard(connection)

      // a board cleared just now is a result worth keeping
      const progress = progressFor(game, id)
      const finishedMs = wasFinished ? null : progress?.finishedMs ?? null
      // ...unless no person could have cleared it that fast: then it is kept, but off the leaderboards
      const reason = finishedMs === null ? null : suspicion(game, recordOf(game, id, now)!)
      if (connection.room) {
        // clearing the board may start the clock on the others, or end the game
        const ended = advanceGame(connection.room)
        // everyone in the room sees the progress
        sendRoomToMembers(connection.room)
        sendToWatchers(connection.room, id)
        if (ended) broadcastRooms()
        if (finishedMs !== null) {
          inBackground(db.insert(multiplayerResult).values({
            userId: id, ...game.settings, durationMs: finishedMs, mineHits: progress!.mineHits, hidden: reason !== null, hiddenReason: reason,
          }))
        }
      } else if (connection.daily) {
        sendDaily(connection)
        if (finishedMs !== null) {
          inBackground(saveDailyResult(id, connection.daily.date, finishedMs, progress!.mineHits, reason))
          inBackground(addProgress(id, { xp: reason ? 0 : DAILY_XP, playSeconds: finishedMs / 1000 }))
          inBackground(saveRecord("daily", game, id, now, { suspectReason: reason }))
        }
      } else if (connection.solo && progress?.outcome !== "playing") {
        // won or lost: either way the game is over, and the player is shown where the mines were
        settleSolo(connection, false)
        sendSolo(connection)
      }
      return
    }

    case "flag": {
      const game = gameOf(connection)
      const now = Date.now()
      if (!game) return
      if (!allowMove(connection, now)) return noteDropped(game, connection.player.id)
      if (!flag(game, connection.player.id, message.row as number, message.col as number, now)) return
      // flags are a player's own notes: only they, and anyone watching their board, see them
      sendBoard(connection)
      if (connection.room) sendToWatchers(connection.room, connection.player.id)
      return
    }
  }
}

import { randomBytes, timingSafeEqual } from "node:crypto"
import { boardSettingsFrom } from "../../../shared/engine/generate.js"
import { DEFAULT_BOARD_SETTINGS } from "../../../shared/game/boards.js"
import { giveUp, isPlaying, leaveGame, ownGame, stillPlaying, stopEveryone, summarize, timeLimitDue, watchedBoard, type Game } from "../../../shared/game/game.js"
import { DEFAULT_ROOM_MODE, finishTimeMs, type RoomModeId } from "../../../shared/game/modes.js"
import {
  PASSCODE_MAX, PASSCODE_MIN, ROOM_NAME_MAX,
  type ChatMessage, type PlayerOutcome, type RoomDetail, type RoomSummary, type RoomVisibility, type ServerMessage,
} from "../../../shared/protocol.js"
import { inBackground } from "../background.js"
import type { Modes } from "../modes/index.js"
import { newChatLog, say } from "./chat.js"
import type { Connection, Room } from "./types.js"

// Rooms, and the games played in them. Everything here lives in memory: a room exists only while players are
// connected to it, and restarting the server clears them all.
//
// Whatever goes wrong with what a player asked for comes back as words to show them; nothing is thrown

function sameText(a: string, b: string): boolean {
  const [left, right] = [Buffer.from(a), Buffer.from(b)]
  return left.length === right.length && timingSafeEqual(left, right)
}

const inGame = (room: Room): boolean => room.game !== null && !room.game.over
const isHost = (connection: Connection): boolean => connection.room?.host === connection

export function createRooms(modes: Modes["room"], everyone: () => Iterable<Connection>) {
  const rooms = new Map<string, Room>()

  const summary = (room: Room): RoomSummary => ({
    id: room.id,
    name: room.name,
    visibility: room.visibility,
    hostUsername: room.host.player.username,
    playerCount: room.members.length,
    inGame: inGame(room),
  })

  const detail = (room: Room): RoomDetail => ({
    id: room.id,
    name: room.name,
    visibility: room.visibility,
    hostId: room.host.player.id,
    players: room.members.map(member => member.player),
    mode: room.mode,
    settings: room.settings,
    game: room.game && summarize(room.game, room.roster, Date.now()),
  })

  // Every room there is, as the list of rooms shows them
  const list = (): RoomSummary[] => [...rooms.values()].map(summary)

  // --- Telling people -------------------------------------------------------------------------------------------

  // the list of rooms has changed: everyone who is connected sees it
  function announce(): void {
    const message: ServerMessage = { type: "rooms", rooms: list() }
    for (const connection of everyone()) connection.send(message)
  }

  // the room, or the game in it, has changed: everyone in it sees that
  function tell(room: Room): void {
    const message: ServerMessage = { type: "room", room: detail(room) }
    for (const member of room.members) member.send(message)
  }

  // the room a player is in, to that player alone
  function show(connection: Connection): void {
    if (connection.room) connection.send({ type: "room", room: detail(connection.room) })
  }

  // a player's own board in their room's game
  function sendOwn(connection: Connection): void {
    const game = connection.room?.game
    const own = game && ownGame(game, connection.player.id, Date.now())
    if (own) connection.send({ type: "game", game: own })
  }

  // the board of the player someone is watching
  function sendWatched(connection: Connection): void {
    const game = connection.room?.game
    const board = game && connection.watching !== null && watchedBoard(game, connection.watching, Date.now())
    if (board) connection.send({ type: "watching", playerId: connection.watching!, board })
  }

  // a player's board has changed: whoever is watching it sees that too
  function sendToWatchers(room: Room, playerId: string): void {
    for (const member of room.members) {
      if (member.watching === playerId) sendWatched(member)
    }
  }

  // --- The game in a room -----------------------------------------------------------------------------------------

  // A room's game is over, because nobody is playing it any more
  function finish(room: Room, game: Game<RoomModeId>): void {
    game.over = true
    if (room.deadlineTimer) clearTimeout(room.deadlineTimer)
    room.deadlineTimer = null
    // anyone it was ended for sees how their own game came out
    for (const member of room.members) sendOwn(member)

    inBackground(modes[game.mode].finished(game, Date.now()).then(() => {
      // the results everyone is looking at can now say how far each rating moved
      if (rooms.get(room.id) === room && room.game === game) tell(room)
    }))
  }

  // Moves a room's game along after anything that changes who is still playing it: starts the clock on the players
  // still going once enough of the others have finished, and ends the game once nobody is playing.
  // Returns whether the game ended just now. Telling the room is left to whoever called
  function advance(room: Room): boolean {
    const game = room.game
    if (!game || game.over) return false
    if (stillPlaying(game) === 0) {
      finish(room, game)
      return true
    }
    if (timeLimitDue(game)) {
      const allowed = finishTimeMs(game.settings)
      game.deadline = Date.now() + allowed
      room.deadlineTimer = setTimeout(() => {
        // the room, or this game in it, may be gone by now
        if (rooms.get(room.id) !== room || room.game !== game || game.over) return
        stopEveryone(game, Date.now())
        finish(room, game)
        tell(room)
        announce()
      }, allowed)
    }
    return false
  }

  // --- Coming and going -------------------------------------------------------------------------------------------

  // A new room, with nobody in it yet (see enter). Or what was wrong with what was asked for
  function create(host: Connection, name: string, visibility: RoomVisibility, passcode?: string): Room | string {
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > ROOM_NAME_MAX) return `Room names are 1-${ROOM_NAME_MAX} characters`
    const isPrivate = visibility === "private"
    if (isPrivate && (passcode === undefined || passcode.length < PASSCODE_MIN || passcode.length > PASSCODE_MAX)) {
      return `Passcodes are ${PASSCODE_MIN}-${PASSCODE_MAX} characters`
    }

    return {
      id: randomBytes(6).toString("base64url"),
      name: trimmed,
      visibility,
      passcode: isPrivate ? passcode! : null,
      host,
      members: [],
      mode: DEFAULT_ROOM_MODE,
      settings: DEFAULT_BOARD_SETTINGS,
      game: null,
      roster: [],
      deadlineTimer: null,
      chat: newChatLog(),
      kicked: new Set(),
    }
  }

  // The room a player asked to join, if they may. Or why they may not
  function admit(connection: Connection, roomId: string, passcode?: string): Room | string {
    const room = rooms.get(roomId)
    if (!room) return "That room is gone"
    // already in it: nothing to check
    if (connection.room === room) return room
    if (room.kicked.has(connection.player.id)) return "The host removed you from that room"
    if (inGame(room)) return "That room is in the middle of a game"
    if (room.passcode !== null && !(passcode !== undefined && sameText(passcode, room.passcode))) return "Wrong passcode"
    return room
  }

  // Puts a player in a room. They must not be in one (see leave), nor in a game of their own
  function enter(connection: Connection, room: Room): void {
    rooms.set(room.id, room)
    room.members.push(connection)
    connection.room = room
    tell(room)
    // what was said before they arrived
    connection.send({ type: "chatHistory", messages: room.chat.messages })
    announce()
  }

  function leave(connection: Connection): void {
    const room = connection.room
    if (!room) return
    connection.room = null
    connection.watching = null
    room.members = room.members.filter(member => member !== connection)
    // walking out of a game that is still being played is one way of not finishing it
    if (inGame(room)) leaveGame(room.game!, connection.player.id, Date.now())
    connection.send({ type: "room", room: null })
    // their board in the room's game went with the room
    if (room.game?.players.has(connection.player.id)) connection.send({ type: "game", game: null })

    if (room.members.length === 0) {
      // a game nobody is left in is over
      if (inGame(room)) finish(room, room.game!)
      rooms.delete(room.id)
    } else {
      // the longest-standing member takes over a room its host has left
      if (room.host === connection) room.host = room.members[0]
      // they may have been the last one still playing, or the one the others were waiting for
      advance(room)
      tell(room)
    }
    announce()
  }

  // --- What the host can do ---------------------------------------------------------------------------------------

  function makeHost(connection: Connection, playerId: string): void {
    const room = connection.room
    if (!room || !isHost(connection)) return
    const next = room.members.find(member => member.player.id === playerId)
    if (!next || next === connection) return
    room.host = next
    tell(room)
    // the list of rooms names each room's host
    announce()
  }

  function kick(connection: Connection, playerId: string): void {
    const room = connection.room
    if (!room || !isHost(connection)) return
    const removed = room.members.find(member => member.player.id === playerId)
    if (!removed || removed === connection) return
    room.kicked.add(removed.player.id)
    // takes them out of the room, and out of its game if one is on
    leave(removed)
    removed.send({ type: "kicked", roomName: room.name })
  }

  function setMode(connection: Connection, mode: RoomModeId): void {
    const room = connection.room
    if (!room || !isHost(connection) || inGame(room)) return
    room.mode = mode
    tell(room)
  }

  // Returns what was wrong with the board asked for, if anything was
  function setSettings(connection: Connection, asked: unknown): string | null {
    const room = connection.room
    if (!room || !isHost(connection) || inGame(room)) return null
    const settings = boardSettingsFrom(asked)
    if (!settings) return "That board isn't possible"
    room.settings = settings
    tell(room)
    return null
  }

  function startGame(connection: Connection): void {
    const room = connection.room
    // a game that is over makes way for the next one
    if (!room || !isHost(connection) || inGame(room)) return
    room.roster = room.members.map(member => member.player)
    room.game = modes[room.mode].start(room.settings, room.roster, Date.now(), room)
    // whatever anyone was watching was in the last game
    for (const member of room.members) member.watching = null
    // a board so small that the opening cleared it is over before it began
    advance(room)
    tell(room)
    for (const member of room.members) sendOwn(member)
    announce()
  }

  function endGame(connection: Connection): void {
    const room = connection.room
    if (!room || !isHost(connection) || !inGame(room)) return
    stopEveryone(room.game!, Date.now())
    finish(room, room.game!)
    tell(room)
    announce()
  }

  // --- What anyone in a room can do ---------------------------------------------------------------------------------

  // stops playing the room's game without clearing the board
  function stop(connection: Connection): void {
    const room = connection.room
    if (!room?.game || !giveUp(room.game, connection.player.id, Date.now())) return
    sendOwn(connection)
    const ended = advance(room)
    tell(room)
    if (ended) announce()
  }

  // Starts watching another player's board in the room's game, or stops (null)
  function spectate(connection: Connection, playerId: string | null): void {
    const game = connection.room?.game
    if (!game) return
    if (playerId === null) {
      connection.watching = null
      return
    }
    // Everyone plays the same board, so another player's would show where it is safe:
    // watching is only for someone whose own game is over (or who wasn't in it)
    if (!game.players.has(playerId) || isPlaying(game, connection.player.id)) return
    connection.watching = playerId
    sendWatched(connection)
  }

  function chat(connection: Connection, text: string): void {
    const room = connection.room
    const said: ChatMessage | null = room && say(room.chat, connection, text, Date.now())
    if (!room || !said) return
    for (const member of room.members) member.send({ type: "chat", message: said })
  }

  // A player has clicked a cell in their room's game, which left them standing as `outcome`
  function moved(connection: Connection, outcome: PlayerOutcome): void {
    const room = connection.room
    const game = room?.game
    if (!room || !game) return
    sendOwn(connection)
    if (outcome === "cleared") inBackground(modes[game.mode].cleared(game, connection.player.id, Date.now()))
    // clearing the board may start the clock on the others, or end the game
    const ended = advance(room)
    // everyone in the room sees the progress
    tell(room)
    sendToWatchers(room, connection.player.id)
    if (ended) announce()
  }

  // A player has flagged a cell. Flags are a player's own notes: only they, and anyone watching their board, see them
  function flagged(connection: Connection): void {
    sendOwn(connection)
    if (connection.room) sendToWatchers(connection.room, connection.player.id)
  }

  return { list, show, create, admit, enter, leave, makeHost, kick, setMode, setSettings, startGame, endGame, stop, spectate, chat, moved, flagged }
}

export type Rooms = ReturnType<typeof createRooms>

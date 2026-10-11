import { flag, noteDropped, reveal, type Game } from "../../../shared/game/game.js"
import { CLOSE_BANNED, CLOSE_REPLACED, type ClientMessage, type Player, type RoomSummary } from "../../../shared/protocol.js"
import { inBackground } from "../background.js"
import { createModes, type ModeServices } from "../modes/index.js"
import { newChatLog, say } from "./chat.js"
import { parseMessage } from "./messages.js"
import { allowMove, newMoveLimiter } from "./moveLimiter.js"
import { createRooms } from "./rooms.js"
import { createSoloPlay } from "./solo.js"
import type { Connection, Room, Transport } from "./types.js"

// The lobby: everyone who is connected, and what each of them is doing. It takes what players ask for, one message
// at a time, and has the rooms (rooms.ts) or the games played alone (solo.ts) deal with it.
//
// It is made, not imported, so that it can be made more than once: the server makes the one everybody plays in,
// and the tests make one each, with a ledger that keeps things in memory.

type Handlers = { [Type in ClientMessage["type"]]: (connection: Connection, message: Extract<ClientMessage, { type: Type }>) => void }

export function createLobby(services: ModeServices) {
  // by account id
  const connections = new Map<string, Connection>()
  const isLive = (connection: Connection): boolean => connections.get(connection.player.id) === connection

  const modes = createModes(services)
  const rooms = createRooms(modes.room, () => connections.values())
  const solo = createSoloPlay(modes.solo, isLive)
  // the chat everyone shares
  const globalChat = newChatLog()

  const fail = (connection: Connection, action: ClientMessage["type"], message: string): void =>
    connection.send({ type: "error", action, message })

  // The game a player is in, if any: their room's, or one they are playing alone
  const gameOf = (connection: Connection): Game | null => connection.room?.game ?? connection.solo?.game ?? null

  // Moves a player into a room: out of whichever one they were in (a player is only ever in one), and out of
  // whatever they were playing alone, which is given up
  function moveInto(connection: Connection, room: Room): void {
    rooms.leave(connection)
    solo.end(connection)
    rooms.enter(connection, room)
  }

  const handlers: Handlers = {
    createRoom(connection, { name, visibility, passcode }) {
      const room = rooms.create(connection, name, visibility, passcode)
      if (typeof room === "string") return fail(connection, "createRoom", room)
      moveInto(connection, room)
    },

    joinRoom(connection, { roomId, passcode }) {
      const room = rooms.admit(connection, roomId, passcode)
      if (typeof room === "string") return fail(connection, "joinRoom", room)
      // already in it: nothing changes, but they are told where they stand
      if (connection.room === room) return rooms.show(connection)
      moveInto(connection, room)
    },

    leaveRoom: connection => rooms.leave(connection),
    chat: (connection, { text }) => rooms.chat(connection, text),

    globalChat(connection, { text }) {
      const said = say(globalChat, connection, text, Date.now())
      if (!said) return
      for (const everyone of connections.values()) everyone.send({ type: "globalChat", message: said })
    },

    makeHost: (connection, { playerId }) => rooms.makeHost(connection, playerId),
    kick: (connection, { playerId }) => rooms.kick(connection, playerId),
    setMode: (connection, { mode }) => rooms.setMode(connection, mode),

    setSettings(connection, { settings }) {
      const problem = rooms.setSettings(connection, settings)
      if (problem) fail(connection, "setSettings", problem)
    },

    startGame: connection => rooms.startGame(connection),
    endGame: connection => rooms.endGame(connection),
    giveUp: connection => rooms.stop(connection),
    spectate: (connection, { playerId }) => rooms.spectate(connection, playerId),

    startSolo(connection, { mode, settings, opening }) {
      // the click that starts a game is a click like any other, and held to the same rate
      if (!allowMove(connection.moves, Date.now())) return
      inBackground(solo.start(connection, mode, { settings, opening }).catch((error) => {
        fail(connection, "startSolo", "That game couldn't be started")
        throw error
      }), "start a game")
    },

    endSolo: connection => solo.end(connection),

    reveal(connection, { row, col }) {
      const game = gameOf(connection)
      const now = Date.now()
      if (!game) return
      if (!allowMove(connection.moves, now)) return noteDropped(game, connection.player.id)
      const outcome = reveal(game, connection.player.id, row, col, now)
      if (outcome === null) return
      if (connection.room) rooms.moved(connection, outcome)
      else solo.moved(connection, outcome)
    },

    flag(connection, { row, col }) {
      const game = gameOf(connection)
      const now = Date.now()
      if (!game) return
      if (!allowMove(connection.moves, now)) return noteDropped(game, connection.player.id)
      if (!flag(game, connection.player.id, row, col, now)) return
      if (connection.room) rooms.flagged(connection)
      else solo.moved(connection, "playing")
    },
  }

  // An account has one live connection: connecting again (another tab, another device) takes over from the old one
  function connect(player: Player, transport: Transport): Connection {
    const previous = connections.get(player.id)
    if (previous) {
      disconnect(previous)
      previous.close(CLOSE_REPLACED, "Opened somewhere else")
    }

    const connection: Connection = { ...transport, player, room: null, solo: null, watching: null, lastChatAt: 0, moves: newMoveLimiter(Date.now()) }
    connections.set(player.id, connection)
    connection.send({ type: "rooms", rooms: rooms.list() })
    connection.send({ type: "globalChatHistory", messages: globalChat.messages })
    return connection
  }

  function disconnect(connection: Connection): void {
    // already taken over by a newer connection of the same account
    if (!isLive(connection)) return
    rooms.leave(connection)
    solo.end(connection)
    connections.delete(connection.player.id)
  }

  // Cuts an account off at once, wherever it is: for one that has just been banned
  function dropPlayer(playerId: string): void {
    const connection = connections.get(playerId)
    if (!connection) return
    disconnect(connection)
    connection.close(CLOSE_BANNED, "Banned")
  }

  // What a player's browser sent. Anything that isn't a message is thrown away (see messages.ts)
  function handleMessage(connection: Connection, raw: string): void {
    const message = parseMessage(raw)
    // the handler for a kind of message takes that kind of message, which is what the table's type says
    if (message) (handlers[message.type] as (connection: Connection, message: ClientMessage) => void)(connection, message)
  }

  return {
    connect,
    disconnect,
    dropPlayer,
    handleMessage,
    // every room there is, as the list of rooms shows them
    openRooms: (): RoomSummary[] => rooms.list(),
  }
}

export type Lobby = ReturnType<typeof createLobby>

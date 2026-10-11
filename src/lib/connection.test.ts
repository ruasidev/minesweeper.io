import { describe, expect, it } from "vitest"
import type { ChatMessage, GameSummary, OwnGame, RoomDetail, ServerMessage } from "../../shared/protocol"
import { DISCONNECTED, asked, dropped, ownGameIn, receive, type ConnectionState } from "./connection"

const NOW = 1_000_000
const CONNECTED: ConnectionState = { ...DISCONNECTED, status: "connected" }

const ownGame = (changes: Partial<OwnGame> = {}): OwnGame => ({
  id: 7, mode: "classic", settings: { rows: 2, cols: 2, mines: 1 }, opening: { row: 0, col: 0 }, elapsedMs: 5000, cells: "1...", cooldownMs: 0,
  outcome: "playing", durationMs: null, mineHits: 0, percent: 33, layout: null, ...changes,
})

const summary = (changes: Partial<GameSummary> = {}): GameSummary => ({
  id: 3, mode: "race", settings: { rows: 9, cols: 9, mines: 10 }, rated: true, players: [], over: false, timeLeftMs: null,
  sectionRows: 5, sectionCols: 5, opening: { row: 4, col: 4 }, elapsedMs: -3000, progress: {}, ...changes,
})

const room = (game: GameSummary | null = null): RoomDetail => ({
  id: "r1", name: "Room", visibility: "public", hostId: "ann", players: [], mode: "race", settings: { rows: 9, cols: 9, mines: 10 }, game,
})

const said = (id: number, text: string): ChatMessage => ({ id, playerId: "ann", username: "ann", text, sentAt: NOW })

// the state after each of these arrives, one after another, each a second after the last
const after = (state: ConnectionState, ...messages: ServerMessage[]): ConnectionState =>
  messages.reduce((now, message, at) => receive(now, message, NOW + at * 1000), state)

describe("the player's own game", () => {
  it("has its clock worked out once, from the first word of it", () => {
    const first = after(CONNECTED, { type: "game", game: ownGame({ elapsedMs: 5000 }) })
    expect(first.game!.startedAt).toBe(NOW - 5000)
    // a later message that says a slightly different time doesn't move the clock
    const later = receive(first, { type: "game", game: ownGame({ elapsedMs: 9999, cells: "11.." }) }, NOW + 4000)
    expect(later.game!.startedAt).toBe(NOW - 5000)
    expect(later.game!.cells).toBe("11..")
  })

  it("starts the clock afresh for another game", () => {
    const state = after(CONNECTED, { type: "game", game: ownGame() }, { type: "game", game: ownGame({ id: 8, elapsedMs: 0 }) })
    expect(state.game).toMatchObject({ id: 8, startedAt: NOW + 1000 })
  })

  it("starts in the future while a dealt board is counting down", () => {
    const state = after(CONNECTED, { type: "game", game: ownGame({ mode: "daily", elapsedMs: -3000 }) })
    expect(state.game!.startedAt).toBe(NOW + 3000)
  })

  it("says until when the player sits out after a mine", () => {
    const state = after(CONNECTED, { type: "game", game: ownGame({ cooldownMs: 800 }) })
    expect(state.game!.cooldownUntil).toBe(NOW + 800)
  })

  it("goes when the server says there isn't one", () => {
    expect(after(CONNECTED, { type: "game", game: ownGame() }, { type: "game", game: null }).game).toBeNull()
  })

  it("is each page's own kind of game", () => {
    const classic = after(CONNECTED, { type: "game", game: ownGame() })
    expect(ownGameIn(classic, "singleplayer")?.id).toBe(7)
    expect(ownGameIn(classic, "daily")).toBeNull()
    expect(ownGameIn(classic, "multiplayer")).toBeNull()
    expect(ownGameIn(CONNECTED, "singleplayer")).toBeNull()
  })
})

describe("the room", () => {
  it("keeps the times of its game steady from message to message", () => {
    const started = after(CONNECTED, { type: "room", room: room(summary({ elapsedMs: -3000 })) })
    expect(started.gameStartedAt).toBe(NOW + 3000)
    expect(started.gameDeadlineAt).toBeNull()

    const going = receive(started, { type: "room", room: room(summary({ elapsedMs: 20_000, timeLeftMs: 54_000 })) }, NOW + 23_500)
    expect(going.gameStartedAt).toBe(NOW + 3000)
    expect(going.gameDeadlineAt).toBe(NOW + 23_500 + 54_000)
    // ...and the deadline, once set, stays where it was put
    const later = receive(going, { type: "room", room: room(summary({ elapsedMs: 30_000, timeLeftMs: 44_500 })) }, NOW + 33_000)
    expect(later.gameDeadlineAt).toBe(NOW + 23_500 + 54_000)
  })

  it("starts the times afresh when one game follows another, and stops watching the last one", () => {
    const first = after(CONNECTED,
      { type: "room", room: room(summary()) },
      { type: "watching", playerId: "bob", board: { cells: "....", cooldownMs: 0 } })
    expect(first.watching?.playerId).toBe("bob")
    const next = receive(first, { type: "room", room: room(summary({ id: 4, elapsedMs: -3000 })) }, NOW + 90_000)
    expect(next.gameStartedAt).toBe(NOW + 93_000)
    expect(next.watching).toBeNull()
  })

  it("has no times while it has no game", () => {
    const state = after(CONNECTED, { type: "room", room: room(summary()) }, { type: "room", room: room(null) })
    expect([state.gameStartedAt, state.gameDeadlineAt]).toEqual([null, null])
  })

  it("takes its chat and the player's board in its game with it when they leave", () => {
    const inRoom = after(CONNECTED,
      { type: "room", room: room(summary()) },
      { type: "chatHistory", messages: [said(1, "hi")] },
      { type: "chat", message: said(2, "there") },
      { type: "game", game: ownGame({ mode: "race" }) })
    expect(inRoom.chat.map(message => message.text)).toEqual(["hi", "there"])
    const left = receive(inRoom, { type: "room", room: null }, NOW)
    expect(left).toMatchObject({ room: null, chat: [], game: null, gameStartedAt: null })
  })

  it("leaves a game being played alone as it is when there is no room", () => {
    const state = after(CONNECTED, { type: "game", game: ownGame() }, { type: "room", room: null })
    expect(state.game?.id).toBe(7)
  })

  it("says when the board being watched frees its player", () => {
    const state = after(CONNECTED, { type: "watching", playerId: "bob", board: { cells: "*...", cooldownMs: 800 } })
    expect(state.watching).toEqual({ playerId: "bob", cells: "*...", cooldownUntil: NOW + 800 })
  })
})

describe("everything else the server says", () => {
  it("is kept as it comes", () => {
    const rooms = [{ id: "r1", name: "Room", visibility: "public" as const, hostUsername: "ann", playerCount: 1, inGame: false }]
    const state = after(CONNECTED,
      { type: "rooms", rooms },
      { type: "globalChatHistory", messages: [said(1, "hello")] },
      { type: "globalChat", message: said(2, "all") },
      { type: "kicked", roomName: "Friday" },
      { type: "error", action: "joinRoom", message: "Wrong passcode" })
    expect(state.rooms).toEqual(rooms)
    expect(state.globalChat.map(message => message.text)).toEqual(["hello", "all"])
    expect(state.notice).toBe('The host removed you from "Friday".')
    expect(state.error).toEqual({ action: "joinRoom", message: "Wrong passcode" })
  })

  it("never changes the state it was given", () => {
    const before = after(CONNECTED, { type: "globalChat", message: said(1, "one") })
    const copy = structuredClone(before)
    after(before, { type: "globalChat", message: said(2, "two") }, { type: "game", game: ownGame() }, { type: "room", room: room(summary()) })
    expect(before).toEqual(copy)
  })
})

describe("asked", () => {
  const troubled: ConnectionState = { ...CONNECTED, error: { action: "joinRoom", message: "Wrong passcode" }, notice: "The host removed you." }

  it("puts the last thing that went wrong behind the player", () => {
    expect(asked(troubled, { type: "leaveRoom" })).toMatchObject({ error: null, notice: "The host removed you." })
  })

  it("puts the notice behind them too once they go on to another room", () => {
    expect(asked(troubled, { type: "joinRoom", roomId: "r2" }).notice).toBeNull()
    expect(asked(troubled, { type: "createRoom", name: "Mine", visibility: "public" }).notice).toBeNull()
  })

  it("stops watching at once when asked to", () => {
    const watching: ConnectionState = { ...CONNECTED, watching: { playerId: "bob", cells: "....", cooldownUntil: 0 } }
    expect(asked(watching, { type: "spectate", playerId: null }).watching).toBeNull()
    expect(asked(watching, { type: "spectate", playerId: "cat" }).watching?.playerId).toBe("bob")
  })

  it("gives the same state back when there was nothing to change, so nothing redraws for it", () => {
    expect(asked(CONNECTED, { type: "reveal", row: 1, col: 1 })).toBe(CONNECTED)
  })
})

describe("dropped", () => {
  it("takes the player out of everything on the server, and keeps what they have yet to read", () => {
    const busy = after(CONNECTED,
      { type: "rooms", rooms: [{ id: "r1", name: "Room", visibility: "public", hostUsername: "ann", playerCount: 1, inGame: false }] },
      { type: "room", room: room(summary()) },
      { type: "game", game: ownGame({ mode: "race" }) },
      { type: "chat", message: said(1, "in the room") },
      { type: "globalChat", message: said(2, "to everyone") },
      { type: "kicked", roomName: "Friday" })
    const state = dropped(busy, "connecting")
    expect(state).toMatchObject({ status: "connecting", rooms: [], room: null, game: null, chat: [], watching: null, gameStartedAt: null })
    expect(state.globalChat.map(message => message.text)).toEqual(["to everyone"])
    expect(state.notice).toBe('The host removed you from "Friday".')
  })

  it("says why, when the page can't simply try again", () => {
    expect(dropped(CONNECTED, "replaced").status).toBe("replaced")
    expect(dropped(CONNECTED, "outdated").status).toBe("outdated")
  })
})

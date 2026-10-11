import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cellAt, layoutText, type Field } from "../../../shared/engine/field.js"
import { CELL_FLAGGED, CELL_HIDDEN, CELL_MINE } from "../../../shared/engine/view.js"
import { BEGINNER_BOARD, BOARD_PRESETS, DAILY_BOARD_SETTINGS, DEFAULT_BOARD_SETTINGS } from "../../../shared/game/boards.js"
import { MINE_COOLDOWN_MS, START_COUNTDOWN_MS, finishTimeMs } from "../../../shared/game/modes.js"
import { CLOSE_BANNED, CLOSE_REPLACED } from "../../../shared/protocol.js"
import { DAILY_SEED, FRESH_SEED, cellsWhere, clearBoard, fieldFor, testLobby, type TestPlayer } from "../testing/players.js"

// The lobby is driven the way a browser drives it: by the messages it is sent. What a player knows is what they
// were sent back. The tests know one thing more, the seed every board is made from, which is how they find the mines

const NOON = Date.UTC(2026, 0, 15, 12)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOON)
})
afterEach(() => {
  vi.useRealTimers()
})

// lets everything that was waiting on something else (a game being made, a result being kept) go ahead
const settle = () => vi.advanceTimersByTimeAsync(0)
const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms)

// Clears a board the way a quick player would, a click every so often: every patch of empty cells first, then the
// numbers left over. That is the fewest clicks a board can be cleared in, and slow enough that none is thrown away
async function playThrough(player: TestPlayer, field: Field, everyMs = 100): Promise<void> {
  for (const emptyOnly of [true, false]) {
    for (const { row, col } of cellsWhere(field, false)) {
      const at = cellAt(field.cols, row, col)
      if (player.game?.cells[at] !== CELL_HIDDEN || (emptyOnly && field.counts[at] !== 0)) continue
      player.say({ type: "reveal", row, col })
      await wait(everyMs)
    }
  }
}

// a public room with these players in it, the first of them its host
function roomWith(join: (id: string) => TestPlayer, ...ids: string[]): TestPlayer[] {
  const players = ids.map(join)
  players[0].say({ type: "createRoom", name: "Test room", visibility: "public" })
  const roomId = players[0].room!.id
  for (const player of players.slice(1)) player.say({ type: "joinRoom", roomId })
  return players
}

// ...and the same with a game of Beginner under way in it, past its countdown
async function raceWith(join: (id: string) => TestPlayer, ...ids: string[]) {
  const players = roomWith(join, ...ids)
  players[0].say({ type: "setSettings", settings: BEGINNER_BOARD })
  players[0].say({ type: "startGame" })
  await wait(START_COUNTDOWN_MS)
  return { players, ...fieldFor("race", BEGINNER_BOARD, FRESH_SEED) }
}

describe("connecting", () => {
  it("tells a player what rooms there are and what has been said", () => {
    const { join } = testLobby()
    const ann = join("ann")
    expect(ann.sent.map(message => message.type)).toEqual(["rooms", "globalChatHistory"])
    expect(ann.last("rooms")!.rooms).toEqual([])
  })

  it("lets an account be in one place: connecting again takes over from the first", () => {
    const { join, lobby } = testLobby()
    const first = join("ann")
    first.say({ type: "createRoom", name: "Mine", visibility: "public" })
    const second = join("ann")
    expect(first.closed).toEqual([{ code: CLOSE_REPLACED, reason: "Opened somewhere else" }])
    // the room went with the connection that was in it
    expect(lobby.openRooms()).toEqual([])
    // the socket of the old one closing afterwards changes nothing for the new one
    first.leave()
    second.say({ type: "createRoom", name: "Mine again", visibility: "public" })
    expect(lobby.openRooms()).toHaveLength(1)
  })

  it("cuts off an account that has been banned, wherever it is", () => {
    const { join, lobby } = testLobby()
    const [ann, bob] = roomWith(join, "ann", "bob")
    lobby.dropPlayer("bob")
    expect(bob.closed).toEqual([{ code: CLOSE_BANNED, reason: "Banned" }])
    expect(ann.room!.players.map(player => player.id)).toEqual(["ann"])
    lobby.dropPlayer("nobody")
  })

  it("ignores what isn't a message", () => {
    const { join } = testLobby()
    const ann = join("ann")
    ann.forget()
    for (const raw of ["", "{", "null", "{\"type\":\"nonsense\"}", "{\"type\":\"reveal\",\"row\":\"1\",\"col\":1}"]) ann.sayRaw(raw)
    expect(ann.sent).toEqual([])
  })
})

describe("rooms", () => {
  it("are made by a player, who becomes the host and the first one in", () => {
    const { join } = testLobby()
    const ann = join("ann")
    const bob = join("bob")
    ann.say({ type: "createRoom", name: "  Friday night  ", visibility: "public" })
    expect(ann.room).toMatchObject({ name: "Friday night", visibility: "public", hostId: "ann", mode: "race", settings: DEFAULT_BOARD_SETTINGS, game: null })
    expect(ann.room!.players.map(player => player.id)).toEqual(["ann"])
    // everyone connected sees it in the list
    expect(bob.last("rooms")!.rooms).toEqual([{ id: ann.room!.id, name: "Friday night", visibility: "public", hostUsername: "Ann", playerCount: 1, inGame: false }])
  })

  it("turn down a name or a passcode that won't do, and say why", () => {
    const { join, lobby } = testLobby()
    const ann = join("ann")
    ann.say({ type: "createRoom", name: "   ", visibility: "public" })
    expect(ann.error).toMatch(/Room names/)
    ann.say({ type: "createRoom", name: "x".repeat(41), visibility: "public" })
    expect(ann.error).toMatch(/Room names/)
    ann.say({ type: "createRoom", name: "Secret", visibility: "private" })
    expect(ann.error).toMatch(/Passcodes/)
    ann.say({ type: "createRoom", name: "Secret", visibility: "private", passcode: "abc" })
    expect(ann.error).toMatch(/Passcodes/)
    expect(lobby.openRooms()).toEqual([])
  })

  it("never tell anyone a private room's passcode, and ask for it at the door", () => {
    const { join } = testLobby()
    const ann = join("ann")
    const bob = join("bob")
    ann.say({ type: "createRoom", name: "Secret", visibility: "private", passcode: "open sesame" })
    expect(JSON.stringify([...ann.sent, ...bob.sent])).not.toContain("open sesame")

    const roomId = ann.room!.id
    bob.say({ type: "joinRoom", roomId })
    expect(bob.error).toBe("Wrong passcode")
    bob.say({ type: "joinRoom", roomId, passcode: "open sesam" })
    expect(bob.error).toBe("Wrong passcode")
    expect(bob.room).toBeNull()
    bob.say({ type: "joinRoom", roomId, passcode: "open sesame" })
    expect(bob.room!.players.map(player => player.id)).toEqual(["ann", "bob"])
  })

  it("show a player joining what was said before they arrived", () => {
    const { join } = testLobby()
    const ann = join("ann")
    ann.say({ type: "createRoom", name: "Chatty", visibility: "public" })
    ann.say({ type: "chat", text: "anyone there?" })
    const bob = join("bob")
    bob.say({ type: "joinRoom", roomId: ann.room!.id })
    expect(bob.last("chatHistory")!.messages.map(message => message.text)).toEqual(["anyone there?"])
  })

  it("say so when the room asked for is gone", () => {
    const { join } = testLobby()
    const ann = join("ann")
    ann.say({ type: "joinRoom", roomId: "nowhere" })
    expect(ann.error).toBe("That room is gone")
  })

  it("tell a player where they stand when they ask to join the room they are in", () => {
    const { join } = testLobby()
    const [ann, bob] = roomWith(join, "ann", "bob")
    bob.forget()
    bob.say({ type: "joinRoom", roomId: ann.room!.id })
    expect(bob.sent.map(message => message.type)).toEqual(["room"])
    expect(bob.room!.players).toHaveLength(2)
  })

  it("hold a player in one room at a time", () => {
    const { join, lobby } = testLobby()
    const ann = join("ann")
    ann.say({ type: "createRoom", name: "First", visibility: "public" })
    ann.say({ type: "createRoom", name: "Second", visibility: "public" })
    // the first emptied, so it is gone
    expect(lobby.openRooms().map(room => room.name)).toEqual(["Second"])
  })

  it("pass to the longest-standing member when the host leaves, and close when the last one does", () => {
    const { join, lobby } = testLobby()
    const [ann, bob, cat] = roomWith(join, "ann", "bob", "cat")
    ann.say({ type: "leaveRoom" })
    expect(ann.room).toBeNull()
    expect(bob.room).toMatchObject({ hostId: "bob" })
    expect(cat.room!.players.map(player => player.id)).toEqual(["bob", "cat"])
    bob.leave()
    cat.say({ type: "leaveRoom" })
    expect(lobby.openRooms()).toEqual([])
  })

  it("keep what is said in a room to the room, and what is said to everyone to everyone", () => {
    const { join } = testLobby()
    const [ann, bob] = roomWith(join, "ann", "bob")
    const cat = join("cat")
    ann.say({ type: "chat", text: "just us" })
    expect(bob.last("chat")!.message).toMatchObject({ playerId: "ann", text: "just us" })
    expect(cat.last("chat")).toBeUndefined()

    vi.advanceTimersByTime(1000)
    cat.say({ type: "globalChat", text: "hello all" })
    for (const player of [ann, bob, cat]) expect(player.last("globalChat")!.message.text).toBe("hello all")
    // someone arriving later sees it too
    expect(join("dan").last("globalChatHistory")!.messages.map(message => message.text)).toEqual(["hello all"])
  })
})

describe("the host", () => {
  it("can hand the room to someone else in it", () => {
    const { join } = testLobby()
    const [ann, bob] = roomWith(join, "ann", "bob")
    bob.say({ type: "makeHost", playerId: "ann" })
    expect(ann.room!.hostId).toBe("ann")
    ann.say({ type: "makeHost", playerId: "nobody" })
    ann.say({ type: "makeHost", playerId: "bob" })
    expect(bob.room!.hostId).toBe("bob")
  })

  it("can remove a player, who can't come back", () => {
    const { join } = testLobby()
    const [ann, bob] = roomWith(join, "ann", "bob")
    const roomId = ann.room!.id
    bob.say({ type: "kick", playerId: "ann" })
    expect(ann.room).not.toBeNull()

    ann.say({ type: "kick", playerId: "bob" })
    expect(bob.room).toBeNull()
    expect(bob.last("kicked")).toEqual({ type: "kicked", roomName: "Test room" })
    bob.say({ type: "joinRoom", roomId })
    expect(bob.error).toBe("The host removed you from that room")
    expect(ann.room!.players).toHaveLength(1)
  })

  it("chooses the board, as long as it is one that can be made", () => {
    const { join } = testLobby()
    const [ann, bob] = roomWith(join, "ann", "bob")
    bob.say({ type: "setSettings", settings: BEGINNER_BOARD })
    expect(ann.room!.settings).toEqual(DEFAULT_BOARD_SETTINGS)

    ann.say({ type: "setSettings", settings: BEGINNER_BOARD })
    expect(bob.room!.settings).toEqual(BEGINNER_BOARD)
    ann.say({ type: "setSettings", settings: { rows: 4, cols: 4, mines: 16 } })
    expect(ann.error).toBe("That board isn't possible")
    expect(bob.room!.settings).toEqual(BEGINNER_BOARD)
  })

  it("chooses the game", () => {
    const { join } = testLobby()
    const [ann, bob] = roomWith(join, "ann", "bob")
    ann.forget()
    bob.say({ type: "setMode", mode: "race" })
    expect(ann.sent).toEqual([])
    ann.say({ type: "setMode", mode: "race" })
    expect(bob.room!.mode).toBe("race")
  })
})

describe("a race", () => {
  it("is started by the host, for everyone in the room, on the same board", async () => {
    const { join, lobby, kept } = testLobby()
    const [ann, bob] = roomWith(join, "ann", "bob")
    bob.say({ type: "startGame" })
    expect(ann.room!.game).toBeNull()

    ann.say({ type: "startGame" })
    expect(ann.room!.game).toMatchObject({ mode: "race", settings: DEFAULT_BOARD_SETTINGS, rated: true, over: false, elapsedMs: -START_COUNTDOWN_MS })
    expect(ann.game).toMatchObject({ mode: "race", outcome: "playing", layout: null })
    expect(ann.game!.cells).toBe(bob.game!.cells)
    expect(lobby.openRooms()[0].inGame).toBe(true)
    await settle()
    expect([kept.gamesStartedBy("ann"), kept.gamesStartedBy("bob")]).toEqual([1, 1])
  })

  it("can't be joined, or have its board changed, while it is on", async () => {
    const { join } = testLobby()
    const { players: [ann] } = await raceWith(join, "ann", "bob")
    const cat = join("cat")
    cat.say({ type: "joinRoom", roomId: ann.room!.id })
    expect(cat.error).toBe("That room is in the middle of a game")
    ann.say({ type: "setSettings", settings: DEFAULT_BOARD_SETTINGS })
    expect(ann.room!.settings).toEqual(BEGINNER_BOARD)
    // ...nor a second game started on top of it
    const gameId = ann.room!.game!.id
    ann.say({ type: "startGame" })
    expect(ann.room!.game!.id).toBe(gameId)
  })

  it("doesn't let anyone play before the countdown is over", async () => {
    const { join } = testLobby()
    const [ann] = roomWith(join, "ann", "bob")
    ann.say({ type: "setSettings", settings: BEGINNER_BOARD })
    ann.say({ type: "startGame" })
    const { field } = fieldFor("race", BEGINNER_BOARD, FRESH_SEED)
    const before = ann.game!.cells
    const safe = cellsWhere(field, false).find(({ row, col }) => before[cellAt(9, row, col)] === CELL_HIDDEN)!
    ann.say({ type: "reveal", ...safe })
    expect(ann.game!.cells).toBe(before)
    await wait(START_COUNTDOWN_MS)
    ann.say({ type: "reveal", ...safe })
    expect(ann.game!.cells).not.toBe(before)
  })

  it("shows a move to the player who made it, and only their progress to everyone else", async () => {
    const { join } = testLobby()
    const { players: [ann, bob], field } = await raceWith(join, "ann", "bob")
    const before = bob.game!.cells
    bob.forget()
    const safe = cellsWhere(field, false).find(({ row, col }) => before[cellAt(9, row, col)] === CELL_HIDDEN)!
    ann.say({ type: "reveal", ...safe })

    expect(ann.game!.cells).not.toBe(before)
    // bob is told the room has changed, and nothing about ann's board
    expect(bob.sent.map(message => message.type)).toEqual(["room"])
    expect(JSON.stringify(bob.sent)).not.toContain(ann.game!.cells)
  })

  it("never sends anyone where the mines are, before, during or after", async () => {
    const { join } = testLobby()
    const { players: [ann, bob], field } = await raceWith(join, "ann", "bob")
    clearBoard(ann, field)
    bob.say({ type: "giveUp" })
    await settle()
    expect(ann.room!.game!.over).toBe(true)
    const everything = JSON.stringify([...ann.sent, ...bob.sent])
    expect(everything).not.toContain(layoutText(field.mines))
    expect([ann.game!.layout, bob.game!.layout]).toEqual([null, null])
  })

  it("sets a mine off without ending the player's game, and makes them sit out", async () => {
    const { join } = testLobby()
    const { players: [ann], field } = await raceWith(join, "ann", "bob")
    const [mine] = cellsWhere(field, true)
    ann.say({ type: "reveal", ...mine })
    expect(ann.game).toMatchObject({ outcome: "playing", mineHits: 1, cooldownMs: MINE_COOLDOWN_MS })
    expect(ann.game!.cells[cellAt(9, mine.row, mine.col)]).toBe(CELL_MINE)

    const cells = ann.game!.cells
    const safe = cellsWhere(field, false).find(({ row, col }) => cells[cellAt(9, row, col)] === CELL_HIDDEN)!
    ann.say({ type: "reveal", ...safe })
    expect(ann.game!.cells).toBe(cells)
    await wait(MINE_COOLDOWN_MS)
    ann.say({ type: "reveal", ...safe })
    expect(ann.game!.cells).not.toBe(cells)
  })

  it("lets a player watch another's board only once their own game is over", async () => {
    const { join } = testLobby()
    const { players: [ann, bob], field } = await raceWith(join, "ann", "bob", "cat")
    // everyone plays the same board, so watching while playing would be seeing where it is safe
    ann.say({ type: "spectate", playerId: "bob" })
    expect(ann.last("watching")).toBeUndefined()

    ann.say({ type: "giveUp" })
    expect(ann.game!.outcome).toBe("gaveUp")
    ann.say({ type: "spectate", playerId: "nobody" })
    expect(ann.last("watching")).toBeUndefined()
    ann.say({ type: "spectate", playerId: "bob" })
    expect(ann.last("watching")).toEqual({ type: "watching", playerId: "bob", board: { cells: bob.game!.cells, cooldownMs: 0 } })

    // bob's flags are his own notes: whoever is watching sees them, and nobody else is told
    const [mine] = cellsWhere(field, true)
    bob.say({ type: "flag", ...mine })
    expect(ann.last("watching")!.board.cells[cellAt(9, mine.row, mine.col)]).toBe(CELL_FLAGGED)
    expect(ann.last("watching")!.board.cells).toBe(bob.game!.cells)

    ann.forget()
    ann.say({ type: "spectate", playerId: null })
    bob.say({ type: "flag", ...mine })
    expect(ann.last("watching")).toBeUndefined()
  })

  it("puts the rest on the clock once half have cleared the board, and stops them when it runs out", async () => {
    const { join, kept } = testLobby()
    const { players: [ann, bob], field } = await raceWith(join, "ann", "bob")
    clearBoard(ann, field)
    expect(ann.game).toMatchObject({ outcome: "cleared", percent: 100 })
    expect(bob.room!.game).toMatchObject({ over: false, timeLeftMs: finishTimeMs(BEGINNER_BOARD) })
    await settle()
    // a board cleared is a time for the leaderboards straight away
    expect(kept.multiplayer).toMatchObject([{ userId: "ann", settings: BEGINNER_BOARD, hiddenReason: null }])

    await wait(finishTimeMs(BEGINNER_BOARD))
    expect(bob.game!.outcome).toBe("timedOut")
    expect(bob.room!.game).toMatchObject({ over: true, timeLeftMs: null })
    expect(bob.room!.game!.progress.ann.place).toBe(1)
    expect(bob.room!.game!.progress.bob.place).toBe(2)
  })

  it("keeps a record for everyone who played, and moves ratings in a public room", async () => {
    const { join, kept } = testLobby()
    const { players: [ann, bob], field } = await raceWith(join, "ann", "bob")
    await wait(2000)
    clearBoard(ann, field)
    bob.say({ type: "giveUp" })
    await settle()

    expect(kept.records.map(record => [record.playerId, record.mode, record.gameOutcome, record.place, record.players])).toEqual([
      ["ann", "race", "cleared", 1, 2],
      ["bob", "race", "gaveUp", 2, 2],
    ])
    expect(kept.records[0].key).toBe(kept.records[1].key)
    expect(kept.ratings.get("ann")).toBe(1016)
    expect(kept.ratings.get("bob")).toBe(984)
    // the results the room is looking at say so
    expect(ann.room!.game!.progress.ann.ratingChange).toBe(16)
    expect(bob.room!.game!.progress.bob.ratingChange).toBe(-16)
    expect(kept.xpOf("ann")).toBeGreaterThan(kept.xpOf("bob"))
  })

  it("doesn't move ratings in a private room", async () => {
    const { join, kept } = testLobby()
    const ann = join("ann")
    const bob = join("bob")
    ann.say({ type: "createRoom", name: "Friends", visibility: "private", passcode: "sesame" })
    bob.say({ type: "joinRoom", roomId: ann.room!.id, passcode: "sesame" })
    ann.say({ type: "setSettings", settings: BEGINNER_BOARD })
    ann.say({ type: "startGame" })
    expect(ann.room!.game!.rated).toBe(false)
    await wait(START_COUNTDOWN_MS)
    clearBoard(ann, fieldFor("race", BEGINNER_BOARD, FRESH_SEED).field)
    bob.say({ type: "giveUp" })
    await settle()
    expect(kept.ratings.size).toBe(0)
    expect(ann.room!.game!.progress.ann.ratingChange).toBeNull()
  })

  it("counts leaving as not finishing, and ends when the last player still going has gone", async () => {
    const { join, kept } = testLobby()
    const { players: [ann, bob] } = await raceWith(join, "ann", "bob")
    bob.say({ type: "leaveRoom" })
    expect(bob.game).toBeNull()
    expect(ann.room!.game).toMatchObject({ over: false })
    expect(ann.room!.game!.progress.bob.outcome).toBe("left")
    ann.say({ type: "giveUp" })
    await settle()
    expect(ann.room!.game!.over).toBe(true)
    expect(kept.records.map(record => record.gameOutcome).sort()).toEqual(["gaveUp", "left"])
  })

  it("can be stopped for everyone by the host", async () => {
    const { join } = testLobby()
    const { players: [ann, bob] } = await raceWith(join, "ann", "bob")
    bob.say({ type: "endGame" })
    expect(ann.room!.game!.over).toBe(false)
    ann.say({ type: "endGame" })
    expect(ann.room!.game!.over).toBe(true)
    expect([ann.game!.outcome, bob.game!.outcome]).toEqual(["timedOut", "timedOut"])
    // and the next one can be started
    ann.say({ type: "startGame" })
    expect(ann.room!.game!.over).toBe(false)
  })

  it("is over when everyone in the room leaves, with what they did still kept", async () => {
    const { join, kept, lobby } = testLobby()
    const { players: [ann, bob] } = await raceWith(join, "ann", "bob")
    ann.leave()
    bob.leave()
    await settle()
    expect(lobby.openRooms()).toEqual([])
    expect(kept.records).toHaveLength(2)
  })

  it("throws away moves that come faster than anyone can click, and holds them against the result", async () => {
    const { join, kept } = testLobby()
    const { players: [ann, bob], field } = await raceWith(join, "ann", "bob")
    const [mine] = cellsWhere(field, true)
    // a hundred flags in the same instant: a burst gets through and the rest don't
    for (let i = 0; i < 100; i++) ann.say({ type: "flag", ...mine })
    expect(ann.sent.filter(message => message.type === "game")).toHaveLength(1 + 30)

    await wait(60_000)
    clearBoard(ann, field)
    bob.say({ type: "giveUp" })
    await settle()
    expect(kept.multiplayer[0].hiddenReason).toMatch(/faster than a person can click/)
    expect(kept.records.find(record => record.playerId === "ann")!.suspectReason).toMatch(/faster than a person/)
    expect(kept.xpOf("ann")).toBe(0)
  })
})

describe("a game played alone", () => {
  const opening = { row: 4, col: 4 }
  // the game the singleplayer page plays unless the player has asked for the other one
  const solo = { type: "startSolo", mode: "noGuess", settings: BEGINNER_BOARD, opening } as const

  it("starts with the player's first click, on the board they asked for", async () => {
    const { join, kept } = testLobby()
    const ann = join("ann")
    ann.say(solo)
    await settle()
    expect(ann.game).toMatchObject({ mode: "noGuess", settings: BEGINNER_BOARD, opening, elapsedMs: 0, outcome: "playing", layout: null })
    expect(ann.game!.cells[cellAt(9, 4, 4)]).toBe("0")
    expect(kept.gamesStartedBy("ann")).toBe(1)
  })

  it("lays the board by chance alone for a player who asked for the classic game, and keeps which game it was", async () => {
    const { join, kept } = testLobby()
    const ann = join("ann")
    const expert = BOARD_PRESETS[2].settings
    const middle = { row: 8, col: 15 }
    ann.say({ type: "startSolo", mode: "classic", settings: expert, opening: middle })
    await settle()
    expect(ann.game).toMatchObject({ mode: "classic", settings: expert, opening: middle, outcome: "playing" })

    // The first board the seed gives, which on a board this size nearly always needs a guess: the other game
    // would have thrown it away for one that doesn't
    const { field } = fieldFor("classic", expert, FRESH_SEED, middle)
    expect(layoutText(field.mines)).not.toBe(layoutText(fieldFor("noGuess", expert, FRESH_SEED, middle).field.mines))
    await wait(4000)
    ann.say({ type: "reveal", ...cellsWhere(field, true)[0] })
    expect(ann.game).toMatchObject({ outcome: "lost", layout: layoutText(field.mines) })
    await settle()
    expect(kept.singleplayer).toMatchObject([{ userId: "ann", mode: "classic", won: false }])
    expect(kept.records).toMatchObject([{ playerId: "ann", mode: "classic", gameOutcome: "lost" }])
  })

  it("turns down a board that can't be made, or a click that isn't on it", async () => {
    const { join } = testLobby()
    const ann = join("ann")
    for (const request of [
      { ...solo, settings: { rows: 4, cols: 4, mines: 12 } },
      { ...solo, settings: undefined },
      { ...solo, opening: { row: 9, col: 0 } },
      { ...solo, opening: { row: 1.5, col: 0 } },
      { ...solo, opening: undefined },
    ]) {
      ann.forget()
      ann.say(request)
      await settle()
      expect(ann.error).toBe("That board isn't possible")
      expect(ann.game).toBeNull()
    }
  })

  it("ends at the first mine, and only then says where the rest were", async () => {
    const { join, kept } = testLobby()
    const ann = join("ann")
    ann.say(solo)
    await settle()
    const { field } = fieldFor("noGuess", BEGINNER_BOARD, FRESH_SEED, opening)
    expect(JSON.stringify(ann.sent)).not.toContain(layoutText(field.mines))

    await wait(4000)
    ann.say({ type: "reveal", ...cellsWhere(field, true)[0] })
    expect(ann.game).toMatchObject({ outcome: "lost", durationMs: 4000, mineHits: 1, layout: layoutText(field.mines) })
    await settle()
    expect(kept.singleplayer).toEqual([{ userId: "ann", mode: "noGuess", settings: BEGINNER_BOARD, won: false, durationMs: 4000, hiddenReason: null }])
    expect(kept.records).toMatchObject([{ playerId: "ann", mode: "noGuess", gameOutcome: "lost" }])
    expect(kept.xpOf("ann")).toBe(0)
    // nothing more can be done to it
    const cells = ann.game!.cells
    ann.say({ type: "reveal", ...cellsWhere(field, false)[0] })
    expect(ann.game!.cells).toBe(cells)
  })

  it("is won by clearing the board, which is worth experience", async () => {
    const { join, kept } = testLobby()
    const ann = join("ann")
    ann.say(solo)
    await settle()
    await wait(30_000)
    clearBoard(ann, fieldFor("noGuess", BEGINNER_BOARD, FRESH_SEED, opening).field)
    expect(ann.game).toMatchObject({ outcome: "cleared", durationMs: 30_000, percent: 100 })
    await settle()
    expect(kept.singleplayer).toMatchObject([{ won: true, durationMs: 30_000, hiddenReason: null }])
    expect(kept.xpOf("ann")).toBeGreaterThan(0)
    // settled once: putting it away afterwards keeps nothing more
    ann.say({ type: "endSolo" })
    await settle()
    expect(ann.game).toBeNull()
    expect(kept.records).toHaveLength(1)
  })

  it("keeps a win no person could have played off the leaderboards, and gives nothing for it", async () => {
    const { join, kept } = testLobby()
    const ann = join("ann")
    const intermediate = BOARD_PRESETS[1].settings
    ann.say({ ...solo, settings: intermediate })
    await settle()
    // Never a click wasted, fourteen of them a second, with no pause to think: nobody plays like that.
    // (Each click is slow enough to be let through, so it is the speed of the whole game that gives it away.)
    await playThrough(ann, fieldFor("noGuess", intermediate, FRESH_SEED, opening).field, 70)
    await settle()
    expect(ann.game!.outcome).toBe("cleared")
    expect(kept.singleplayer[0].hiddenReason).toMatch(/faster than anyone plays/)
    expect(kept.records[0].suspectReason).toMatch(/faster than anyone plays/)
    expect(kept.xpOf("ann")).toBe(0)
  })

  it("is given up by putting it away, by starting another, or by going away", async () => {
    const { join, kept } = testLobby()
    const ann = join("ann")
    ann.say(solo)
    await settle()
    ann.say({ type: "endSolo" })
    expect(ann.game).toBeNull()

    ann.say(solo)
    await settle()
    const first = ann.game!.id
    ann.say(solo)
    await settle()
    expect(ann.game!.id).not.toBe(first)
    ann.leave()
    await settle()

    expect(kept.records.map(record => record.outcome)).toEqual(["abandoned", "abandoned", "abandoned"])
    // a game thrown away is time played, but not a result
    expect(kept.singleplayer).toEqual([])
  })

  it("is given up by going into a room, and can't be started in one", async () => {
    const { join, kept } = testLobby()
    const ann = join("ann")
    ann.say(solo)
    await settle()
    ann.say({ type: "createRoom", name: "Room", visibility: "public" })
    expect(ann.game).toBeNull()
    await settle()
    expect(kept.records).toMatchObject([{ outcome: "abandoned" }])

    ann.forget()
    ann.say(solo)
    await settle()
    expect(ann.sent).toEqual([])
  })

  it("can't be started over and over faster than anyone could click", async () => {
    const { join, kept } = testLobby()
    const ann = join("ann")
    for (let i = 0; i < 100; i++) ann.say(solo)
    await settle()
    // a burst gets through, each one giving up the game before it, and the rest are thrown away
    expect(kept.gamesStartedBy("ann")).toBe(30)
    expect(kept.records).toHaveLength(29)
  })

  it("is the only game a player's moves reach", async () => {
    const { join } = testLobby()
    const ann = join("ann")
    // no game at all: nothing happens, and nothing breaks
    ann.forget()
    ann.say({ type: "reveal", row: 0, col: 0 })
    ann.say({ type: "flag", row: 0, col: 0 })
    ann.say({ type: "giveUp" })
    ann.say({ type: "spectate", playerId: "bob" })
    expect(ann.sent).toEqual([])
  })
})

describe("the daily challenge", () => {
  const daily = { type: "startSolo", mode: "daily" } as const
  const { field } = fieldFor("daily", DAILY_BOARD_SETTINGS, DAILY_SEED)

  it("is the same board for everybody, dealt with a countdown", async () => {
    const { join, kept } = testLobby()
    const ann = join("ann")
    const bob = join("bob")
    ann.say(daily)
    bob.say(daily)
    await settle()
    expect(ann.game).toMatchObject({ mode: "daily", settings: DAILY_BOARD_SETTINGS, elapsedMs: -START_COUNTDOWN_MS, outcome: "playing" })
    expect(ann.game!.cells).toBe(bob.game!.cells)
    expect(kept.gamesStartedBy("ann")).toBe(1)
  })

  it("is never a board or an opening of the player's choosing", async () => {
    const { join } = testLobby()
    const ann = join("ann")
    const bob = join("bob")
    ann.say(daily)
    bob.say({ ...daily, settings: { rows: 4, cols: 4, mines: 1 }, opening: { row: 0, col: 0 } })
    await settle()
    expect(bob.game!.settings).toEqual(DAILY_BOARD_SETTINGS)
    expect(bob.game!.opening).toEqual(ann.game!.opening)
    expect(bob.game!.cells).toBe(ann.game!.cells)
  })

  it("keeps the clock running while it is put down, and counts the start only once", async () => {
    const { join, kept } = testLobby()
    const ann = join("ann")
    ann.say(daily)
    await settle()
    await wait(60_000)
    ann.say({ type: "endSolo" })
    await settle()
    // putting it down keeps nothing: it isn't over
    expect(kept.records).toEqual([])

    await wait(60_000)
    ann.say(daily)
    await settle()
    expect(ann.game!.elapsedMs).toBe(120_000 - START_COUNTDOWN_MS)
    expect(kept.gamesStartedBy("ann")).toBe(1)
  })

  it("is finished once, with its time and a lot of experience, and can't be played again that day", async () => {
    const { join, kept } = testLobby()
    const ann = join("ann")
    ann.say(daily)
    await settle()
    await wait(START_COUNTDOWN_MS + 90_000)
    await playThrough(ann, field)
    expect(ann.game).toMatchObject({ outcome: "cleared", percent: 100, layout: null })
    const durationMs = ann.game!.durationMs!
    expect(durationMs).toBeGreaterThan(90_000)
    expect(durationMs).toBeLessThan(110_000)
    await settle()
    expect(kept.daily).toEqual([{ userId: "ann", date: "2026-01-15", durationMs, mineHits: 0, hiddenReason: null }])
    expect(kept.xpOf("ann")).toBe(150)
    expect(kept.records).toMatchObject([{ playerId: "ann", mode: "daily", gameOutcome: "cleared" }])

    ann.say(daily)
    await settle()
    expect(ann.error).toBe("You have already finished today's challenge")
  })

  it("never says where the mines are: someone else is still to play them", async () => {
    const { join } = testLobby()
    const ann = join("ann")
    ann.say(daily)
    await settle()
    await wait(START_COUNTDOWN_MS + 60_000)
    ann.say({ type: "reveal", ...cellsWhere(field, true)[0] })
    expect(ann.game).toMatchObject({ outcome: "playing", mineHits: 1 })
    await wait(MINE_COOLDOWN_MS)
    await playThrough(ann, field)
    expect(ann.game!.outcome).toBe("cleared")
    expect(JSON.stringify(ann.sent)).not.toContain(layoutText(field.mines))
  })

  it("belongs to the day it was started on, even when it is finished after midnight", async () => {
    const { join, kept } = testLobby()
    vi.setSystemTime(Date.UTC(2026, 0, 15, 23, 59, 30))
    const ann = join("ann")
    ann.say(daily)
    await settle()
    await wait(START_COUNTDOWN_MS + 60_000)
    await playThrough(ann, field)
    await settle()
    expect(kept.daily[0].date).toBe("2026-01-15")
  })

  it("isn't started for someone who went into a room while it was being fetched", async () => {
    const { join } = testLobby()
    const ann = join("ann")
    ann.say(daily)
    ann.say({ type: "createRoom", name: "Room", visibility: "public" })
    await settle()
    expect(ann.game).toBeNull()
  })
})

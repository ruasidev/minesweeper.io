import { describe, expect, it } from "vitest"
import { layoutText } from "../engine/field.js"
import { generateField } from "../engine/generate.js"
import { seedFrom } from "../engine/testing.js"
import { CELL_FLAGGED, CELL_HIDDEN, CELL_MINE } from "../engine/view.js"
import {
  flag, giveUp, isPlaying, layoutOf, leaveGame, noteDropped, outcomeOf, ownGame, recordOf, reveal, standings, startGame, stillPlaying,
  stopEveryone, summarize, timeLimitDue, watchedBoard, type Game, type StartOptions,
} from "./game.js"
import { MINE_COOLDOWN_MS, START_COUNTDOWN_MS } from "./modes.js"

const BEGINNER = { rows: 9, cols: 9, mines: 10 }
// play begins here in every game below, so a time is simply this plus how far into the game it is
const START = 10_000
const at = (ms: number) => START + ms

// a race between these players, on a board that is the same every time
function race(players = ["ann", "bob"], options: Partial<StartOptions> = {}): Game {
  return startGame("race", BEGINNER, players, 0, { seed: seedFrom(1), startedAt: START, ...options })
}

// a classic game opened in the middle of the same kind of board
function classic(options: Partial<StartOptions> = {}): Game {
  return startGame("classic", BEGINNER, ["ann"], START, { seed: seedFrom(1), opening: { row: 4, col: 4 }, ...options })
}

const cellsOf = (game: Game, playerId: string, now = at(0)) => ownGame(game, playerId, now)!.cells
const position = (index: number) => [Math.floor(index / BEGINNER.cols), index % BEGINNER.cols] as const

// the cells of the board that are (or aren't) mines and that this player hasn't uncovered
function covered(game: Game, playerId: string, mines: boolean) {
  const layout = layoutOf(game)
  const cells = cellsOf(game, playerId)
  return [...layout].flatMap((char, index) => (char === "1") === mines && cells[index] === CELL_HIDDEN ? [position(index)] : [])
}

// uncovers every safe cell for a player, `ms` into the game
function clearBoard(game: Game, playerId: string, ms: number) {
  for (const [row, col] of covered(game, playerId, false)) {
    // one that an earlier click has already opened up is left alone: clicking it again would chord it
    if (cellsOf(game, playerId)[row * BEGINNER.cols + col] === CELL_HIDDEN) reveal(game, playerId, row, col, at(ms))
  }
}

// ...and every safe cell but one, which is handed back still covered. (It is flagged meanwhile, so that nothing
// opening up beside it takes it too.)
function clearAllButOne(game: Game, playerId: string, ms: number): readonly [number, number] {
  const [kept, ...rest] = covered(game, playerId, false)
  flag(game, playerId, kept[0], kept[1], at(ms))
  for (const [row, col] of rest) {
    if (cellsOf(game, playerId)[row * BEGINNER.cols + col] === CELL_HIDDEN) reveal(game, playerId, row, col, at(ms))
  }
  flag(game, playerId, kept[0], kept[1], at(ms))
  return kept
}

describe("startGame", () => {
  it("starts everyone from the same board, with the same patch already open", () => {
    const game = race()
    expect(cellsOf(game, "ann")).toBe(cellsOf(game, "bob"))
    expect(cellsOf(game, "ann")).toMatch(/0/)
    expect(game.openedAtStart).toBeGreaterThan(8)
    expect(stillPlaying(game)).toBe(2)
  })

  it("lays as many mines as the settings ask for, and none on the opening", () => {
    const game = classic()
    const layout = layoutOf(game)
    expect([...layout].filter(char => char === "1")).toHaveLength(10)
    expect(layout[4 * 9 + 4]).toBe("0")
    expect(ownGame(game, "ann", START)!.opening).toEqual({ row: 4, col: 4 })
  })

  it("makes a board that needs no guess, in every game whose rules ask for one", () => {
    const EXPERT = { rows: 16, cols: 30, mines: 99 }
    for (let seed = 1; seed <= 10; seed++) {
      expect(startGame("noGuess", EXPERT, ["ann"], START, { seed: seedFrom(seed), opening: { row: 8, col: 15 } }).guessFree).toBe(true)
      expect(startGame("race", EXPERT, ["ann", "bob"], 0, { seed: seedFrom(seed) }).guessFree).toBe(true)
      expect(startGame("daily", EXPERT, ["ann"], 0, { seed: seedFrom(seed) }).guessFree).toBe(true)
    }
  })

  it("lays the board of a classic game by chance alone, and promises nothing of it", () => {
    const EXPERT = { rows: 16, cols: 30, mines: 99 }
    const opening = { row: 8, col: 15 }
    let different = 0
    for (let seed = 1; seed <= 10; seed++) {
      const classicGame = startGame("classic", EXPERT, ["ann"], START, { seed: seedFrom(seed), opening })
      expect(classicGame.guessFree).toBe(false)
      const byChance = generateField(EXPERT, seedFrom(seed), { opening: 8 * 30 + 15, guessFree: false })
      expect(layoutOf(classicGame)).toBe(layoutText(byChance.field.mines))
      // the other game throws most of these boards away for one that needs no guess
      if (layoutOf(startGame("noGuess", EXPERT, ["ann"], START, { seed: seedFrom(seed), opening })) !== layoutOf(classicGame)) different++
    }
    expect(different).toBeGreaterThan(5)
  })

  it("makes the board its rules ask for from the seed and the opening, and nothing else", () => {
    const game = classic()
    const again = generateField(BEGINNER, seedFrom(1), { opening: 4 * BEGINNER.cols + 4, guessFree: game.rules.guessFree })
    expect(layoutOf(game)).toBe(layoutText(again.field.mines))
    expect(game.opening).toBe(again.opening)
  })

  it("gives players of a dealt board a countdown before play begins, unless told when it does", () => {
    expect(startGame("race", BEGINNER, ["ann"], 500, { seed: seedFrom(1) }).startedAt).toBe(500 + START_COUNTDOWN_MS)
    expect(race().startedAt).toBe(START)
  })

  it("starts the clock of a game opened by a click there and then", () => {
    expect(classic().startedAt).toBe(START)
  })

  it("is the same game again from the same seed, and another from another", () => {
    expect(layoutOf(race())).toBe(layoutOf(race()))
    expect(layoutOf(race(["ann"], { seed: seedFrom(2) }))).not.toBe(layoutOf(race()))
  })

  it("never lets a player choose where a dealt board opens", () => {
    const dealt = race()
    const asked = race(["ann", "bob"], { opening: { row: 0, col: 0 } })
    expect(asked.opening).toBe(dealt.opening)
    expect(layoutOf(asked)).toBe(layoutOf(dealt))
  })

  it("won't start a game that opens on a click without one, or with one off the board", () => {
    expect(() => startGame("classic", BEGINNER, ["ann"], 0, { seed: seedFrom(1) })).toThrow(RangeError)
    expect(() => classic({ opening: { row: 9, col: 0 } })).toThrow(RangeError)
  })

  it("has a player who has cleared the board already where the opening uncovers all of it", () => {
    const game = startGame("classic", { rows: 4, cols: 4, mines: 1 }, ["ann"], 0, { seed: seedFrom(5), opening: { row: 0, col: 0 } })
    // one mine, tucked into a corner or an edge far from the opening: everything else opens at once, or nearly
    if (outcomeOf(game, "ann") === "cleared") {
      expect(recordOf(game, "ann", 50)!.durationMs).toBe(0)
      expect(stillPlaying(game)).toBe(0)
    } else {
      expect(stillPlaying(game)).toBe(1)
    }
  })

  it("gives every game a number of its own", () => {
    expect(race().id).not.toBe(race().id)
  })
})

describe("reveal", () => {
  it("uncovers a cell and keeps the move", () => {
    const game = race()
    const [row, col] = covered(game, "ann", false)[0]
    expect(reveal(game, "ann", row, col, at(1500))).toBe("playing")
    expect(cellsOf(game, "ann")[row * 9 + col]).toMatch(/[0-8]/)
    expect(recordOf(game, "ann", at(2000))!.moves).toEqual([[1500, 0, row, col]])
  })

  it("is one player's move alone: the others' boards stay as they were", () => {
    const game = race()
    const before = cellsOf(game, "bob")
    const [row, col] = covered(game, "ann", false)[0]
    reveal(game, "ann", row, col, at(100))
    expect(cellsOf(game, "bob")).toBe(before)
    expect(cellsOf(game, "ann")).not.toBe(before)
  })

  it("is refused during the countdown", () => {
    const game = race()
    const [row, col] = covered(game, "ann", false)[0]
    expect(reveal(game, "ann", row, col, START - 1)).toBeNull()
    expect(reveal(game, "ann", row, col, START)).toBe("playing")
  })

  it("is refused off the board, or for somebody who isn't in the game", () => {
    const game = race()
    const [row, col] = covered(game, "ann", false)[0]
    expect(reveal(game, "zed", row, col, at(100))).toBeNull()
    for (const [r, c] of [[-1, 0], [0, 9], [9, 0], [1.5, 2], [NaN, 0]]) expect(reveal(game, "ann", r, c, at(100))).toBeNull()
    expect(reveal(game, "ann", "1" as unknown as number, 1, at(100))).toBeNull()
    expect(recordOf(game, "ann", at(200))!.moves).toEqual([])
  })

  it("changes nothing, and keeps no move, on a flagged cell", () => {
    const game = race()
    const [row, col] = covered(game, "ann", false)[0]
    flag(game, "ann", row, col, at(100))
    expect(reveal(game, "ann", row, col, at(200))).toBeNull()
    expect(recordOf(game, "ann", at(300))!.moves).toHaveLength(1)
  })

  it("finishes a player's game when they uncover the last safe cell", () => {
    const game = race()
    const last = clearAllButOne(game, "ann", 4000)
    expect(isPlaying(game, "ann")).toBe(true)
    expect(reveal(game, "ann", last[0], last[1], at(5000))).toBe("cleared")
    expect(ownGame(game, "ann", at(9000))).toMatchObject({ outcome: "cleared", durationMs: 5000, percent: 100 })
  })

  it("is refused once the player's game is over", () => {
    const game = race()
    giveUp(game, "ann", at(100))
    const [row, col] = covered(game, "ann", false)[0]
    expect(reveal(game, "ann", row, col, at(200))).toBeNull()
    expect(flag(game, "ann", row, col, at(200))).toBe(false)
  })
})

describe("a mine going off", () => {
  it("doesn't end a race: it is counted, shown, and the player sits out a moment", () => {
    const game = race()
    const [row, col] = covered(game, "ann", true)[0]
    expect(reveal(game, "ann", row, col, at(1000))).toBe("playing")
    const own = ownGame(game, "ann", at(1000))!
    expect(own.cells[row * 9 + col]).toBe(CELL_MINE)
    expect(own).toMatchObject({ mineHits: 1, cooldownMs: MINE_COOLDOWN_MS, outcome: "playing" })

    // nothing can be done until the cooldown has passed
    const [safeRow, safeCol] = covered(game, "ann", false)[0]
    expect(reveal(game, "ann", safeRow, safeCol, at(1000 + MINE_COOLDOWN_MS - 1))).toBeNull()
    expect(flag(game, "ann", safeRow, safeCol, at(1000 + MINE_COOLDOWN_MS - 1))).toBe(false)
    expect(reveal(game, "ann", safeRow, safeCol, at(1000 + MINE_COOLDOWN_MS))).toBe("playing")
    expect(ownGame(game, "ann", at(5000))!.cooldownMs).toBe(0)
  })

  it("covers back up what the player had uncovered around it", () => {
    const game = race()
    clearAllButOne(game, "ann", 2000)
    const before = ownGame(game, "ann", at(2000))!.percent
    const [row, col] = covered(game, "ann", true)[0]
    reveal(game, "ann", row, col, at(3000))
    expect(ownGame(game, "ann", at(3000))!.percent).toBeLessThan(before)
  })

  it("can't be set off twice: the mine is already uncovered", () => {
    const game = race()
    const [row, col] = covered(game, "ann", true)[0]
    reveal(game, "ann", row, col, at(1000))
    expect(reveal(game, "ann", row, col, at(5000))).toBeNull()
    expect(ownGame(game, "ann", at(5000))!.mineHits).toBe(1)
  })

  it("ends a classic game", () => {
    const game = classic()
    const [row, col] = covered(game, "ann", true)[0]
    expect(reveal(game, "ann", row, col, at(2500))).toBe("lost")
    expect(ownGame(game, "ann", at(9000))).toMatchObject({ outcome: "lost", durationMs: 2500, mineHits: 1, cooldownMs: 0 })
    expect(stillPlaying(game)).toBe(0)
  })
})

describe("flag", () => {
  it("flags a covered cell, takes the flag off again, and keeps both moves", () => {
    const game = race()
    const [row, col] = covered(game, "ann", true)[0]
    expect(flag(game, "ann", row, col, at(100))).toBe(true)
    expect(cellsOf(game, "ann")[row * 9 + col]).toBe(CELL_FLAGGED)
    expect(flag(game, "ann", row, col, at(200))).toBe(true)
    expect(cellsOf(game, "ann")[row * 9 + col]).toBe(CELL_HIDDEN)
    expect(recordOf(game, "ann", at(300))!.moves).toEqual([[100, 1, row, col], [200, 1, row, col]])
  })

  it("changes nothing on an uncovered cell", () => {
    const game = race()
    const opened = cellsOf(game, "ann").indexOf("0")
    expect(flag(game, "ann", ...position(opened), at(100))).toBe(false)
  })
})

describe("stopping", () => {
  it("giving up stops that player where they are", () => {
    const game = race()
    expect(giveUp(game, "ann", at(7000))).toBe(true)
    expect(ownGame(game, "ann", at(9000))).toMatchObject({ outcome: "gaveUp", durationMs: 7000 })
    expect(stillPlaying(game)).toBe(1)
  })

  it("can't be done twice, or after clearing the board", () => {
    const game = race()
    giveUp(game, "ann", at(100))
    expect(giveUp(game, "ann", at(200))).toBe(false)
    clearBoard(game, "bob", 3000)
    expect(giveUp(game, "bob", at(4000))).toBe(false)
    expect(outcomeOf(game, "bob")).toBe("cleared")
  })

  it("leaving mid-game is its own way of stopping", () => {
    const game = race()
    expect(leaveGame(game, "ann", at(100))).toBe(true)
    expect(outcomeOf(game, "ann")).toBe("left")
  })

  it("stopping everyone leaves those who had finished as they were", () => {
    const game = race(["ann", "bob", "cat"])
    clearBoard(game, "ann", 3000)
    giveUp(game, "bob", at(3500))
    stopEveryone(game, at(8000))
    expect(["ann", "bob", "cat"].map(id => outcomeOf(game, id))).toEqual(["cleared", "gaveUp", "timedOut"])
    expect(recordOf(game, "cat", at(9000))!.durationMs).toBe(8000)
  })
})

describe("timeLimitDue", () => {
  it("is when half of those still in it have cleared the board", () => {
    const game = race(["ann", "bob", "cat"])
    expect(timeLimitDue(game)).toBe(false)
    clearBoard(game, "ann", 3000)
    expect(timeLimitDue(game)).toBe(false)
    clearBoard(game, "bob", 4000)
    expect(timeLimitDue(game)).toBe(true)
  })

  it("doesn't wait on anyone who has given up or left", () => {
    const game = race(["ann", "bob", "cat"])
    clearBoard(game, "ann", 3000)
    giveUp(game, "bob", at(3500))
    expect(timeLimitDue(game)).toBe(true)
  })

  it("isn't due again once the clock is running, or when nobody is left to stop", () => {
    const game = race(["ann", "bob"])
    clearBoard(game, "ann", 3000)
    expect(timeLimitDue(game)).toBe(true)
    game.deadline = at(60_000)
    expect(timeLimitDue(game)).toBe(false)

    const done = race(["ann"])
    clearBoard(done, "ann", 3000)
    expect(timeLimitDue(done)).toBe(false)
  })

  it("never comes in a game whose rules have no such clock", () => {
    const game = startGame("daily", BEGINNER, ["ann", "bob"], 0, { seed: seedFrom(1), startedAt: START })
    clearBoard(game, "ann", 3000)
    expect(timeLimitDue(game)).toBe(false)
  })
})

describe("standings", () => {
  it("puts whoever cleared the board ahead of whoever didn't, and the faster of those first", () => {
    const game = race(["ann", "bob", "cat"])
    clearBoard(game, "bob", 5000)
    clearBoard(game, "cat", 3000)
    expect(standings(game, at(6000)).map(standing => [standing.playerId, standing.place])).toEqual([["cat", 1], ["bob", 2], ["ann", 3]])
  })

  it("ranks those who didn't clear it by how much they uncovered", () => {
    const game = race(["ann", "bob", "cat"])
    const safe = covered(game, "ann", false)
    for (const [row, col] of safe.slice(0, 6)) reveal(game, "bob", row, col, at(1000))
    for (const [row, col] of safe.slice(0, 2)) reveal(game, "cat", row, col, at(1000))
    const order = standings(game, at(2000))
    expect(order.map(standing => standing.playerId)).toEqual(["bob", "cat", "ann"])
    expect(order[0].share).toBeGreaterThan(order[1].share)
    expect(order[2].share).toBe(0)
  })

  it("has equal results share a place, and the next one down skip past them", () => {
    const game = race(["ann", "bob", "cat"])
    clearBoard(game, "cat", 3000)
    // ann and bob have both done nothing since the opening
    expect(standings(game, at(4000)).map(standing => standing.place)).toEqual([1, 2, 2])

    const level = race(["ann", "bob", "cat"])
    const [row, col] = covered(level, "ann", false)[0]
    reveal(level, "cat", row, col, at(100))
    expect(standings(level, at(4000)).map(standing => standing.place)).toEqual([1, 2, 2])
    expect(standings(race(["ann", "bob"]), at(0)).map(standing => standing.place)).toEqual([1, 1])
  })

  it("never counts less than nothing for a player a mine has set back past the opening", () => {
    const game = race()
    const [row, col] = covered(game, "ann", true)[0]
    reveal(game, "ann", row, col, at(1000))
    expect(standings(game, at(2000)).every(standing => standing.share >= 0)).toBe(true)
  })

  it("says how long each player was playing", () => {
    const game = race(["ann", "bob", "cat"])
    clearBoard(game, "ann", 3000)
    giveUp(game, "bob", at(4000))
    const byId = new Map(standings(game, at(6000)).map(standing => [standing.playerId, standing.elapsedMs]))
    expect([byId.get("ann"), byId.get("bob"), byId.get("cat")]).toEqual([3000, 4000, 6000])
  })
})

describe("recordOf", () => {
  it("counts the moves thrown away for coming too fast", () => {
    const game = race()
    noteDropped(game, "ann")
    noteDropped(game, "ann")
    noteDropped(game, "zed")
    expect(recordOf(game, "ann", at(100))!.dropped).toBe(2)
  })

  it("has nothing for somebody who wasn't in the game", () => {
    expect(recordOf(race(), "zed", at(100))).toBeNull()
    expect(ownGame(race(), "zed", at(100))).toBeNull()
    expect(watchedBoard(race(), "zed", at(100))).toBeNull()
  })
})

describe("ownGame", () => {
  it("tells a player their own board and nothing under it", () => {
    const game = race()
    const own = ownGame(game, "ann", at(-1000))!
    expect(own).toMatchObject({ id: game.id, mode: "race", settings: BEGINNER, elapsedMs: -1000, outcome: "playing", durationMs: null, layout: null })
    expect(own.cells).toHaveLength(81)
    expect(own.cells).not.toContain(CELL_MINE)
    expect(JSON.stringify(own)).not.toContain(layoutOf(game))
  })

  it("never tells where the mines are while the game is being played", () => {
    const game = classic()
    expect(ownGame(game, "ann", at(100))!.layout).toBeNull()
    const [row, col] = covered(game, "ann", false)[0]
    reveal(game, "ann", row, col, at(200))
    expect(ownGame(game, "ann", at(300))!.layout).toBeNull()
  })

  it("tells them once a classic game is over, won or lost", () => {
    const lost = classic()
    const [row, col] = covered(lost, "ann", true)[0]
    reveal(lost, "ann", row, col, at(200))
    expect(ownGame(lost, "ann", at(300))!.layout).toBe(layoutOf(lost))

    const won = classic()
    clearBoard(won, "ann", 4000)
    expect(ownGame(won, "ann", at(5000))).toMatchObject({ outcome: "cleared", layout: layoutOf(won) })
  })

  it("never tells them in a game others are playing on the same board, even once it is over for this player", () => {
    for (const mode of ["race", "daily"] as const) {
      const game = startGame(mode, BEGINNER, ["ann", "bob"], 0, { seed: seedFrom(1), startedAt: START })
      clearBoard(game, "ann", 3000)
      giveUp(game, "bob", at(3500))
      expect(ownGame(game, "ann", at(4000))!.layout).toBeNull()
      expect(ownGame(game, "bob", at(4000))!.layout).toBeNull()
    }
  })
})

describe("watchedBoard", () => {
  it("is the board as its player sees it, flags and all", () => {
    const game = race()
    const [row, col] = covered(game, "ann", true)[0]
    flag(game, "ann", row, col, at(100))
    expect(watchedBoard(game, "ann", at(200))).toEqual({ cells: cellsOf(game, "ann"), cooldownMs: 0 })
  })
})

describe("summarize", () => {
  const players = [{ id: "ann", username: "Ann", image: null }, { id: "bob", username: "Bob", image: null }]

  it("tells the room how far along everyone is without saying where anything is", () => {
    const game = race()
    clearBoard(game, "ann", 3000)
    const summary = summarize(game, players, at(4000))
    expect(summary).toMatchObject({ id: game.id, mode: "race", rated: false, over: false, timeLeftMs: null, elapsedMs: 4000, sectionRows: 5, sectionCols: 5 })
    expect(summary.progress.ann).toMatchObject({ percent: 100, finishedMs: 3000, outcome: "cleared", place: 1, ratingChange: null })
    expect(summary.progress.bob).toMatchObject({ outcome: "playing", place: 2 })
    expect(summary.progress.ann.sections).toHaveLength(25)
    // nothing in it is the board itself
    expect(JSON.stringify(summary)).not.toContain(layoutOf(game))
    expect(JSON.stringify(summary)).not.toContain(cellsOf(game, "ann"))
  })

  it("counts down the time the players still going have left, and says how ratings moved once they have", () => {
    const game = race()
    game.deadline = at(60_000)
    expect(summarize(game, players, at(45_000)).timeLeftMs).toBe(15_000)
    game.over = true
    game.ratingChanges = new Map([["ann", 12], ["bob", -12]])
    const summary = summarize(game, players, at(70_000))
    expect(summary.timeLeftMs).toBeNull()
    expect([summary.progress.ann.ratingChange, summary.progress.bob.ratingChange]).toEqual([12, -12])
  })

  it("keeps up with a board as it changes", () => {
    const game = race()
    const before = summarize(game, players, at(100)).progress.ann.percent
    clearAllButOne(game, "ann", 2000)
    expect(summarize(game, players, at(3000)).progress.ann.percent).toBeGreaterThan(before)
  })
})

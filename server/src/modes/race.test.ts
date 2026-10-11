import { describe, expect, it } from "vitest"
import { BEGINNER_BOARD } from "../../../shared/game/boards.js"
import { giveUp, isPlaying, reveal, type Game } from "../../../shared/game/game.js"
import { START_COUNTDOWN_MS } from "../../../shared/game/modes.js"
import type { Player, RoomVisibility } from "../../../shared/protocol.js"
import { memoryLedger } from "../testing/memoryLedger.js"
import { FRESH_SEED, cellsWhere, fieldFor, seedFrom } from "../testing/players.js"
import { raceMode } from "./race.js"

const player = (id: string): Player => ({ id, username: id, image: null })
const { field } = fieldFor("race", BEGINNER_BOARD, FRESH_SEED)
const DAY = 24 * 60 * 60 * 1000

function setUp() {
  const kept = memoryLedger()
  const race = raceMode({ ledger: kept.ledger, freshSeed: () => FRESH_SEED, dailySeed: () => seedFrom(9) })

  // A whole game: the first player clears the board a minute in, and the rest give up. Returns the game as it ended
  async function play(ids: string[], startedAt: number, visibility: RoomVisibility = "public"): Promise<Game> {
    const game = race.start(BEGINNER_BOARD, ids.map(player), startedAt, { visibility })
    const end = startedAt + START_COUNTDOWN_MS + 60_000
    for (const { row, col } of cellsWhere(field, false)) {
      if (isPlaying(game, ids[0])) reveal(game, ids[0], row, col, end)
    }
    await race.cleared(game, ids[0], end)
    for (const id of ids.slice(1)) giveUp(game, id, end)
    game.over = true
    await race.finished(game, end)
    return game
  }

  return { kept, race, play }
}

describe("a race", () => {
  it("counts towards ratings in a public room, and not in a private one", async () => {
    const { play } = setUp()
    expect((await play(["ann", "bob"], 0)).rated).toBe(true)
    expect((await play(["ann", "bob"], 0, "private")).rated).toBe(false)
  })

  it("counts as a game started for everyone in it", async () => {
    const { kept, play } = setUp()
    await play(["ann", "bob", "cat"], 0)
    expect(["ann", "bob", "cat"].map(kept.gamesStartedBy)).toEqual([1, 1, 1])
  })

  it("moves the winner's rating up and the loser's down by as much", async () => {
    const { kept, play } = setUp()
    const game = await play(["ann", "bob"], 0)
    expect([...game.ratingChanges!]).toEqual([["ann", 16], ["bob", -16]])
    expect(kept.records.map(record => [record.playerId, record.place, record.players, record.ratingChange])).toEqual([
      ["ann", 1, 2, 16],
      ["bob", 2, 2, -16],
    ])
  })

  it("counts for less each time the same two play each other in a day, and then for nothing", async () => {
    const { play } = setUp()
    const gains: number[] = []
    for (let game = 0; game < 5; game++) gains.push((await play(["ann", "bob"], game * 600_000)).ratingChanges!.get("ann")!)
    // fully, then half, then a quarter, of a little less each time as ann's rating pulls ahead
    expect(gains[0]).toBe(16)
    expect(gains[1]).toBeGreaterThan(0)
    expect(gains[1]).toBeLessThanOrEqual(8)
    expect(gains[2]).toBeGreaterThan(0)
    expect(gains[2]).toBeLessThanOrEqual(4)
    expect(gains.slice(3)).toEqual([0, 0])
  })

  it("leaves ratings alone against an account whose games don't count", async () => {
    const { kept, play } = setUp()
    kept.unrated.add("bob")
    const game = await play(["ann", "bob", "cat"], 0)
    // ann beat both, but only the match with cat counts: half the change a win over one opponent brings
    expect(game.ratingChanges!.get("ann")).toBe(8)
    expect(game.ratingChanges!.get("bob")).toBe(0)
    expect(game.ratingChanges!.get("cat")).toBeLessThan(0)
  })

  it("moves no rating for a game played alone", async () => {
    const { kept, play } = setUp()
    const game = await play(["ann"], 0)
    expect(game.ratingChanges).toBeNull()
    expect(kept.records).toMatchObject([{ playerId: "ann", place: 1, players: 1, ratingChange: null }])
  })

  it("gives the winner more experience than those who didn't finish, and puts their time on the leaderboard", async () => {
    const { kept, play } = setUp()
    await play(["ann", "bob"], 0)
    expect(kept.xpOf("ann")).toBeGreaterThan(kept.xpOf("bob"))
    expect(kept.multiplayer).toEqual([{ userId: "ann", settings: BEGINNER_BOARD, durationMs: 60_000, mineHits: 0, hiddenReason: null }])
  })

  it("forgets how often two players have met once a day has passed", async () => {
    const { play } = setUp()
    for (let game = 0; game < 4; game++) await play(["ann", "bob"], game * 600_000)
    expect((await play(["ann", "bob"], 600_000 * 5)).ratingChanges!.get("ann")).toBe(0)
    expect((await play(["ann", "bob"], 2 * DAY)).ratingChanges!.get("ann")).toBeGreaterThan(0)
  })
})

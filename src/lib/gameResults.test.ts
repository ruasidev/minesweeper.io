import { describe, expect, it } from "vitest"
import type { PlayerProgress } from "../../shared/protocol"
import { describeOutcome, describeResult, MEDALS, ordinal, verdictOf } from "./gameResults"

const progress = (overrides: Partial<PlayerProgress>): PlayerProgress =>
  ({ sections: [], percent: 40, mineHits: 0, finishedMs: null, outcome: "playing", place: 1, ratingChange: null, ...overrides })

describe("ordinal", () => {
  it("ends a place the way it is said", () => {
    expect([1, 2, 3, 4, 10].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "10th"])
    expect([21, 22, 23, 101].map(ordinal)).toEqual(["21st", "22nd", "23rd", "101st"])
  })

  it("knows the teens are all -th", () => {
    expect([11, 12, 13, 111, 112, 113].map(ordinal)).toEqual(["11th", "12th", "13th", "111th", "112th", "113th"])
  })
})

describe("describeResult", () => {
  it("is the time of someone who cleared the board", () => {
    expect(describeResult(progress({ outcome: "cleared", finishedMs: 83_450, percent: 100 }))).toBe("1:23.4")
  })

  it("is how far along someone still playing is", () => {
    expect(describeResult(progress({ outcome: "playing", percent: 40 }))).toBe("Playing · 40%")
  })

  it("says why someone stopped, and how far they had got", () => {
    expect(describeResult(progress({ outcome: "gaveUp", percent: 62 }))).toBe("Gave up · 62%")
    expect(describeResult(progress({ outcome: "timedOut", percent: 90 }))).toBe("Did not finish · 90%")
    expect(describeResult(progress({ outcome: "left", percent: 5 }))).toBe("Left · 5%")
  })
})

describe("describeOutcome", () => {
  it("says how a recorded game ended and when", () => {
    expect(describeOutcome("cleared", 83_450)).toBe("Cleared in 1:23.4")
    expect(describeOutcome("lost", 5_000)).toBe("Hit a mine at 0:05.0")
    expect(describeOutcome("abandoned", 5_000)).toBe("Abandoned at 0:05.0")
    expect(describeOutcome("gaveUp", 5_000)).toBe("Gave up at 0:05.0")
    expect(describeOutcome("left", 5_000)).toBe("Left at 0:05.0")
    expect(describeOutcome("timedOut", 5_000)).toBe("Did not finish")
  })

  it("falls back to the time for an ending it doesn't know", () => {
    expect(describeOutcome("something new", 5_000)).toBe("0:05.0")
  })
})

describe("verdictOf", () => {
  const game = { kind: "singleplayer" as const, outcome: "cleared", durationMs: 83_450, mineHits: 0, place: null, players: null }

  it("calls a singleplayer game won, lost or abandoned", () => {
    expect(verdictOf(game)).toEqual({ word: "Won", tone: "good", detail: "Cleared in 1:23.4" })
    expect(verdictOf({ ...game, outcome: "lost", mineHits: 1 })).toEqual({ word: "Lost", tone: "bad", detail: "Hit a mine at 1:23.4" })
    expect(verdictOf({ ...game, outcome: "abandoned" })).toEqual({ word: "Abandoned", tone: "plain", detail: "Left at 1:23.4" })
  })

  it("says where a player came in a multiplayer game", () => {
    const multiplayer = { ...game, kind: "multiplayer" as const, place: 1, players: 4 }
    expect(verdictOf(multiplayer)).toEqual({ word: "1st of 4", tone: "good", detail: "Cleared in 1:23.4" })
    expect(verdictOf({ ...multiplayer, place: 3, mineHits: 2 })).toEqual({ word: "3rd of 4", tone: "good", detail: "Cleared in 1:23.4 · 2 mines hit" })
  })

  it("says why a multiplayer game wasn't finished, with the place it still came to", () => {
    const stopped = { ...game, kind: "multiplayer" as const, outcome: "gaveUp", place: 2, players: 2, mineHits: 1 }
    expect(verdictOf(stopped)).toEqual({ word: "Gave up · 2nd of 2", tone: "bad", detail: "Stopped at 1:23.4 · 1 mine hit" })
    expect(verdictOf({ ...stopped, outcome: "timedOut" }).word).toBe("Did not finish · 2nd of 2")
    expect(verdictOf({ ...stopped, outcome: "left" }).word).toBe("Left · 2nd of 2")
  })

  it("leaves the place out where there is none: a game played alone, or one from before places were kept", () => {
    expect(verdictOf({ ...game, kind: "multiplayer", place: 1, players: 1 }).word).toBe("Cleared")
    expect(verdictOf({ ...game, kind: "multiplayer" }).word).toBe("Cleared")
    expect(verdictOf({ ...game, kind: "multiplayer", outcome: "gaveUp" }).word).toBe("Gave up")
  })

  it("calls the daily challenge cleared or not finished", () => {
    expect(verdictOf({ ...game, kind: "daily", mineHits: 3 })).toEqual({ word: "Cleared", tone: "good", detail: "In 1:23.4 · 3 mines hit" })
    expect(verdictOf({ ...game, kind: "daily", outcome: "playing" })).toMatchObject({ word: "Not finished", tone: "plain" })
  })
})

describe("MEDALS", () => {
  it("has one for each of the first three places", () => {
    expect(MEDALS).toHaveLength(3)
  })
})

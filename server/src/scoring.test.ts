import { describe, expect, it } from "vitest"
import { BOARD_PRESETS } from "../../shared/game/boards.js"
import { DAILY_XP, eloChanges, multiplayerXp, singleplayerXp, suspicion } from "./scoring.js"

const [BEGINNER, INTERMEDIATE, EXPERT] = BOARD_PRESETS.map(preset => preset.settings)

describe("singleplayerXp", () => {
  it("is worth more the harder the board", () => {
    expect(singleplayerXp(BEGINNER)).toBe(2)
    expect(singleplayerXp(INTERMEDIATE)).toBe(12)
    expect(singleplayerXp(EXPERT)).toBe(40)
  })

  it("is nothing for a board too easy to count", () => {
    expect(singleplayerXp({ rows: 4, cols: 4, mines: 1 })).toBe(0)
  })

  it("is far less than the daily challenge", () => {
    expect(DAILY_XP).toBeGreaterThan(singleplayerXp(EXPERT))
  })
})

describe("multiplayerXp", () => {
  const cleared = { finishedMs: 60_000, share: 1, mineHits: 0, place: 2, playerCount: 4 }

  it("pays in full for clearing the board", () => {
    expect(multiplayerXp(INTERMEDIATE, cleared)).toBe(38)
    expect(multiplayerXp(EXPERT, cleared)).toBe(123)
  })

  it("pays half as much again for coming first, when there was somebody to beat", () => {
    expect(multiplayerXp(INTERMEDIATE, { ...cleared, place: 1 })).toBe(56)
    expect(multiplayerXp(INTERMEDIATE, { ...cleared, place: 1, playerCount: 1 })).toBe(38)
  })

  it("pays less for every mine hit, down to half", () => {
    expect(multiplayerXp(EXPERT, { ...cleared, mineHits: 2 })).toBe(110)
    expect(multiplayerXp(EXPERT, { ...cleared, mineHits: 10 })).toBe(61)
    expect(multiplayerXp(EXPERT, { ...cleared, mineHits: 500 })).toBe(61)
  })

  it("pays a share for the part of the board uncovered, to someone who didn't clear it", () => {
    const stopped = { ...cleared, finishedMs: null }
    expect(multiplayerXp(EXPERT, { ...stopped, share: 0.5 })).toBe(18)
    expect(multiplayerXp(EXPERT, { ...stopped, share: 0 })).toBe(0)
    // however much of it: less than clearing it
    expect(multiplayerXp(EXPERT, { ...stopped, share: 1 })).toBeLessThan(multiplayerXp(EXPERT, { ...cleared, mineHits: 500 }))
  })
})

describe("eloChanges", () => {
  const ratings = (entries: Record<string, number>) => new Map(Object.entries(entries))
  const places = (entries: Record<string, number>) => new Map(Object.entries(entries))

  it("moves two equal players the same distance, in opposite directions", () => {
    const changes = eloChanges(ratings({ ann: 1000, bob: 1000 }), places({ ann: 1, bob: 2 }))
    expect(Object.fromEntries(changes)).toEqual({ ann: 16, bob: -16 })
  })

  it("moves nobody when equal players draw", () => {
    const changes = eloChanges(ratings({ ann: 1000, bob: 1000 }), places({ ann: 1, bob: 1 }))
    expect(Object.fromEntries(changes)).toEqual({ ann: 0, bob: 0 })
  })

  it("moves a favourite less for winning than an outsider for the upset", () => {
    const favouriteWins = eloChanges(ratings({ ann: 1400, bob: 1000 }), places({ ann: 1, bob: 2 }))
    const upset = eloChanges(ratings({ ann: 1400, bob: 1000 }), places({ ann: 2, bob: 1 }))
    expect(favouriteWins.get("ann")).toBe(3)
    expect(upset.get("bob")).toBe(29)
    expect(upset.get("ann")).toBe(-29)
  })

  it("averages a game of several players over each of the others", () => {
    const changes = eloChanges(ratings({ ann: 1000, bob: 1000, cat: 1000 }), places({ ann: 1, bob: 2, cat: 3 }))
    expect(Object.fromEntries(changes)).toEqual({ ann: 16, bob: 0, cat: -16 })
  })

  it("counts a pairing for only as much as its weight says", () => {
    const half = eloChanges(ratings({ ann: 1000, bob: 1000 }), places({ ann: 1, bob: 2 }), () => 0.5)
    expect(Object.fromEntries(half)).toEqual({ ann: 8, bob: -8 })
    const none = eloChanges(ratings({ ann: 1000, bob: 1000 }), places({ ann: 1, bob: 2 }), () => 0)
    expect(Object.fromEntries(none)).toEqual({ ann: 0, bob: 0 })
  })

  it("weighs each pairing by itself", () => {
    // ann and bob have played each other out today; cat is new to them both
    const weight = (a: string, b: string) => [a, b].includes("cat") ? 1 : 0
    const changes = eloChanges(ratings({ ann: 1000, bob: 1000, cat: 1000 }), places({ ann: 1, bob: 2, cat: 3 }), weight)
    expect(Object.fromEntries(changes)).toEqual({ ann: 8, bob: 8, cat: -16 })
  })

  it("has nothing to measure a player against in a game played alone", () => {
    expect(eloChanges(ratings({ ann: 1000 }), places({ ann: 1 })).size).toBe(0)
  })

  it("leaves out anyone without a rating, from the answer and from everyone else's sums", () => {
    const changes = eloChanges(ratings({ ann: 1000, bob: 1000 }), places({ ann: 1, bob: 2, cat: 3 }))
    expect([...changes.keys()]).toEqual(["ann", "bob"])
    // each is still averaged over the two others who played
    expect(Object.fromEntries(changes)).toEqual({ ann: 8, bob: -8 })
  })
})

describe("suspicion", () => {
  it("has nothing to say about a board cleared at a human pace", () => {
    expect(suspicion({ bv: 40 }, { durationMs: 30_000, dropped: 0 })).toBeNull()
    // the fastest players in the world manage about ten needed clicks a second
    expect(suspicion({ bv: 100 }, { durationMs: 10_000, dropped: 0 })).toBeNull()
  })

  it("doubts a board cleared faster than anyone plays", () => {
    expect(suspicion({ bv: 100 }, { durationMs: 5000, dropped: 0 })).toBe("Cleared at 20.0 needed clicks a second: faster than anyone plays")
  })

  it("doesn't judge the speed of a board that only needed a few clicks", () => {
    expect(suspicion({ bv: 7 }, { durationMs: 100, dropped: 0 })).toBeNull()
    expect(suspicion({ bv: 8 }, { durationMs: 100, dropped: 0 })).not.toBeNull()
  })

  it("doubts a game in which many moves came too fast to be clicks, however long it took", () => {
    expect(suspicion({ bv: 40 }, { durationMs: 60_000, dropped: 21 })).toBe("21 moves came faster than a person can click")
    expect(suspicion({ bv: 40 }, { durationMs: 60_000, dropped: 20 })).toBeNull()
  })

  it("copes with a game that took no time at all", () => {
    expect(suspicion({ bv: 0 }, { durationMs: 0, dropped: 0 })).toBeNull()
    expect(suspicion({ bv: 50 }, { durationMs: 0, dropped: 0 })).not.toBeNull()
  })
})

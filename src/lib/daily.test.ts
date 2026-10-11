import { describe, expect, it } from "vitest"
import type { ScoreEntry } from "./api"
import { dailyStanding } from "./daily"

const entry = (userId: string, durationMs: number): ScoreEntry => ({ userId, username: userId, image: null, durationMs, mineHits: 0, at: "" })
const mine = (durationMs: number | null, place: number | null, mineHits = 0) => ({ startedAt: "", durationMs, mineHits, place, recordId: null })

describe("dailyStanding", () => {
  it("has nothing to say until the player has cleared the board", () => {
    expect(dailyStanding({ entries: [entry("bob", 50_000)], cleared: 1, mine: null }, "ann")).toBeNull()
    expect(dailyStanding({ entries: [entry("bob", 50_000)], cleared: 1, mine: mine(null, null) }, "ann")).toBeNull()
  })

  it("says how far behind the quickest they are", () => {
    const standing = dailyStanding({ entries: [entry("bob", 50_000), entry("ann", 61_200), entry("cat", 70_000)], cleared: 3, mine: mine(61_200, 2, 1) }, "ann")
    expect(standing).toEqual({ durationMs: 61_200, mineHits: 1, place: 2, cleared: 3, gap: { label: "Behind 1st", ms: 11_200 } })
  })

  it("says how far ahead of the next they are, when they are the quickest", () => {
    const standing = dailyStanding({ entries: [entry("ann", 45_000), entry("bob", 50_000)], cleared: 2, mine: mine(45_000, 1) }, "ann")
    expect(standing).toMatchObject({ place: 1, gap: { label: "Ahead of 2nd", ms: 5000 } })
  })

  it("has nobody to compare the only player to clear it with", () => {
    expect(dailyStanding({ entries: [entry("ann", 45_000)], cleared: 1, mine: mine(45_000, 1) }, "ann")).toMatchObject({ place: 1, cleared: 1, gap: null })
  })

  it("goes by the place the server gives, for a player too far down to be in the list", () => {
    const top = Array.from({ length: 50 }, (_, at) => entry(`p${at}`, 40_000 + at * 1000))
    expect(dailyStanding({ entries: top, cleared: 80, mine: mine(200_000, 77) }, "ann")).toMatchObject({ place: 77, cleared: 80, gap: { label: "Behind 1st", ms: 160_000 } })
  })

  it("gives a time that was kept off the board no place and nothing to compare", () => {
    expect(dailyStanding({ entries: [entry("bob", 50_000)], cleared: 1, mine: mine(2000, null) }, "ann")).toMatchObject({ durationMs: 2000, place: null, gap: null })
  })
})

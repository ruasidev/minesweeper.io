import { describe, expect, it } from "vitest"
import { USERNAME_PATTERN } from "./profile.js"
import { boardDifficulty, levelFromXp, xpForLevel } from "./progression.js"

describe("boardDifficulty", () => {
  it("rates the classic boards far apart", () => {
    expect(boardDifficulty({ rows: 9, cols: 9, mines: 10 })).toBeCloseTo(1.23, 2)
    expect(boardDifficulty({ rows: 16, cols: 16, mines: 40 })).toBeCloseTo(6.25, 2)
    expect(boardDifficulty({ rows: 16, cols: 30, mines: 99 })).toBeCloseTo(20.42, 2)
  })

  it("rates the same mines harder when they are packed closer", () => {
    expect(boardDifficulty({ rows: 8, cols: 8, mines: 20 })).toBeGreaterThan(boardDifficulty({ rows: 16, cols: 16, mines: 20 }))
  })

  it("stops at a ceiling, so a board packed solid isn't worth a fortune", () => {
    expect(boardDifficulty({ rows: 10, cols: 10, mines: 91 })).toBe(30)
  })
})

describe("levels", () => {
  it("take a hundred more experience each than the one before", () => {
    expect([1, 2, 3, 4, 10].map(xpForLevel)).toEqual([0, 100, 300, 600, 4500])
  })

  it("start everyone at level 1", () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(99)).toBe(1)
    expect(levelFromXp(-50)).toBe(1)
  })

  it("are reached exactly at the experience they start at", () => {
    for (let level = 1; level <= 60; level++) {
      expect(levelFromXp(xpForLevel(level))).toBe(level)
      if (level > 1) expect(levelFromXp(xpForLevel(level) - 1)).toBe(level - 1)
    }
  })
})

describe("usernames", () => {
  it("are 3 to 20 letters, digits or underscores", () => {
    for (const name of ["abc", "Ruasi", "player_1", "a".repeat(20)]) expect(name).toMatch(USERNAME_PATTERN)
  })

  it("can't be shorter or longer, or hold anything else", () => {
    for (const name of ["ab", "a".repeat(21), "with space", "dash-ed", "émile", "", "a@b"]) expect(name).not.toMatch(USERNAME_PATTERN)
  })
})

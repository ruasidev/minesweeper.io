import { describe, expect, it } from "vitest"
import { maxMines } from "../engine/generate.js"
import { BOARD_PRESETS, DAILY_BOARD_SETTINGS, DEFAULT_BOARD_SETTINGS, boardName, boardSize, presetOf, sameBoard } from "./boards.js"

const [BEGINNER, INTERMEDIATE, EXPERT] = BOARD_PRESETS.map(preset => preset.settings)

describe("the classic boards", () => {
  it("are the three everyone knows", () => {
    expect(BEGINNER).toEqual({ rows: 9, cols: 9, mines: 10 })
    expect(INTERMEDIATE).toEqual({ rows: 16, cols: 16, mines: 40 })
    expect(EXPERT).toEqual({ rows: 16, cols: 30, mines: 99 })
  })

  it("can all be made", () => {
    for (const { rows, cols, mines } of [BEGINNER, INTERMEDIATE, EXPERT]) expect(mines).toBeLessThanOrEqual(maxMines(rows, cols))
  })

  it("include what a new room and the daily challenge are played on", () => {
    expect(DEFAULT_BOARD_SETTINGS).toEqual(INTERMEDIATE)
    expect(DAILY_BOARD_SETTINGS).toEqual(INTERMEDIATE)
  })
})

describe("naming a board", () => {
  it("knows a classic board by its settings, whatever object they come in", () => {
    expect(presetOf({ rows: 16, cols: 30, mines: 99 })?.id).toBe("expert")
    expect(presetOf({ rows: 16, cols: 30, mines: 98 })).toBeUndefined()
    expect(sameBoard({ rows: 9, cols: 9, mines: 10 }, BEGINNER)).toBe(true)
    // rows and columns are not interchangeable
    expect(presetOf({ rows: 30, cols: 16, mines: 99 })).toBeUndefined()
  })

  it("calls a classic board by its name and any other by its size", () => {
    expect(boardName(BEGINNER)).toBe("Beginner")
    expect(boardName({ rows: 12, cols: 20, mines: 30 })).toBe("12 × 20 · 30 mines")
    expect(boardSize({ rows: 4, cols: 4, mines: 1 })).toBe("4 × 4 · 1 mine")
  })
})

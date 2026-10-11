import { describe, expect, it } from "vitest"
import { coveredBoard, press, uncover, type Board } from "./board.js"
import { clicksNeeded, sectionProgress, sectionSizeOf } from "./analysis.js"
import { generateField } from "./generate.js"
import { at, boardDrawn, click, seedFrom } from "./testing.js"

describe("clicksNeeded", () => {
  it("is one click for a patch of empty cells, however big", () => {
    expect(clicksNeeded(boardDrawn("....", "....", "...*"))).toBe(1)
  })

  it("is one click for every number that touches no empty cell", () => {
    // nothing here is empty: every safe cell is a number, each its own click
    expect(clicksNeeded(boardDrawn("*.*", "...", "*.*"))).toBe(5)
  })

  it("counts patches that don't touch as one click each", () => {
    const board = boardDrawn(
      "..*..",
      "..*..",
      "..*..",
    )
    expect(clicksNeeded(board)).toBe(2)
  })

  it("counts only what is still covered", () => {
    const board = boardDrawn(
      "..*..",
      "..*..",
      "..*..",
    )
    const half = click(board, [0, 0])
    expect(clicksNeeded(half)).toBe(1)
    expect(clicksNeeded(click(half, [0, 4]))).toBe(0)
  })

  it("counts an empty patch whose numbers are showing but which hasn't been opened itself", () => {
    const board = boardDrawn(
      "*...",
      "....",
    )
    // One number is uncovered. The patch still takes its click, and so does the number in the corner under the
    // mine, which no patch reaches
    const numberOnly = click(board, [0, 1])
    expect(clicksNeeded(numberOnly)).toBe(2)
  })

  it("is how many clicks it really takes: playing them clears the board", () => {
    const { field, opening } = generateField({ rows: 16, cols: 16, mines: 40 }, seedFrom(11))
    let board: Board = uncover(coveredBoard(field), opening).board
    let clicks = 0
    const needed = clicksNeeded(board)
    // first every patch of empty cells, then whatever numbers are left
    for (const emptyOnly of [true, false]) {
      for (let cell = 0; cell < field.mines.length; cell++) {
        if (field.mines[cell] || board.cells[cell] !== 0 || (emptyOnly && field.counts[cell] !== 0)) continue
        board = uncover(board, cell).board
        clicks++
      }
    }
    expect(board.status).toBe("won")
    expect(clicks).toBe(needed)
  })
})

describe("sectionSizeOf", () => {
  it("is never smaller than 2, so a section never gives a single cell away", () => {
    expect(sectionSizeOf(4, 4)).toBe(2)
    expect(sectionSizeOf(9, 9)).toBe(2)
    expect(sectionSizeOf(16, 16)).toBe(2)
  })

  it("grows with the longer side, to keep a big board to a dozen sections along it", () => {
    expect(sectionSizeOf(16, 30)).toBe(3)
    expect(sectionSizeOf(30, 16)).toBe(3)
    expect(sectionSizeOf(99, 99)).toBe(9)
  })
})

describe("sectionProgress", () => {
  const board = boardDrawn(
    "....",
    "....",
    "...*",
    "..**",
  )

  it("starts with nothing done anywhere", () => {
    expect(sectionProgress(board, 2, 10)).toEqual({ sections: [0, 0, 0, 0], share: 0 })
  })

  it("says how much of each section's safe cells are uncovered", () => {
    const opened = click(board, [0, 0])
    const { sections, share } = sectionProgress(opened, 2, 10)
    // the bottom right section has one safe cell, a number, which the opening reached
    expect(sections).toEqual([10, 10, 10, 10])
    expect(share).toBe(1)
  })

  it("rounds a part-done section down", () => {
    const some = click(boardDrawn("*.", "..", "..", ".*"), [1, 0])
    // top section: one of three safe cells
    expect(sectionProgress(some, 2, 10).sections).toEqual([3, 0])
    expect(sectionProgress(some, 2, 10).share).toBeCloseTo(1 / 6)
  })

  it("has a section that is all mines follow the whole board, so it can't be picked out", () => {
    const mined = boardDrawn(
      "**..",
      "**..",
      "....",
      "....",
    )
    expect(sectionProgress(mined, 2, 10).sections[0]).toBe(0)
    const part = click(mined, [0, 3], [3, 0])
    const { sections, share } = sectionProgress(part, 2, 10)
    expect(sections[0]).toBe(Math.floor(10 * share))
  })

  it("handles a board that doesn't divide evenly into sections", () => {
    const odd = boardDrawn(
      ".....",
      ".....",
      "....*",
    )
    const { sections } = sectionProgress(click(odd, [0, 0]), 2, 10)
    expect(sections).toHaveLength(6)
    expect(sections.every(level => level === 10)).toBe(true)
  })

  it("counts a mine going off as progress lost", () => {
    const start = boardDrawn(
      ".*...",
      "**...",
      ".....",
      ".....",
      ".....",
    )
    const opened = press(start, at(start, 4, 4), { kind: "ends" }).board
    const blown = press(opened, 1, { kind: "blast", radius: 2.5 }).board
    expect(sectionProgress(blown, 2, 10).share).toBeLessThan(sectionProgress(opened, 2, 10).share)
  })
})

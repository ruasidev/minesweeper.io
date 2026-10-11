import { describe, expect, it } from "vitest"
import { UNCOVERED, coveredBoard, knownMinesAround, press, toggleFlag, uncover } from "./board.js"
import { generateField } from "./generate.js"
import { at, boardDrawn, click, seedFrom } from "./testing.js"
import { CELL_FLAGGED, CELL_HIDDEN, CELL_MINE, canChord, isUncovered, numberOn, viewOf } from "./view.js"

describe("viewOf", () => {
  it("is one character per cell, row after row", () => {
    const start = boardDrawn(
      "*..",
      "...",
      "...",
    )
    expect(viewOf(start)).toBe(".........")
    const flagged = toggleFlag(click(start, [0, 1]), at(start, 2, 2))
    expect(viewOf(flagged)).toBe(".1......F")
  })

  it("shows a mine only once it has been uncovered", () => {
    const start = boardDrawn("*.", "..")
    expect(viewOf(start)).not.toContain(CELL_MINE)
    expect(viewOf(uncover(start, 0).board)).toBe("*...")
  })

  it("says nothing about what is under a covered or flagged cell", () => {
    // two boards that differ only where nothing has been uncovered look the same
    const one = toggleFlag(click(boardDrawn("..*", "...", "*.."), [0, 0]), 2)
    const other = toggleFlag(click(boardDrawn("...", "..*", "*.."), [0, 0]), 2)
    expect(viewOf(one).replace(/[0-8]/g, "n")).toBe(viewOf(other).replace(/[0-8]/g, "n"))
    for (const cell of viewOf(one)) expect([CELL_HIDDEN, CELL_FLAGGED, "0", "1", "2"]).toContain(cell)
  })
})

describe("cells of a view", () => {
  it("are uncovered when they are a number or an open mine", () => {
    expect(isUncovered("0")).toBe(true)
    expect(isUncovered("8")).toBe(true)
    expect(isUncovered(CELL_MINE)).toBe(true)
    expect(isUncovered(CELL_HIDDEN)).toBe(false)
    expect(isUncovered(CELL_FLAGGED)).toBe(false)
  })

  it("have a number only when they are one", () => {
    expect(numberOn("0")).toBe(0)
    expect(numberOn("8")).toBe(8)
    for (const cell of [CELL_HIDDEN, CELL_FLAGGED, CELL_MINE]) expect(numberOn(cell)).toBeNull()
  })
})

describe("canChord", () => {
  const start = boardDrawn(
    "*...",
    "....",
    "...*",
  )

  it("is true for a number with that many flags around it", () => {
    const opened = click(start, [1, 1])
    expect(canChord(viewOf(opened), 3, 4, at(opened, 1, 1))).toBe(false)
    expect(canChord(viewOf(toggleFlag(opened, 0)), 3, 4, at(opened, 1, 1))).toBe(true)
  })

  it("counts a mine lying uncovered as marked", () => {
    const opened = click(start, [1, 1])
    const blown = press(opened, 0, { kind: "blast", radius: 0.5 }).board
    expect(canChord(viewOf(blown), 3, 4, at(blown, 1, 1))).toBe(true)
  })

  it("is false for anything that isn't an uncovered number", () => {
    const view = viewOf(toggleFlag(start, 1))
    expect(canChord(view, 3, 4, 0)).toBe(false)
    expect(canChord(view, 3, 4, 1)).toBe(false)
  })

  it("agrees with the engine on every cell of a board in the middle of a game", () => {
    const { field, opening } = generateField({ rows: 16, cols: 16, mines: 40 }, seedFrom(21))
    let board = uncover(coveredBoard(field), opening).board
    // flag every mine in the top half, and a few cells that aren't mines
    for (let cell = 0; cell < 128; cell++) {
      if (field.mines[cell] || cell % 37 === 0) board = toggleFlag(board, cell)
    }
    const view = viewOf(board)
    for (let cell = 0; cell < 256; cell++) {
      const ready = board.cells[cell] === UNCOVERED && !field.mines[cell] && knownMinesAround(board, cell) === field.counts[cell]
      expect(canChord(view, 16, 16, cell)).toBe(ready)
    }
  })
})

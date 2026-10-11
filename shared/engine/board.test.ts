import { describe, expect, it } from "vitest"
import { COVERED, FLAGGED, NO_CELL, chord, coverAround, coveredBoard, knownMinesAround, press, toggleFlag, uncover, type Board, type MineRule } from "./board.js"
import { generateField } from "./generate.js"
import { at, boardDrawn, click, draw, seedFrom } from "./testing.js"

const ENDS: MineRule = { kind: "ends" }

// flags one cell after another
const flag = (board: Board, ...cells: [number, number][]): Board =>
  cells.reduce((now, [row, col]) => toggleFlag(now, at(now, row, col)), board)

describe("coveredBoard", () => {
  it("starts with everything covered and nothing counted", () => {
    const board = boardDrawn("*..", "...")
    expect(draw(board)).toEqual(["###", "###"])
    expect(board).toMatchObject({ uncovered: 0, flagged: 0, status: "playing" })
  })
})

describe("uncover", () => {
  it("uncovers a number on its own", () => {
    const { board, mine } = uncover(boardDrawn("*..", "...", "..."), 1)
    expect(draw(board)).toEqual(["#1#", "###", "###"])
    expect(board.uncovered).toBe(1)
    expect(mine).toBe(NO_CELL)
  })

  it("opens up everything around a cell with no mines near it, as far as the numbers", () => {
    const board = click(boardDrawn(
      "*....",
      ".....",
      ".....",
      "....*",
    ), [0, 4])
    expect(draw(board)).toEqual([
      "#1...",
      "11...",
      "...11",
      "...1#",
    ])
    expect(board.uncovered).toBe(18)
    // every cell that isn't a mine: that is the board cleared
    expect(board.status).toBe("won")
  })

  it("doesn't open across a wall of numbers", () => {
    const board = click(boardDrawn(
      "..*..",
      "..*..",
      "..*..",
    ), [1, 0])
    expect(draw(board)).toEqual([
      ".2###",
      ".3###",
      ".2###",
    ])
    expect(board.status).toBe("playing")
  })

  it("leaves flags where they are, even in the middle of what opens up", () => {
    const flagged = flag(boardDrawn("....", "....", "...*"), [0, 1])
    const board = click(flagged, [0, 0])
    expect(draw(board)[0]).toBe(".F..")
    expect(board.flagged).toBe(1)
    expect(board.status).toBe("playing")
  })

  it("loses the board on a mine, and says which", () => {
    const start = boardDrawn("*..", "...")
    const { board, mine } = uncover(start, 0)
    expect(board.status).toBe("lost")
    expect(mine).toBe(0)
    expect(draw(board)).toEqual(["*##", "###"])
    // a mine isn't one of the cells there were to uncover
    expect(board.uncovered).toBe(0)
  })

  it("does nothing to a cell that is flagged or already uncovered, or on a board that is over", () => {
    const start = boardDrawn("*..", "...")
    const flagged = flag(start, [0, 0])
    expect(uncover(flagged, 0).board).toBe(flagged)

    const opened = click(start, [0, 1])
    expect(uncover(opened, 1).board).toBe(opened)

    const lost = uncover(start, 0).board
    expect(uncover(lost, 5).board).toBe(lost)
  })

  it("never changes the board it was given", () => {
    const start = boardDrawn("*..", "...", "...")
    const before = start.cells.slice()
    uncover(start, 8)
    uncover(start, 0)
    expect(start.cells).toEqual(before)
    expect(start).toMatchObject({ uncovered: 0, status: "playing" })
  })

  it("wins once every cell that isn't a mine is uncovered, flags or no flags", () => {
    const board = click(boardDrawn("*.", ".."), [0, 1], [1, 0], [1, 1])
    expect(board.status).toBe("won")
    expect(board.uncovered).toBe(3)
  })
})

describe("toggleFlag", () => {
  it("puts a flag on a covered cell and takes it off again", () => {
    const start = boardDrawn("*..", "...")
    const flagged = toggleFlag(start, 0)
    expect(flagged.cells[0]).toBe(FLAGGED)
    expect(flagged.flagged).toBe(1)
    const back = toggleFlag(flagged, 0)
    expect(back.cells[0]).toBe(COVERED)
    expect(back.flagged).toBe(0)
    expect(start.cells[0]).toBe(COVERED)
  })

  it("does nothing to an uncovered cell, or on a board that is over", () => {
    const opened = click(boardDrawn("*..", "..."), [0, 1])
    expect(toggleFlag(opened, 1)).toBe(opened)
    const lost = click(boardDrawn("*..", "..."), [0, 0])
    expect(toggleFlag(lost, 2)).toBe(lost)
  })
})

describe("knownMinesAround", () => {
  it("counts flags, and mines lying uncovered", () => {
    const start = boardDrawn(
      "*.*",
      "...",
      "*..",
    )
    expect(knownMinesAround(start, 4)).toBe(0)
    const flagged = flag(start, [0, 0], [1, 0])
    expect(knownMinesAround(flagged, 4)).toBe(2)
    // a mine that went off and stayed uncovered, as it does where that isn't the end
    const blown = press(flagged, 2, { kind: "blast", radius: 1 }).board
    expect(knownMinesAround(blown, 4)).toBe(3)
  })
})

describe("chord", () => {
  const start = boardDrawn(
    "*...",
    "....",
    "...*",
  )

  it("uncovers the rest around a number once its mines are flagged", () => {
    const ready = flag(click(start, [1, 1]), [0, 0])
    const { board, mine } = chord(ready, at(ready, 1, 1))
    expect(mine).toBe(NO_CELL)
    // ...and here that opens up the rest of the board
    expect(draw(board)).toEqual([
      "F1..",
      "1111",
      "..1#",
    ])
    expect(board.status).toBe("won")
  })

  it("does nothing while the flags don't match the number", () => {
    const opened = click(start, [1, 1])
    expect(chord(opened, at(opened, 1, 1)).board).toBe(opened)
    const tooMany = flag(opened, [0, 0], [0, 1])
    expect(chord(tooMany, at(tooMany, 1, 1)).board).toBe(tooMany)
  })

  it("does nothing on a covered cell", () => {
    expect(chord(start, 5).board).toBe(start)
  })

  it("uncovers a mine, and loses, when a flag is in the wrong place", () => {
    const wrong = flag(click(start, [1, 1]), [0, 1])
    const { board, mine } = chord(wrong, at(wrong, 1, 1))
    expect(mine).toBe(at(wrong, 0, 0))
    expect(board.status).toBe("lost")
  })

  it("does nothing when everything around the number is already dealt with", () => {
    const done = flag(click(start, [0, 1], [1, 0], [1, 1]), [0, 0])
    const chorded = click(done, [1, 1])
    // nothing left covered around (1,1) but the flag
    expect(chord(chorded, at(chorded, 1, 1)).board).toBe(chorded)
  })

  it("can win the board", () => {
    const board = boardDrawn("*.", "..")
    const ready = flag(click(board, [1, 1]), [0, 0])
    expect(chord(ready, at(ready, 1, 1)).board.status).toBe("won")
  })
})

describe("coverAround", () => {
  const open = click(boardDrawn(
    ".....",
    ".....",
    ".....",
    ".....",
    "....*",
  ), [0, 0])

  it("covers back up what is uncovered within the radius, as the crow flies", () => {
    const board = coverAround(open, at(open, 2, 2), 1.5)
    expect(draw(board)).toEqual([
      ".....",
      ".###.",
      ".###.",
      ".###1",
      "...1#",
    ])
    expect(board.uncovered).toBe(open.uncovered - 9)
  })

  it("is a circle, not a square", () => {
    const board = coverAround(open, at(open, 2, 2), 2)
    expect(draw(board)).toEqual([
      "..#..",
      ".###.",
      "#####",
      ".###1",
      "..#1#",
    ])
  })

  it("stops at the edges of the board", () => {
    const board = coverAround(open, 0, 1)
    expect(draw(board).slice(0, 2)).toEqual(["##...", "#...."])
  })

  it("leaves flags and uncovered mines as they are", () => {
    const start = boardDrawn("*..", "...", "..*")
    const flagged = toggleFlag(click(start, [0, 2]), at(start, 1, 0))
    expect(draw(flagged)).toEqual(["#1.", "F21", "###"])
    // a mine uncovered in a game that goes on
    const blown = { ...uncover(flagged, 0).board, status: "playing" as const }
    const board = coverAround(blown, 0, 5)
    expect(draw(board)).toEqual(["*##", "F##", "###"])
    expect(board.uncovered).toBe(0)
    expect(board.flagged).toBe(1)
  })

  it("gives the same board back when there was nothing to cover", () => {
    const start = boardDrawn("*..", "...")
    expect(coverAround(start, 0, 3)).toBe(start)
  })
})

describe("press", () => {
  const start = boardDrawn(
    "*....",
    ".....",
    ".....",
    ".....",
    ".....",
  )

  it("uncovers a covered cell and chords an uncovered one", () => {
    const opened = press(start, at(start, 1, 1), ENDS).board
    expect(draw(opened)[1]).toBe("#1###")
    const ready = toggleFlag(opened, 0)
    expect(press(ready, at(ready, 1, 1), ENDS).board.uncovered).toBe(24)
  })

  it("ends the game on a mine where the rule is that it does", () => {
    const { board, mine } = press(start, 0, ENDS)
    expect(board.status).toBe("lost")
    expect(mine).toBe(0)
  })

  it("sets the mine off where the rule is that it does: the game goes on, with what was around it covered again", () => {
    // the corner is walled in by mines, so opening the rest doesn't clear the board
    const walled = boardDrawn(
      ".*...",
      "**...",
      ".....",
      ".....",
      ".....",
    )
    const opened = press(walled, at(walled, 4, 4), ENDS).board
    expect(opened.uncovered).toBe(21)
    const { board, mine } = press(opened, 1, { kind: "blast", radius: 2.5 })
    expect(mine).toBe(1)
    expect(board.status).toBe("playing")
    expect(draw(board)).toEqual([
      "#*##.",
      "####.",
      "###..",
      ".....",
      ".....",
    ])
    expect(board.uncovered).toBe(14)
  })

  it("sets a mine off when a chord finds one, and covers up what the chord had just uncovered", () => {
    const wrong = toggleFlag(press(start, at(start, 1, 1), ENDS).board, 1)
    const { board, mine } = press(wrong, at(wrong, 1, 1), { kind: "blast", radius: 2.5 })
    expect(mine).toBe(0)
    expect(board.status).toBe("playing")
    expect(board.uncovered).toBe(0)
    expect(draw(board)[0]).toBe("*F###")
  })

  it("gives the same board back when the click did nothing", () => {
    const flagged = toggleFlag(start, 6)
    expect(press(flagged, 6, ENDS)).toEqual({ board: flagged, mine: NO_CELL })
  })
})

describe("a whole game", () => {
  it("can be cleared by uncovering every cell that isn't a mine, on a board of any size", () => {
    for (const settings of [{ rows: 9, cols: 9, mines: 10 }, { rows: 16, cols: 30, mines: 99 }, { rows: 99, cols: 99, mines: 99 }]) {
      const { field, opening } = generateField(settings, seedFrom(settings.rows))
      let board = uncover(coveredBoard(field), opening).board
      expect(board.uncovered).toBeGreaterThan(8)
      for (let cell = 0; cell < field.mines.length; cell++) {
        if (!field.mines[cell]) board = uncover(board, cell).board
      }
      expect(board.status).toBe("won")
      expect(board.uncovered).toBe(settings.rows * settings.cols - settings.mines)
    }
  })
})

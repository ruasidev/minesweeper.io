import { describe, expect, it } from "vitest"
import { press, toggleFlag } from "../../shared/engine/board"
import { boardDrawn, click } from "../../shared/engine/testing"
import type { OwnGame } from "../../shared/protocol"
import { boardView, isKnownMine, progressOf, readyView, safeCellsOf, viewOfBoard, viewOfGame } from "./boardView"

const SETTINGS = { rows: 2, cols: 3, mines: 1 }

const game = (changes: Partial<OwnGame> = {}): OwnGame => ({
  id: 1, mode: "classic", settings: SETTINGS, opening: { row: 1, col: 2 }, elapsedMs: 0, cells: ".1..10", cooldownMs: 0,
  outcome: "playing", durationMs: null, mineHits: 0, percent: 60, layout: null, ...changes,
})

describe("boardView", () => {
  it("counts what is uncovered, flagged, and lying open as a mine", () => {
    const view = boardView(SETTINGS, "F1*.10", "playing")
    expect(view).toMatchObject({ rows: 2, cols: 3, mines: 1, status: "playing", uncovered: 3, flagged: 1, openMines: 1, layout: null })
  })

  it("starts a board nobody has played on with everything covered", () => {
    const view = readyView(SETTINGS)
    expect(view).toMatchObject({ status: "ready", cells: "......", uncovered: 0, flagged: 0, openMines: 0 })
  })
})

describe("viewOfGame", () => {
  it("is being played until the game says otherwise", () => {
    expect(viewOfGame(game()).status).toBe("playing")
    // stopped without clearing it isn't a win or a loss to play out over the board
    for (const outcome of ["gaveUp", "timedOut", "left"] as const) expect(viewOfGame(game({ outcome })).status).toBe("playing")
  })

  it("is won once cleared, and lost on a mine where that ends it", () => {
    expect(viewOfGame(game({ outcome: "cleared" })).status).toBe("won")
    expect(viewOfGame(game({ outcome: "lost", cells: "*1..10" })).status).toBe("lost")
  })

  it("carries where the mines were, once the server has said", () => {
    expect(viewOfGame(game()).layout).toBeNull()
    expect(viewOfGame(game({ outcome: "lost", cells: "*1..10", layout: "100000" })).layout).toBe("100000")
  })
})

describe("viewOfBoard", () => {
  it("is the board as its player sees it, with the mines known underneath", () => {
    const board = toggleFlag(click(boardDrawn("*..", "..."), [1, 2]), 0)
    const view = viewOfBoard(board)
    expect(view).toMatchObject({ rows: 2, cols: 3, mines: 1, status: "playing", cells: "F10.10", layout: "100000", flagged: 1, uncovered: 4 })
  })

  it("follows the board's own end", () => {
    const start = boardDrawn("*..", "...")
    expect(viewOfBoard(press(start, 0, { kind: "ends" }).board).status).toBe("lost")
    expect(viewOfBoard(click(start, [0, 2], [1, 0])).status).toBe("won")
  })
})

describe("isKnownMine", () => {
  it("is a mine that has been uncovered, or one the layout tells of", () => {
    const secret = boardView(SETTINGS, "*.....", "playing")
    expect(isKnownMine(secret, 0)).toBe(true)
    expect(isKnownMine(secret, 1)).toBe(false)
    const told = boardView(SETTINGS, "......", "lost", "000001")
    expect(isKnownMine(told, 5)).toBe(true)
    expect(isKnownMine(told, 0)).toBe(false)
  })
})

describe("progressOf", () => {
  it("counts every cell dealt with, uncovered or flagged, out of the whole board", () => {
    expect(progressOf(readyView(SETTINGS))).toBe(0)
    expect(progressOf(boardView(SETTINGS, "F1..10", "playing"))).toBe(67)
    expect(progressOf(boardView(SETTINGS, "F11110", "won"))).toBe(100)
  })
})

describe("safeCellsOf", () => {
  it("is every cell that isn't a mine", () => {
    expect(safeCellsOf({ rows: 16, cols: 30, mines: 99 })).toBe(381)
  })
})

import { describe, expect, it } from "vitest"
import { BEGINNER_BOARD } from "../../shared/game/boards"
import { layoutOf } from "../../shared/game/game"
import { clickLocalGame, flagLocalGame, startLocalGame } from "./localGame"

const NOW = 50_000
const opening = { row: 4, col: 4 }

// the cells of a game that are (or aren't) mines and still covered
function covered(local: ReturnType<typeof startLocalGame>, mines: boolean) {
  const layout = layoutOf(local.game)
  return [...layout].flatMap((cell, at) =>
    (cell === "1") === mines && local.live.cells[at] === "." ? [[Math.floor(at / BEGINNER_BOARD.cols), at % BEGINNER_BOARD.cols] as const] : [])
}

describe("a game played in the browser", () => {
  it("starts with its first click, with the clock running from there", () => {
    const local = startLocalGame("classic", BEGINNER_BOARD, opening, NOW)
    expect(local.live).toMatchObject({ mode: "classic", settings: BEGINNER_BOARD, opening, outcome: "playing", startedAt: NOW, durationMs: null, layout: null })
    expect(local.live.cells[4 * 9 + 4]).toBe("0")
  })

  it("is a different board every time", () => {
    const layouts = new Set(Array.from({ length: 5 }, () => layoutOf(startLocalGame("classic", BEGINNER_BOARD, opening, NOW).game)))
    expect(layouts.size).toBe(5)
  })

  it("is reported just as the server reports its games: a new report after every move that did something", () => {
    const local = startLocalGame("classic", BEGINNER_BOARD, opening, NOW)
    const [row, col] = covered(local, false)[0]
    const moved = clickLocalGame(local, row, col, NOW + 1000)
    expect(moved).not.toBe(local)
    expect(moved.live.cells).not.toBe(local.live.cells)
    // the report it replaced is as it was
    expect(local.live.cells[row * 9 + col]).toBe(".")
  })

  it("gives the same report back for a click that did nothing", () => {
    const local = startLocalGame("classic", BEGINNER_BOARD, opening, NOW)
    const [row, col] = covered(local, true)[0]
    const flagged = flagLocalGame(local, row, col, NOW + 500)
    expect(flagged.live.cells[row * 9 + col]).toBe("F")
    expect(clickLocalGame(flagged, row, col, NOW + 1000)).toBe(flagged)
    expect(flagLocalGame(flagged, 4, 4, NOW + 1000)).toBe(flagged)
  })

  it("ends at the first mine, and then shows where the rest were", () => {
    const local = startLocalGame("classic", BEGINNER_BOARD, opening, NOW)
    const [row, col] = covered(local, true)[0]
    const lost = clickLocalGame(local, row, col, NOW + 7000)
    expect(lost.live).toMatchObject({ outcome: "lost", durationMs: 7000, mineHits: 1, layout: layoutOf(local.game) })
  })

  it("is won by uncovering everything else", () => {
    let local = startLocalGame("classic", BEGINNER_BOARD, opening, NOW)
    for (const [row, col] of covered(local, false)) {
      if (local.live.cells[row * 9 + col] === ".") local = clickLocalGame(local, row, col, NOW + 30_000)
    }
    expect(local.live).toMatchObject({ outcome: "cleared", durationMs: 30_000, percent: 100 })
  })
})

import { describe, expect, it } from "vitest"
import { press, toggleFlag } from "../../shared/engine/board"
import { at, boardDrawn } from "../../shared/engine/testing"
import { viewOf } from "../../shared/engine/view"
import { blastBetween } from "./blast"

describe("blastBetween", () => {
  it("is nothing when the board changed some other way", () => {
    expect(blastBetween("....", "....", 2)).toBeNull()
    expect(blastBetween("....", ".1..", 2)).toBeNull()
    expect(blastBetween("....", "F...", 2)).toBeNull()
  })

  it("finds the mine that went off and the cells it covered back up", () => {
    //  11.      *#.
    //  ...  ->  ##.
    const blast = blastBetween(".11" + "000", "*.1" + "..0", 3)!
    expect(blast).toMatchObject({ row: 0, col: 0 })
    expect([...blast.covered].sort()).toEqual(["0,1", "1,0", "1,1"])
  })

  it("doesn't count a flag coming off as a cell covered up", () => {
    const blast = blastBetween("F1", "*.", 2)!
    expect([...blast.covered]).toEqual(["0,1"])
  })

  it("gives every blast a number of its own, so one in the same place as the last still plays", () => {
    const first = blastBetween("..", "*.", 2)!
    const second = blastBetween("..", "*.", 2)!
    expect(second.id).not.toBe(first.id)
  })

  it("is nothing between two boards of different sizes", () => {
    expect(blastBetween("....", "*........", 3)).toBeNull()
  })

  it("agrees with the engine about a real mine going off", () => {
    const start = boardDrawn(
      ".*...",
      "**...",
      ".....",
      ".....",
      ".....",
    )
    const opened = press(start, at(start, 4, 4), { kind: "ends" }).board
    const flagged = toggleFlag(opened, 0)
    const blown = press(flagged, 1, { kind: "blast", radius: 2.5 }).board
    const blast = blastBetween(viewOf(flagged), viewOf(blown), 5)!
    expect(blast).toMatchObject({ row: 0, col: 1 })
    expect(blast.covered.size).toBe(opened.uncovered - blown.uncovered)
    expect(blast.covered.has("0,0")).toBe(false)
  })
})

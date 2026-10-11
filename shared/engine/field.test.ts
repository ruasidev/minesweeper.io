import { describe, expect, it } from "vitest"
import { cellAt, colOf, fieldFromLayout, fieldOf, forEachNeighbour, isOnBoard, layoutText, rowOf, safeCells } from "./field.js"
import { fieldDrawn, layoutDrawn } from "./testing.js"

const neighbours = (rows: number, cols: number, at: number): number[] => {
  const found: number[] = []
  forEachNeighbour(rows, cols, at, neighbour => found.push(neighbour))
  return found
}

describe("cells", () => {
  it("are numbered row after row", () => {
    expect(cellAt(5, 0, 0)).toBe(0)
    expect(cellAt(5, 2, 3)).toBe(13)
    expect([rowOf(5, 13), colOf(5, 13)]).toEqual([2, 3])
  })

  it("are on the board only at whole rows and columns inside it", () => {
    const board = { rows: 3, cols: 4 }
    expect(isOnBoard(board, 0, 0)).toBe(true)
    expect(isOnBoard(board, 2, 3)).toBe(true)
    for (const [row, col] of [[3, 0], [0, 4], [-1, 0], [0, -1], [1.5, 1], [NaN, 0]]) expect(isOnBoard(board, row, col)).toBe(false)
    expect(isOnBoard(board, "1" as unknown as number, 1)).toBe(false)
  })
})

describe("forEachNeighbour", () => {
  it("gives the eight cells around one in the middle, row after row", () => {
    expect(neighbours(3, 3, 4)).toEqual([0, 1, 2, 3, 5, 6, 7, 8])
  })

  it("stops at the edges of the board", () => {
    expect(neighbours(3, 3, 0)).toEqual([1, 3, 4])
    expect(neighbours(3, 3, 5)).toEqual([1, 2, 4, 7, 8])
    expect(neighbours(1, 4, 1)).toEqual([0, 2])
    expect(neighbours(1, 1, 0)).toEqual([])
  })
})

describe("fieldOf", () => {
  it("counts the mines around every cell", () => {
    const field = fieldDrawn(
      "*..",
      "...",
      "..*",
    )
    expect(field.mineCount).toBe(2)
    expect(safeCells(field)).toBe(7)
    expect([...field.counts]).toEqual([
      0, 1, 0,
      1, 2, 1,
      0, 1, 0,
    ])
  })

  it("counts a mine's own neighbours as well, mines among them", () => {
    const field = fieldDrawn("**.")
    expect([...field.counts]).toEqual([1, 1, 1])
  })

  it("turns down mines that aren't the size of the board", () => {
    expect(() => fieldOf(2, 2, new Uint8Array(3))).toThrow(RangeError)
  })
})

describe("a layout as text", () => {
  it("is a 1 for every mine and a 0 for everything else", () => {
    expect(layoutText(fieldDrawn("*..", "..*").mines)).toBe("100001")
  })

  it("comes back as the field it was", () => {
    const drawn = fieldDrawn(
      ".*..",
      "....",
      "*..*",
    )
    const back = fieldFromLayout(3, 4, layoutText(drawn.mines))
    expect(back).toEqual(drawn)
    expect(layoutText(back.mines)).toBe(layoutDrawn(".*..", "....", "*..*"))
  })
})

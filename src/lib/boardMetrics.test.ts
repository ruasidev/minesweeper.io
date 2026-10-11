import type { CSSProperties } from "react"
import { describe, expect, it } from "vitest"
import { boxAround, cellBox, dotIn } from "./boardMetrics"

// These place things over a board in the board's own units, so the tests work them out for one size of cell
// (40 with a gap of 2, so a step of 42) and check the sums come to where the thing should be
function at(style: CSSProperties) {
  const px = (value: unknown) =>
    Function(`return ${String(value).replaceAll("calc", "").replaceAll("var(--cell-step)", "42").replaceAll("var(--cell-size)", "40")}`)() as number
  return { top: px(style.top), left: px(style.left), width: px(style.width), height: px(style.height) }
}

describe("cellBox", () => {
  it("is the box of one cell", () => {
    expect(at(cellBox(0, 0))).toEqual({ top: 0, left: 0, width: 40, height: 40 })
    expect(at(cellBox(2, 5))).toEqual({ top: 84, left: 210, width: 40, height: 40 })
  })
})

describe("boxAround", () => {
  it("is a square centred on the middle of a cell", () => {
    const box = at(boxAround(3, 4, 5))
    expect(box.width).toBe(210)
    expect(box.height).toBe(210)
    // the middle of cell (3, 4) is 20 in from its corner at (126, 168)
    expect(box.top + box.height / 2).toBe(3 * 42 + 20)
    expect(box.left + box.width / 2).toBe(4 * 42 + 20)
  })
})

describe("dotIn", () => {
  it("is a dot in the middle of a cell, a share of the cell across", () => {
    const dot = at(dotIn(1, 2, 0.5))
    expect(dot.width).toBe(20)
    expect(dot.top + dot.height / 2).toBe(42 + 20)
    expect(dot.left + dot.width / 2).toBe(84 + 20)
  })
})

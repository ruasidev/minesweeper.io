import { describe, expect, it } from "vitest"
import { BOARD_EDGE, FIT_MIN, boardSpan, fittedSize } from "./boardFit"

describe("boardSpan", () => {
  it("is the cells and the gaps between them", () => {
    expect(boardSpan(9, 40, 2)).toBe(376)
    expect(boardSpan(1, 40, 2)).toBe(40)
    expect(boardSpan(30, 32, 0)).toBe(960)
  })
})

describe("fittedSize", () => {
  const phone = { width: 390, height: 560 }

  it("is the size chosen where the whole board fits at that", () => {
    expect(fittedSize(40, 2, 9, 9, { width: 800, height: 800 })).toBe(40)
  })

  it("is the size chosen while the space hasn't been measured", () => {
    expect(fittedSize(40, 2, 16, 30, { width: 0, height: 0 })).toBe(40)
  })

  it("shrinks a board to fit, both ways, while the cells stay big enough to press", () => {
    const size = fittedSize(40, 2, 9, 9, phone)
    expect(size).toBe(39)
    expect(boardSpan(9, size, 2) + 2 * BOARD_EDGE).toBeLessThanOrEqual(phone.width)
    expect(boardSpan(9, size + 1, 2) + 2 * BOARD_EDGE).toBeGreaterThan(phone.width)
  })

  it("fits a board one way when both would make the cells too small, so it is panned only the other", () => {
    // Expert on a phone: thirty columns would need cells of 10px, but sixteen rows fit at 32
    const size = fittedSize(40, 2, 16, 30, phone)
    expect(size).toBe(32)
    expect(size).toBeGreaterThanOrEqual(FIT_MIN)
    expect(boardSpan(16, size, 2) + 2 * BOARD_EDGE).toBeLessThanOrEqual(phone.height)
  })

  it("leaves a board at the size chosen when no way of fitting it keeps the cells big enough", () => {
    expect(fittedSize(40, 2, 99, 99, phone)).toBe(40)
  })

  it("never makes the cells bigger than chosen, however much room there is", () => {
    expect(fittedSize(24, 2, 4, 4, { width: 2000, height: 2000 })).toBe(24)
  })
})

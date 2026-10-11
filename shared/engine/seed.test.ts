import { describe, expect, it } from "vitest"
import { generateBoard } from "./generate.js"
import { SEED_BYTES, randomSeed } from "./seed.js"

describe("randomSeed", () => {
  it("gives a seed of the right length, and a different one every time", () => {
    const [first, second] = [randomSeed(), randomSeed()]
    expect(first).toHaveLength(SEED_BYTES)
    expect(second).toHaveLength(SEED_BYTES)
    expect(first).not.toEqual(second)
  })

  it("gives a seed a board can be made from", () => {
    expect(() => generateBoard({ rows: 9, cols: 9, mines: 10 }, randomSeed())).not.toThrow()
  })
})

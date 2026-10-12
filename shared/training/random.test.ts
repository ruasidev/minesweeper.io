import { describe, expect, it } from "vitest"
import { seedFrom } from "../engine/testing.js"
import { randomFrom } from "./random.js"

describe("randomFrom", () => {
  it("gives the same numbers from the same seed, and others from another", () => {
    const run = (first: number) => {
      const random = randomFrom(seedFrom(first))
      return Array.from({ length: 20 }, () => random.below(1000))
    }
    expect(run(1)).toEqual(run(1))
    expect(run(1)).not.toEqual(run(2))
  })

  it("keeps within what it is asked for", () => {
    const random = randomFrom(seedFrom(3))
    const seen = new Set<number>()
    for (let draw = 0; draw < 2000; draw++) {
      const number = random.between(2, 5)
      expect(number).toBeGreaterThanOrEqual(2)
      expect(number).toBeLessThanOrEqual(5)
      seen.add(number)
      expect(random.below(1)).toBe(0)
      expect(["a", "b"]).toContain(random.pick(["a", "b"]))
    }
    expect(seen.size).toBe(4)
  })

  it("is true about as often as it is asked to be", () => {
    const random = randomFrom(seedFrom(4))
    let yes = 0
    for (let draw = 0; draw < 10_000; draw++) yes += random.chance(0.25) ? 1 : 0
    expect(yes).toBeGreaterThan(2300)
    expect(yes).toBeLessThan(2700)
    expect(random.chance(0)).toBe(false)
    expect(random.chance(1)).toBe(true)
  })

  it("makes something of a seed of all zeroes, and refuses one of the wrong length", () => {
    const random = randomFrom(new Uint8Array(16))
    expect(new Set(Array.from({ length: 20 }, () => random.below(1000))).size).toBeGreaterThan(10)
    expect(() => randomFrom(new Uint8Array(8))).toThrow(RangeError)
  })
})

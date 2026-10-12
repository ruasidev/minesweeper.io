import { describe, expect, it } from "vitest"
import { MINE, SAFE, UNKNOWN, proves, provesAnything, type Reach } from "./logic.js"
import { FAMILIES, PATTERNS, PATTERN_IDS, isPatternId, patternOf } from "./patterns.js"
import { numberLetter } from "./template.js"
import { bare } from "./trial.js"

// the reasoning one step short of what a pattern takes
const WEAKER: Partial<Record<Reach, Reach>> = { pairs: "counting", everything: "pairs" }

describe("the catalogue", () => {
  it("has every pattern once, in a family there is, under a name of its own", () => {
    expect(PATTERNS.map(pattern => pattern.id)).toEqual([...PATTERN_IDS])
    expect(new Set(PATTERNS.map(pattern => pattern.name)).size).toBe(PATTERNS.length)
    for (const pattern of PATTERNS) {
      expect(FAMILIES[pattern.family], pattern.id).toBeDefined()
      // a pattern is its shapes, unless it is one about the count of mines, which has none
      expect(pattern.shapes.length > 0, pattern.id).toBe(pattern.counted === undefined)
      expect(patternOf(pattern.id).name).toBe(pattern.name)
    }
  })

  it("lists them a family at a time", () => {
    const order = PATTERNS.map(pattern => pattern.family).filter((family, index, all) => family !== all[index - 1])
    expect(new Set(order).size).toBe(order.length)
  })

  it("knows an id that is one from something that isn't", () => {
    expect(isPatternId("oneTwo")).toBe(true)
    expect(isPatternId("twoOne")).toBe(false)
    expect(isPatternId(3)).toBe(false)
  })
})

// Every shape of every pattern, held to the solver: this is what makes the catalogue something to be trusted
describe.each(PATTERNS.flatMap(pattern => pattern.shapes.map((shape, index) => ({ pattern, shape, title: `${pattern.name}, shape ${index + 1}` }))))("$title", ({ pattern, shape }) => {
  const { template } = shape
  const { position, covered } = bare(template)
  const drawn = new Uint8Array(position.cells.length)
  template.covered.forEach((cell, index) => {
    drawn[covered[index]] = cell.proven === "mine" ? MINE : cell.proven === "safe" ? SAFE : UNKNOWN
  })

  it("proves exactly the cells it is drawn as proving, by the reasoning it is said to take", () => {
    expect(Array.from(proves(position, pattern.needs))).toEqual(Array.from(drawn))
    // ...and nothing more by any reasoning at all
    expect(Array.from(proves(position, "everything"))).toEqual(Array.from(drawn))
    expect(provesAnything(drawn)).toBe(true)
  })

  it("is not to be had by anything weaker", () => {
    const weaker = WEAKER[pattern.needs]
    if (weaker) expect(provesAnything(proves(position, weaker))).toBe(false)
  })

  it("has numbers that flags can make sense of", () => {
    // a number that needs nothing shows only its flags, so it has to be a pattern that has them
    if (template.numbers.some(number => number.needs === 0)) expect(pattern.flags).toBe("always")
  })

  it("is explained by steps that point at what is there, and end on what it proves", () => {
    const letters = template.numbers.map((_, index) => numberLetter(index))
    const groups = new Set(template.covered.map(cell => cell.group))
    const proven = new Set(template.covered.map(cell => cell.proven))
    const pointedAt = new Set<string>()
    for (const step of shape.steps) {
      if ("number" in step) {
        expect(letters).toContain(step.number)
        continue
      }
      expect(step.says.length).toBeGreaterThan(0)
      pointedAt.add(step.cells)
      if (step.cells === "*") expect(proven.has("mine")).toBe(true)
      else if (step.cells === "s") expect(proven.has("safe")).toBe(true)
      else if (step.cells === "?") expect(proven.has("nothing")).toBe(true)
      else for (const letter of step.cells) expect(groups.has(letter)).toBe(true)
    }
    if (proven.has("mine")) expect(pointedAt.has("*")).toBe(true)
    if (proven.has("safe")) expect(pointedAt.has("s")).toBe(true)
  })
})

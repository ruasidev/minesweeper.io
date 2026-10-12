import { describe, expect, it } from "vitest"
import { seedFrom } from "../engine/testing.js"
import { matchesOf, patternsIn } from "./match.js"
import { PATTERNS, patternOf } from "./patterns.js"
import { randomFrom } from "./random.js"
import { positionDrawn } from "./testing.js"
import { makeTrial, positionOf, type Stage } from "./trial.js"

const sorted = (cells: number[]) => [...cells].sort((a, b) => a - b)

describe("matchesOf", () => {
  it("finds a pattern where it lies, whichever way up", () => {
    const position = positionDrawn(
      "###.",
      "12..",
      "....",
    )
    expect(matchesOf(position, patternOf("oneTwo"))).toEqual([{ pattern: "oneTwo", shape: 0, numbers: [4, 5], covered: [0, 1, 2], flagged: false }])
    const turnedAbout = positionDrawn(
      "#1.",
      "#2.",
      "#..",
    )
    expect(matchesOf(turnedAbout, patternOf("oneTwo"))).toMatchObject([{ numbers: [1, 4], covered: [0, 3, 6] }])
  })

  it("finds it once, however many ways up it looks the same", () => {
    const position = positionDrawn(
      "#####",
      ".121.",
      ".....",
    )
    expect(matchesOf(position, patternOf("oneTwoOne"))).toHaveLength(1)
  })

  it("isn't taken in by numbers that touch more, or need more, than the pattern has them", () => {
    // the 1 touches a third covered cell here: it is no longer the 1 of a 1-2 from a wall
    expect(matchesOf(positionDrawn("####", "#12.", "...."), patternOf("oneTwo"))).toEqual([])
    expect(matchesOf(positionDrawn("###.", "13..", "...."), patternOf("oneTwo"))).toEqual([])
    expect(matchesOf(positionDrawn("###.", "12#.", "...."), patternOf("oneTwo"))).toEqual([])
  })

  it("finds a pattern behind flags, and says so; and a pattern about flags only where there are some", () => {
    const plain = positionDrawn("###.", "12..", "....")
    const flagged = positionDrawn("###.", "23..", "F...")
    expect(matchesOf(plain, patternOf("oneTwo"))).toMatchObject([{ flagged: false }])
    expect(matchesOf(flagged, patternOf("oneTwo"))).toMatchObject([{ numbers: [4, 5], covered: [0, 1, 2], flagged: true }])
    expect(matchesOf(plain, patternOf("oneTwoR"))).toEqual([])
    expect(matchesOf(flagged, patternOf("oneTwoR"))).toMatchObject([{ numbers: [4, 5], covered: [0, 1, 2], flagged: true }])
  })
})

describe("patternsIn", () => {
  it("finds every round's pattern on the round's own board, where it was put", () => {
    // (but for the patterns about the count of mines, which have no shape to be found)
    for (const pattern of PATTERNS.filter(pattern => !pattern.counted)) {
      for (const stage of [0, 1, 2] as Stage[]) {
        const trial = makeTrial(pattern, stage, randomFrom(seedFrom(stage * 31 + 5)))
        const found = patternsIn(positionOf(trial.board)).filter(match => match.pattern === pattern.id)
        const here = found.find(match => String(sorted(match.numbers)) === String(sorted(trial.numbers)))
        expect(here, pattern.name).toBeDefined()
        expect(sorted(here!.covered)).toEqual(sorted(trial.covered))
      }
    }
  })
})

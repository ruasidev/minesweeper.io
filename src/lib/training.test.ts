// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { review } from "../../shared/training/schedule"
import { clearLocalDeck, formatSeconds, loadLocalDeck, saveLocalDeck, suggestedGrade } from "./training"

describe("a visitor's deck", () => {
  it("is empty until something is kept, and is what was kept after", () => {
    expect(loadLocalDeck()).toEqual({})
    const deck = { oneTwo: review(null, "good", 1_800_000_000_000) }
    saveLocalDeck(deck)
    expect(loadLocalDeck()).toEqual(deck)
    clearLocalDeck()
    expect(loadLocalDeck()).toEqual({})
  })

  it("leaves out whatever isn't a card of a pattern there is", () => {
    const card = review(null, "easy", 1_800_000_000_000)
    localStorage.setItem("trainingPatterns", JSON.stringify({ oneTwo: card, oneNine: card, oneOne: { ...card, ease: "high" }, allSafe: null }))
    expect(loadLocalDeck()).toEqual({ oneTwo: card })
  })

  it("is empty where what was kept can't be read at all", () => {
    for (const kept of ["not json", "[]", "3", "null"]) {
      localStorage.setItem("trainingPatterns", kept)
      expect(loadLocalDeck()).toEqual({})
    }
  })
})

describe("suggestedGrade", () => {
  it("takes a quick round to have been easy, a slow one hard, and anything between good", () => {
    expect(suggestedGrade(1500, 1)).toBe("easy")
    expect(suggestedGrade(4000, 1)).toBe("good")
    expect(suggestedGrade(9000, 1)).toBe("hard")
  })

  it("allows longer where there were more cells to mark", () => {
    expect(suggestedGrade(3500, 1)).toBe("good")
    expect(suggestedGrade(3500, 3)).toBe("easy")
    expect(suggestedGrade(9000, 3)).toBe("good")
  })
})

describe("formatSeconds", () => {
  it("gives a time to the tenth of a second", () => {
    expect(formatSeconds(2430)).toBe("2.4 s")
    expect(formatSeconds(980)).toBe("0.9 s")
    expect(formatSeconds(12_000)).toBe("12.0 s")
  })
})

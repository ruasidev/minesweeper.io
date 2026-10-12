import { describe, expect, it } from "vitest"
import { DAY_MS, INTERVAL_MAX_DAYS, MINUTE_MS, isCard, isGrade, isLearned, isMastered, review, waitText, waits, type Card, type Grade } from "./schedule.js"

const NOW = 1_800_000_000_000

// a card answered one way after another, each answer at the moment the card came due
const answered = (...grades: Grade[]): Card => {
  let card: Card | null = null
  let now = NOW
  for (const grade of grades) {
    card = review(card, grade, now)
    now = card.due
  }
  return card!
}

// a known pattern with so many days between reviews, last answered so many days ago
const known = (interval: number, daysAgo: number, ease = 2.5): Card =>
  ({ phase: "review", step: 0, interval, ease, reviews: 5, lapses: 0, last: NOW - daysAgo * DAY_MS, due: NOW + (interval - daysAgo) * DAY_MS })

describe("a new pattern", () => {
  it("comes back in a minute if it was missed, and starts its steps again", () => {
    expect(review(null, "again", NOW)).toEqual({ phase: "learning", step: 0, due: NOW + MINUTE_MS, last: NOW, interval: 0, ease: 2.5, reviews: 1, lapses: 0 })
    expect(answered("good", "again")).toMatchObject({ phase: "learning", step: 0 })
  })

  it("is known after two good answers, ten minutes apart, and comes back the next day", () => {
    const once = review(null, "good", NOW)
    expect(once).toMatchObject({ phase: "learning", step: 1, due: NOW + 10 * MINUTE_MS })
    expect(review(once, "good", once.due)).toMatchObject({ phase: "review", step: 0, interval: 1, due: once.due + DAY_MS, reviews: 2 })
  })

  it("is known straight away if it was easy, and comes back in four days", () => {
    expect(review(null, "easy", NOW)).toMatchObject({ phase: "review", interval: 4, due: NOW + 4 * DAY_MS, ease: 2.5 })
  })

  it("has its step over again if it was hard: for the first step, something between it and the next", () => {
    expect(review(null, "hard", NOW)).toMatchObject({ phase: "learning", step: 0, due: NOW + 5.5 * MINUTE_MS })
    const second = review(null, "good", NOW)
    expect(review(second, "hard", NOW)).toMatchObject({ phase: "learning", step: 1, due: NOW + 10 * MINUTE_MS })
  })

  it("keeps its ease while it is being learned, whatever the answers", () => {
    expect(answered("again", "hard", "good", "again", "good", "good").ease).toBe(2.5)
  })
})

describe("a known pattern, answered when it is due", () => {
  it("is put off by its ease for Good", () => {
    expect(review(known(10, 10), "good", NOW)).toMatchObject({ phase: "review", interval: 25, ease: 2.5, due: NOW + 25 * DAY_MS, last: NOW })
  })

  it("is put off by less for Hard and more for Easy, and its ease moves with them", () => {
    expect(review(known(10, 10), "hard", NOW)).toMatchObject({ interval: 12, ease: 2.35 })
    const easy = review(known(10, 10), "easy", NOW)
    expect(easy.interval).toBe(33)
    expect(easy.ease).toBeCloseTo(2.65)
  })

  it("always comes back later than it did, however little it is multiplied by", () => {
    expect(review(known(1, 1), "hard", NOW).interval).toBe(2)
    expect(review(known(2, 2, 1.3), "good", NOW).interval).toBe(3)
  })

  it("goes back to being learned if it is missed: ten minutes, then half the interval it had", () => {
    const missed = review(known(10, 10), "again", NOW)
    expect(missed).toMatchObject({ phase: "relearning", step: 0, interval: 5, lapses: 1, due: NOW + 10 * MINUTE_MS })
    expect(missed.ease).toBeCloseTo(2.3)
    expect(review(missed, "good", missed.due)).toMatchObject({ phase: "review", interval: 5, due: missed.due + 5 * DAY_MS })
    expect(review(missed, "easy", missed.due)).toMatchObject({ phase: "review", interval: 6 })
    expect(review(missed, "again", missed.due)).toMatchObject({ phase: "relearning", step: 0, lapses: 1 })
  })

  it("never has its ease fall through the floor, or its interval go past the longest there is", () => {
    let card = known(10, 10, 1.4)
    for (let miss = 0; miss < 5; miss++) card = review({ ...card, phase: "review" }, "again", NOW)
    expect(card.ease).toBe(1.3)
    expect(card.interval).toBe(1)
    expect(review(known(80, 80), "easy", NOW).interval).toBe(INTERVAL_MAX_DAYS)
  })
})

describe("a known pattern, answered late or early", () => {
  it("is given credit for the days it was late by: all of them for Easy, half for Good, a quarter for Hard", () => {
    expect(review(known(10, 20), "easy", NOW).interval).toBe(65)
    expect(review(known(10, 20), "good", NOW).interval).toBe(38)
    expect(review(known(10, 20), "hard", NOW).interval).toBe(15)
  })

  it("is given credit only for the days that have gone by, when it is answered ahead of time", () => {
    // a day into ten: a day's worth of remembering, which multiplies up to less than the ten it already had
    expect(review(known(10, 1), "good", NOW)).toMatchObject({ interval: 10, due: NOW + 10 * DAY_MS })
    expect(review(known(10, 1), "easy", NOW).interval).toBe(10)
    // six days into ten is enough to earn more
    expect(review(known(10, 6), "good", NOW).interval).toBe(15)
  })

  it("is missed just the same, early or not", () => {
    expect(review(known(10, 1), "again", NOW)).toMatchObject({ phase: "relearning", interval: 5 })
  })
})

describe("waits", () => {
  it("says how long each answer would put a card off for", () => {
    expect(waits(null, NOW)).toEqual({ again: MINUTE_MS, hard: 5.5 * MINUTE_MS, good: 10 * MINUTE_MS, easy: 4 * DAY_MS })
    expect(waits(known(10, 10), NOW)).toEqual({ again: 10 * MINUTE_MS, hard: 12 * DAY_MS, good: 25 * DAY_MS, easy: 33 * DAY_MS })
  })

  it("is put in a couple of words", () => {
    expect(waitText(MINUTE_MS)).toBe("1 min")
    expect(waitText(5.5 * MINUTE_MS)).toBe("6 min")
    expect(waitText(10 * MINUTE_MS)).toBe("10 min")
    expect(waitText(3 * 3_600_000)).toBe("3 h")
    expect(waitText(DAY_MS)).toBe("tomorrow")
    expect(waitText(4 * DAY_MS)).toBe("4 days")
  })
})

describe("what a card is", () => {
  it("is learned once it is through its steps, and mastered once it is three weeks between reviews", () => {
    expect(isLearned(null)).toBe(false)
    expect(isLearned(review(null, "good", NOW))).toBe(false)
    expect(isLearned(answered("good", "good"))).toBe(true)
    expect(isLearned(review(known(10, 10), "again", NOW))).toBe(true)
    expect(isMastered(known(20, 0))).toBe(false)
    expect(isMastered(known(21, 0))).toBe(true)
    expect(isMastered(review(known(60, 60), "again", NOW))).toBe(false)
  })

  it("is told from something that only looks like one", () => {
    for (const card of [review(null, "again", NOW), answered("good", "good"), answered("easy", "good", "again"), known(90, 3)]) expect(isCard(card)).toBe(true)
    const card = known(10, 3)
    for (const wrong of [null, "card", {}, { ...card, phase: "new" }, { ...card, interval: 0 }, { ...card, interval: 1e9 }, { ...card, ease: 0 },
      { ...card, due: "soon" }, { ...card, step: 4 }, { ...card, reviews: -1 }, { ...card, lapses: 1.5 }, { ...review(null, "good", NOW), interval: 3 }]) {
      expect(isCard(wrong)).toBe(false)
    }
  })

  it("knows an answer from something that isn't one", () => {
    expect(isGrade("good")).toBe(true)
    expect(isGrade("perfect")).toBe(false)
    expect(isGrade(3)).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import { PATTERN_IDS } from "./patterns.js"
import { LEARNING_MAX, nextDue, nextUp, stageOf, tally, type Deck } from "./queue.js"
import { DAY_MS, MINUTE_MS, review, type Card } from "./schedule.js"

const NOW = 1_800_000_000_000
const [first, second, third, fourth, fifth] = PATTERN_IDS

// a pattern being learned, with its step due so many minutes from now
const learning = (dueInMinutes: number): Card => ({ ...review(null, "good", NOW), due: NOW + dueInMinutes * MINUTE_MS })
// a known pattern, due so many days from now
const known = (dueInDays: number, interval = 5): Card =>
  ({ phase: "review", step: 0, interval, ease: 2.5, reviews: 4, lapses: 0, last: NOW - DAY_MS, due: NOW + dueInDays * DAY_MS })

describe("nextUp", () => {
  it("starts a player who has met nothing on the first pattern in the catalogue", () => {
    expect(nextUp({}, NOW)).toEqual({ pattern: first, card: null, why: "new" })
  })

  it("takes a step of learning that is due before a review that is due, and either before anything new", () => {
    const deck: Deck = { [first]: known(-2), [second]: learning(-1) }
    expect(nextUp(deck, NOW)).toMatchObject({ pattern: second, why: "learning" })
    expect(nextUp({ [first]: known(-2) }, NOW)).toMatchObject({ pattern: first, why: "review" })
    expect(nextUp({ [first]: known(2) }, NOW)).toMatchObject({ pattern: second, why: "new" })
  })

  it("takes the review that has been due the longest first", () => {
    const deck: Deck = { [first]: known(-1), [second]: known(-6), [third]: known(-3) }
    expect(nextUp(deck, NOW)?.pattern).toBe(second)
  })

  it("brings in nothing new while enough patterns are still being learned", () => {
    expect(LEARNING_MAX).toBe(3)
    const two: Deck = { [first]: learning(5), [second]: learning(8) }
    expect(nextUp(two, NOW)).toMatchObject({ pattern: third, why: "new" })
    // with three in hand there is no room: the one whose step is nearest comes early instead
    const three: Deck = { ...two, [third]: learning(3) }
    expect(nextUp(three, NOW)).toMatchObject({ pattern: third, why: "learning" })
    // a pattern that is known, or known and missed, takes up none of the room
    const knownToo: Deck = { ...two, [third]: known(3), [fourth]: review(known(-1), "again", NOW) }
    expect(nextUp(knownToo, NOW)).toMatchObject({ pattern: fifth, why: "new" })
  })

  it("doesn't bring the pattern just played straight back while there is anything else", () => {
    const deck: Deck = { [first]: learning(-1), [second]: learning(4) }
    expect(nextUp(deck, NOW)?.pattern).toBe(first)
    expect(nextUp(deck, NOW, { avoid: first })).toMatchObject({ pattern: third, why: "new" })
    // ...and does when there is nothing else
    const everything = Object.fromEntries(PATTERN_IDS.map(pattern => [pattern, known(3)])) as Deck
    expect(nextUp({ ...everything, [first]: learning(-1) }, NOW, { avoid: first })?.pattern).toBe(first)
  })

  it("has nothing to give once everything is known and nothing is due, unless asked to go on ahead", () => {
    const deck = Object.fromEntries(PATTERN_IDS.map((pattern, index) => [pattern, known(index + 1)])) as Deck
    expect(nextUp(deck, NOW)).toBeNull()
    expect(nextUp(deck, NOW, { ahead: true })).toMatchObject({ pattern: first, why: "ahead" })
    expect(nextUp(deck, NOW, { ahead: true, avoid: first })).toMatchObject({ pattern: second, why: "ahead" })
  })
})

describe("tally", () => {
  it("counts a deck up", () => {
    expect(tally({}, NOW)).toEqual({ total: PATTERN_IDS.length, learned: 0, mastered: 0, learning: 0, fresh: PATTERN_IDS.length, due: 0 })
    const deck: Deck = { [first]: known(-1, 30), [second]: known(4), [third]: learning(-2), [fourth]: learning(5) }
    expect(tally(deck, NOW)).toEqual({ total: PATTERN_IDS.length, learned: 2, mastered: 1, learning: 2, fresh: PATTERN_IDS.length - 4, due: 2 })
  })
})

describe("nextDue", () => {
  it("is when the first card comes due, if there are any cards", () => {
    expect(nextDue({})).toBeNull()
    expect(nextDue({ [first]: known(3), [second]: known(1), [third]: known(7) })).toBe(NOW + DAY_MS)
  })
})

describe("stageOf", () => {
  it("gives a pattern more to see past the longer it has been known", () => {
    expect(stageOf(null)).toBe(0)
    expect(stageOf(learning(1))).toBe(0)
    expect(stageOf(known(1, 2))).toBe(0)
    expect(stageOf(known(1, 3))).toBe(1)
    expect(stageOf(known(1, 9))).toBe(1)
    expect(stageOf(known(1, 10))).toBe(2)
  })
})

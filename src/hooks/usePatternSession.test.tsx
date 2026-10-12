// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FLAGGED } from "../../shared/engine/board"
import { PATTERN_IDS, type PatternId } from "../../shared/training/patterns"
import type { Deck } from "../../shared/training/queue"
import { DAY_MS, review, type Card, type Grade } from "../../shared/training/schedule"
import { flawOf } from "../../shared/training/trial"
import { playSound } from "../lib/sounds"
import { usePatternSession } from "./usePatternSession"
import type { TrainingDeck } from "./useTrainingDeck"

const NOW = 1_800_000_000_000

// A deck as the session is given one: answers change it on the spot, and are noted down
function deckOf(start: Deck | null) {
  const answers: [PatternId, Grade][] = []
  const training: TrainingDeck = {
    deck: start,
    local: true,
    error: null,
    unsaved: false,
    reload: () => {},
    record: (pattern, grade) => {
      answers.push([pattern, grade])
      training.deck = { ...training.deck, [pattern]: review(training.deck?.[pattern] ?? null, grade, Date.now()) }
      return training.deck
    },
  }
  return { training, answers }
}

// the session of a deck, kept up with the deck as it changes
function sessionOf(start: Deck | null) {
  const { training, answers } = deckOf(start)
  const hook = renderHook(() => usePatternSession({ ...training }))
  return { training, answers, ...hook, now: () => hook.result.current }
}

// solves the round on the board the quickest way there is
function solve(session: ReturnType<typeof sessionOf>) {
  const { find } = session.now().playing!.round.trial
  act(() => {
    if (find.safe.length > 0) find.safe.forEach(cell => session.now().open(cell))
    else find.mines.forEach(cell => session.now().flag(cell))
  })
}

const known = (dueInDays: number): Card => ({ phase: "review", step: 0, interval: 5, ease: 2.5, reviews: 3, lapses: 0, last: NOW - DAY_MS, due: NOW + dueInDays * DAY_MS })
const everythingKnown = (): Deck => Object.fromEntries(PATTERN_IDS.map((pattern, index) => [pattern, known(index + 1)]))

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
})
afterEach(() => {
  vi.useRealTimers()
})

describe("usePatternSession", () => {
  it("has nothing on the board until there is a deck to pick a round from", () => {
    const session = sessionOf(null)
    expect(session.now()).toMatchObject({ playing: null, caughtUp: false, failed: false, suggested: null })
    session.training.deck = {}
    session.rerender()
    expect(session.now().playing).toMatchObject({ next: { pattern: PATTERN_IDS[0], why: "new" }, tookMs: null })
  })

  it("starts a player who has met nothing on a round of the first pattern, and a sound one", () => {
    const { playing } = sessionOf({}).now()
    expect(playing!.round.outcome).toBe("playing")
    expect(flawOf(playing!.round.trial)).toBeNull()
  })

  it("takes a solved round to have felt like however long it took, and waits to be told", () => {
    const session = sessionOf({})
    vi.advanceTimersByTime(1200)
    solve(session)
    expect(session.now().playing).toMatchObject({ round: { outcome: "solved" }, tookMs: 1200, nudge: true })
    expect(session.now().suggested).toBe("easy")
    expect(session.answers).toEqual([])
    expect(playSound).toHaveBeenLastCalledWith("roundSolved")

    const slow = sessionOf({})
    vi.advanceTimersByTime(20_000)
    solve(slow)
    expect(slow.now().suggested).toBe("hard")
  })

  it("answers with whatever the player says and goes straight on to another pattern", () => {
    const session = sessionOf({})
    solve(session)
    act(() => session.now().grade("good"))
    expect(session.answers).toEqual([[PATTERN_IDS[0], "good"]])
    expect(session.now().playing).toMatchObject({ next: { pattern: PATTERN_IDS[1], why: "new" }, round: { outcome: "playing" }, tookMs: null })
    expect(session.now().playing!.key).toBe(2)
  })

  it("answers a missed round for the player the moment it is missed, and moves on when asked", () => {
    const session = sessionOf({})
    act(() => session.now().giveUp())
    expect(session.now().playing).toMatchObject({ round: { outcome: "gaveUp" }, nudge: true })
    expect(session.answers).toEqual([[PATTERN_IDS[0], "again"]])
    expect(session.now().suggested).toBeNull()
    expect(playSound).toHaveBeenLastCalledWith("error")
    // there is no saying how a missed round felt
    act(() => session.now().grade("easy"))
    expect(session.answers).toHaveLength(1)
    act(() => session.now().next())
    expect(session.now().playing).toMatchObject({ next: { pattern: PATTERN_IDS[1] }, round: { outcome: "playing" } })
  })

  it("misses a round on a mine, and leaves the mine's own sound to the board", () => {
    const session = sessionOf({})
    const { trial } = session.now().playing!.round
    const mine = trial.board.field.mines.findIndex((isMine, at) => isMine === 1 && trial.board.cells[at] !== FLAGGED)
    vi.mocked(playSound).mockClear()
    act(() => session.now().open(mine))
    expect(session.now().playing!.round).toMatchObject({ outcome: "mine", wrong: mine })
    expect(session.answers).toEqual([[PATTERN_IDS[0], "again"]])
    expect(playSound).not.toHaveBeenCalled()
  })

  it("does nothing for a move on a round that is over, or for moving on from one that isn't", () => {
    const session = sessionOf({})
    const first = session.now().playing
    act(() => session.now().next())
    expect(session.now().playing).toBe(first)
    solve(session)
    const solved = session.now().playing
    act(() => session.now().giveUp())
    act(() => session.now().open(0))
    expect(session.now().playing).toBe(solved)
  })

  it("points the explanation out for a pattern missed twice running, and not for one missed once", () => {
    const once = review(review(null, "easy", NOW - DAY_MS), "good", NOW)
    // one known pattern that is due, and nothing new to take its place: it is the only round there is
    const deck = { ...everythingKnown(), [PATTERN_IDS[3]]: { ...once, due: NOW - 1 } }
    const session = sessionOf(deck)
    expect(session.now().playing!.next).toMatchObject({ pattern: PATTERN_IDS[3], why: "review" })
    act(() => session.now().giveUp())
    expect(session.now().playing!.nudge).toBe(false)
    act(() => session.now().next())
    expect(session.now().playing!.next.pattern).toBe(PATTERN_IDS[3])
    act(() => session.now().giveUp())
    expect(session.now().playing!.nudge).toBe(true)
  })

  it("stops when there is nothing due, and goes on ahead if asked to", () => {
    const session = sessionOf(everythingKnown())
    expect(session.now()).toMatchObject({ playing: null, caughtUp: true })
    act(() => session.now().keepGoing())
    expect(session.now()).toMatchObject({ caughtUp: false, playing: { next: { pattern: PATTERN_IDS[0], why: "ahead" } } })
    solve(session)
    act(() => session.now().grade("good"))
    expect(session.now().playing!.next).toMatchObject({ pattern: PATTERN_IDS[1], why: "ahead" })
  })

  it("gets the round most likely to follow ready while the one on the board is played, and uses it", () => {
    const session = sessionOf({})
    // long enough for the making of it to have been given its turns
    act(() => vi.advanceTimersByTime(2000))
    solve(session)
    act(() => session.now().grade("good"))
    expect(session.now().playing!.next.pattern).toBe(PATTERN_IDS[1])
    expect(flawOf(session.now().playing!.round.trial)).toBeNull()
    // ...and where the answer sends things another way, the round that is wanted is made there and then
    act(() => vi.advanceTimersByTime(2000))
    act(() => session.now().giveUp())
    act(() => session.now().next())
    expect(session.now().playing!.next.pattern).toBe(PATTERN_IDS[2])
    expect(flawOf(session.now().playing!.round.trial)).toBeNull()
  })

  it("starts afresh for a deck that is someone else's", () => {
    const session = sessionOf({})
    session.training.deck = null
    session.rerender()
    expect(session.now().playing).toBeNull()
    session.training.deck = everythingKnown()
    session.rerender()
    expect(session.now()).toMatchObject({ playing: null, caughtUp: true })
  })
})

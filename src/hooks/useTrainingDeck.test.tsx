// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Deck } from "../../shared/training/queue"
import { review, type Card } from "../../shared/training/schedule"
import { loadLocalDeck, saveLocalDeck } from "../lib/training"
import { useTrainingDeck } from "./useTrainingDeck"

// who is signed in and what the server would answer, as a test sets them
const app = vi.hoisted(() => ({
  account: { session: null as { user: { id: string } } | null, isPending: false },
  getTrainingCards: null as unknown as () => Promise<{ cards: unknown }>,
  importTrainingCards: null as unknown as (cards: unknown) => Promise<{ cards: unknown }>,
  sendTrainingReview: null as unknown as (item: string, grade: string) => Promise<{ item: string, card: unknown }>,
}))
vi.mock("../context/AccountContext", () => ({ useAccount: () => app.account }))
vi.mock("../lib/api", () => ({
  getTrainingCards: () => app.getTrainingCards(),
  importTrainingCards: (cards: unknown) => app.importTrainingCards(cards),
  sendTrainingReview: (item: string, grade: string) => app.sendTrainingReview(item, grade),
}))

const NOW = 1_800_000_000_000
const learned: Card = review(null, "easy", NOW)
const settled = () => act(async () => {})

beforeEach(() => {
  app.account = { session: null, isPending: false }
  app.getTrainingCards = vi.fn(async () => ({ cards: {} }))
  app.importTrainingCards = vi.fn(async cards => ({ cards }))
  app.sendTrainingReview = vi.fn(async (item, grade) => ({ item, card: review(null, grade as "good", NOW) }))
})

describe("a visitor's deck", () => {
  it("is whatever their browser has kept, there at once", () => {
    saveLocalDeck({ oneTwo: learned })
    const { result } = renderHook(() => useTrainingDeck())
    expect(result.current).toMatchObject({ deck: { oneTwo: learned }, local: true, error: null, unsaved: false })
    expect(app.getTrainingCards).not.toHaveBeenCalled()
  })

  it("is changed by an answer on the spot, and kept in the browser", () => {
    const { result } = renderHook(() => useTrainingDeck())
    let after: Deck = {}
    act(() => { after = result.current.record("oneOne", "good") })
    expect(after.oneOne).toMatchObject({ phase: "learning", step: 1, reviews: 1 })
    expect(result.current.deck).toEqual(after)
    expect(loadLocalDeck()).toEqual(after)
    expect(app.sendTrainingReview).not.toHaveBeenCalled()
    // the next answer builds on the last, without waiting for the page to be drawn again
    act(() => {
      result.current.record("oneOne", "good")
      after = result.current.record("oneTwo", "again")
    })
    expect(after.oneOne).toMatchObject({ phase: "review", reviews: 2 })
    expect(Object.keys(loadLocalDeck())).toEqual(["oneOne", "oneTwo"])
  })
})

describe("a signed-in player's deck", () => {
  beforeEach(() => {
    app.account = { session: { user: { id: "ann" } }, isPending: false }
  })

  it("is fetched from the server, and isn't there until it has been", async () => {
    app.getTrainingCards = vi.fn(async () => ({ cards: { oneTwo: learned } }))
    const { result } = renderHook(() => useTrainingDeck())
    expect(result.current).toMatchObject({ deck: null, local: false })
    await settled()
    expect(result.current.deck).toEqual({ oneTwo: learned })
  })

  it("takes in what the browser had kept from before they signed in, and keeps it there no longer", async () => {
    saveLocalDeck({ oneOne: learned })
    app.importTrainingCards = vi.fn(async () => ({ cards: { oneOne: learned, oneTwo: learned } }))
    const { result } = renderHook(() => useTrainingDeck())
    await settled()
    expect(app.importTrainingCards).toHaveBeenCalledExactlyOnceWith({ oneOne: learned })
    expect(app.getTrainingCards).not.toHaveBeenCalled()
    expect(result.current.deck).toEqual({ oneOne: learned, oneTwo: learned })
    expect(loadLocalDeck()).toEqual({})
  })

  it("is changed by an answer on the spot, and then by what the server makes of that answer", async () => {
    const servers: Card = { ...review(null, "good", NOW + 5000) }
    app.sendTrainingReview = vi.fn(async item => ({ item, card: servers }))
    const { result } = renderHook(() => useTrainingDeck())
    await settled()
    act(() => { result.current.record("oneOne", "good") })
    expect(result.current.deck?.oneOne).toMatchObject({ phase: "learning", step: 1 })
    expect(result.current.deck?.oneOne).not.toEqual(servers)
    expect(app.sendTrainingReview).toHaveBeenCalledExactlyOnceWith("oneOne", "good")
    await settled()
    expect(result.current.deck?.oneOne).toEqual(servers)
    expect(loadLocalDeck()).toEqual({})
  })

  it("says so when an answer doesn't reach the server, and keeps the answer", async () => {
    app.sendTrainingReview = vi.fn(async () => { throw new Error("Couldn't reach the server") })
    const { result } = renderHook(() => useTrainingDeck())
    await settled()
    act(() => { result.current.record("oneOne", "easy") })
    await settled()
    expect(result.current.unsaved).toBe(true)
    expect(result.current.deck?.oneOne).toMatchObject({ phase: "review", interval: 4 })
    // ...and no longer once one does
    app.sendTrainingReview = vi.fn(async (item, grade) => ({ item, card: review(null, grade as "good", NOW) }))
    act(() => { result.current.record("oneTwo", "good") })
    await settled()
    expect(result.current.unsaved).toBe(false)
  })

  it("says why when it can't be fetched, and can be asked for again", async () => {
    app.getTrainingCards = vi.fn(async () => { throw new Error("Couldn't reach the server") })
    const { result } = renderHook(() => useTrainingDeck())
    await settled()
    expect(result.current).toMatchObject({ deck: null, error: "Couldn't reach the server" })
    app.getTrainingCards = vi.fn(async () => ({ cards: { oneTwo: learned } }))
    act(() => result.current.reload())
    await settled()
    expect(result.current).toMatchObject({ deck: { oneTwo: learned }, error: null })
  })

  it("is someone else's when someone else signs in, and a visitor's again when they sign out", async () => {
    app.getTrainingCards = vi.fn(async () => ({ cards: { oneTwo: learned } }))
    const { result, rerender } = renderHook(() => useTrainingDeck())
    await settled()
    app.account = { session: { user: { id: "bob" } }, isPending: false }
    app.getTrainingCards = vi.fn(async () => ({ cards: { oneOne: learned } }))
    rerender()
    expect(result.current.deck).toBeNull()
    await settled()
    expect(result.current.deck).toEqual({ oneOne: learned })
    app.account = { session: null, isPending: false }
    rerender()
    expect(result.current).toMatchObject({ deck: {}, local: true })
  })
})

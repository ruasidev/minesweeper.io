// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { blastBetween } from "../lib/blast"
import { useBlast } from "./useBlast"
import { useChordHint } from "./useChordHint"
import { useGameClock } from "./useGameClock"
import { useLocalStorage } from "./useLocalStorage"
import { navigate, useRoute } from "./useRoute"
import { useTimeLeft } from "./useTimeLeft"

describe("useLocalStorage", () => {
  it("starts from what it is given when nothing is saved, and saves that", () => {
    const { result } = renderHook(() => useLocalStorage("rows", 9))
    expect(result.current[0]).toBe(9)
    expect(localStorage.getItem("rows")).toBe("9")
  })

  it("starts from what was saved before", () => {
    localStorage.setItem("theme", JSON.stringify("midnight"))
    const { result } = renderHook(() => useLocalStorage("theme", "classic"))
    expect(result.current[0]).toBe("midnight")
  })

  it("saves every change, whatever shape the value is", () => {
    const { result } = renderHook(() => useLocalStorage<{ size: number } | null>("cell", null))
    act(() => result.current[1]({ size: 40 }))
    expect(result.current[0]).toEqual({ size: 40 })
    expect(JSON.parse(localStorage.getItem("cell")!)).toEqual({ size: 40 })
    act(() => result.current[1](before => ({ size: before!.size + 2 })))
    expect(JSON.parse(localStorage.getItem("cell")!)).toEqual({ size: 42 })
  })
})

describe("useChordHint", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("flashes the cell asked for, and clears itself once the flash has played", () => {
    const { result } = renderHook(() => useChordHint())
    expect(result.current[0]).toBeNull()
    act(() => result.current[1](2, 3))
    expect(result.current[0]).toMatchObject({ row: 2, col: 3 })
    act(() => vi.advanceTimersByTime(500))
    expect(result.current[0]).toBeNull()
  })

  it("is a new flash every time, so the same cell can flash again", () => {
    const { result } = renderHook(() => useChordHint())
    act(() => result.current[1](1, 1))
    const first = result.current[0]!.id
    act(() => result.current[1](1, 1))
    expect(result.current[0]!.id).not.toBe(first)
  })
})

describe("useTimeLeft", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
  })

  it("counts down to a moment and stops at nothing", () => {
    const { result } = renderHook(() => useTimeLeft(103_000))
    expect(result.current).toBe(3000)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(2000)
    act(() => vi.advanceTimersByTime(60_000))
    expect(result.current).toBe(0)
  })

  it("follows the moment when it is moved", () => {
    const { result, rerender } = renderHook(({ until }) => useTimeLeft(until), { initialProps: { until: 101_000 } })
    rerender({ until: 109_000 })
    expect(result.current).toBe(9000)
  })
})

describe("useRoute", () => {
  const goTo = (hash: string) => act(() => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent("hashchange"))
  })

  beforeEach(() => {
    window.location.hash = ""
  })

  it("is the singleplayer game when the address names no page, or one it doesn't know", () => {
    expect(renderHook(() => useRoute()).result.current).toMatchObject({ route: "game", params: [] })
    window.location.hash = "#/nowhere"
    expect(renderHook(() => useRoute()).result.current.route).toBe("game")
  })

  it("follows the address as it changes", () => {
    const { result } = renderHook(() => useRoute())
    goTo("#/leaderboard")
    expect(result.current.route).toBe("leaderboard")
    goTo("#/multiplayer")
    expect(result.current.route).toBe("multiplayer")
  })

  it("reads what comes after a page's address as what that page is to show", () => {
    const { result } = renderHook(() => useRoute())
    goTo("#/history/player%20one/42")
    expect(result.current).toMatchObject({ route: "history", params: ["player one", "42"] })
  })

  it("goes to a page by writing its address, with anything it is to show", () => {
    navigate("daily")
    expect(window.location.hash).toBe("#/daily")
    navigate("history", "ab/c", 7)
    expect(window.location.hash).toBe("#/history/ab%2Fc/7")
    navigate("game")
    expect(window.location.hash).toBe("#/")
  })
})

describe("useGameClock", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
  })

  it("is nought for no game, and for one that hasn't begun", () => {
    expect(renderHook(() => useGameClock(null)).result.current).toBe(0)
    expect(renderHook(() => useGameClock({ startedAt: 103_000, durationMs: null })).result.current).toBe(0)
  })

  it("counts the whole seconds a game has been going, and keeps counting", () => {
    const { result } = renderHook(() => useGameClock({ startedAt: 58_000, durationMs: null }))
    expect(result.current).toBe(42)
    act(() => { vi.advanceTimersByTime(2500) })
    expect(result.current).toBe(44)
  })

  it("stops at how long the game lasted once it is over", () => {
    const { result, rerender } = renderHook(({ durationMs }: { durationMs: number | null }) => useGameClock({ startedAt: 58_000, durationMs }), { initialProps: { durationMs: null as number | null } })
    rerender({ durationMs: 45_900 })
    expect(result.current).toBe(45)
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(result.current).toBe(45)
  })
})

describe("useBlast", () => {
  it("is the mine that has just gone off, for as long as the board stays as that left it", () => {
    const { result, rerender } = renderHook(({ cells }: { cells: string }) => useBlast(cells, 3), { initialProps: { cells: ".11000" } })
    expect(result.current).toBeNull()
    rerender({ cells: "*.1..0" })
    expect(result.current).toMatchObject({ row: 0, col: 0 })
    expect(result.current!.covered).toEqual(blastBetween(".11000", "*.1..0", 3)!.covered)
    // the next move wasn't a mine
    rerender({ cells: "*11..0" })
    expect(result.current).toBeNull()
  })
})

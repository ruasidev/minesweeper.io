// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useLetGo } from "./useLetGo"

beforeEach(() => {
  vi.useFakeTimers()
})

describe("useLetGo", () => {
  it("keeps hold of what has just finished for its moment, and then lets go", () => {
    const { result, rerender } = renderHook(({ finished }) => useLetGo(finished, 2000), { initialProps: { finished: false } })
    expect(result.current).toBe(false)
    rerender({ finished: true })
    expect(result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(1999) })
    expect(result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBe(true)
  })

  it("never says to let go on the way from finishing to being held", () => {
    // every answer it gives, render by render: one "let go" in among them would take a board off the screen
    const answers: boolean[] = []
    const { rerender } = renderHook(({ finished }) => {
      const letGo = useLetGo(finished, 2000)
      answers.push(letGo)
      return letGo
    }, { initialProps: { finished: false } })
    rerender({ finished: true })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(answers.every(letGo => letGo === false)).toBe(true)
  })

  it("lets go at once of what had finished before it was first asked", () => {
    const { result } = renderHook(() => useLetGo(true, 2000))
    expect(result.current).toBe(true)
  })

  it("starts over for the next thing to finish", () => {
    const { result, rerender } = renderHook(({ finished }) => useLetGo(finished, 2000), { initialProps: { finished: true } })
    rerender({ finished: false })
    expect(result.current).toBe(false)
    rerender({ finished: true })
    expect(result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current).toBe(true)
  })

  it("forgets a moment that was cut short", () => {
    const { result, rerender } = renderHook(({ finished }) => useLetGo(finished, 2000), { initialProps: { finished: false } })
    rerender({ finished: true })
    act(() => { vi.advanceTimersByTime(1500) })
    rerender({ finished: false })
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current).toBe(false)
  })
})

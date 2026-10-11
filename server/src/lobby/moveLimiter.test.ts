import { describe, expect, it } from "vitest"
import { allowMove, newMoveLimiter } from "./moveLimiter.js"

// how many moves in a row get through at one moment
function allowedAt(limiter: ReturnType<typeof newMoveLimiter>, now: number, tries = 100): number {
  let allowed = 0
  for (let i = 0; i < tries; i++) if (allowMove(limiter, now)) allowed++
  return allowed
}

describe("allowMove", () => {
  it("lets a burst through, then nothing more at that moment", () => {
    const limiter = newMoveLimiter(0)
    expect(allowedAt(limiter, 0)).toBe(30)
    expect(allowMove(limiter, 0)).toBe(false)
  })

  it("lets moves through again at fifteen a second", () => {
    const limiter = newMoveLimiter(0)
    allowedAt(limiter, 0)
    expect(allowedAt(limiter, 1000)).toBe(15)
    expect(allowedAt(limiter, 1200)).toBe(3)
  })

  it("never saves up more than a burst, however long the wait", () => {
    const limiter = newMoveLimiter(0)
    allowedAt(limiter, 0)
    expect(allowedAt(limiter, 60 * 60 * 1000)).toBe(30)
  })

  it("lets a fast human play without ever being held up", () => {
    const limiter = newMoveLimiter(0)
    // ten moves a second for a minute
    for (let move = 0; move < 600; move++) expect(allowMove(limiter, move * 100)).toBe(true)
  })

  it("holds a program to the rate, whatever it sends", () => {
    const limiter = newMoveLimiter(0)
    let allowed = 0
    // a move every millisecond for ten seconds
    for (let ms = 0; ms < 10_000; ms++) if (allowMove(limiter, ms)) allowed++
    expect(allowed).toBeLessThanOrEqual(30 + 150)
  })

  it("isn't thrown by a clock that goes backwards", () => {
    const limiter = newMoveLimiter(1000)
    allowedAt(limiter, 1000)
    expect(allowMove(limiter, 500)).toBe(false)
    expect(limiter.tokens).toBeGreaterThanOrEqual(0)
  })
})

import { describe, expect, it } from "vitest"
import { formatCountdown, formatDuration, formatScore, formatTimeLeft, msUntilNextUtcDay } from "./time"

describe("formatDuration", () => {
  it("shows minutes and seconds, each two digits", () => {
    expect(formatDuration(0)).toBe("00:00")
    expect(formatDuration(83_000)).toBe("01:23")
    expect(formatDuration(600_000)).toBe("10:00")
  })

  it("drops the part of a second, and never goes below nothing", () => {
    expect(formatDuration(59_999)).toBe("00:59")
    expect(formatDuration(-5000)).toBe("00:00")
  })

  it("keeps counting minutes past the hour", () => {
    expect(formatDuration(3_725_000)).toBe("62:05")
  })
})

describe("formatScore", () => {
  it("shows tenths of a second, for times that are compared with each other", () => {
    expect(formatScore(83_450)).toBe("1:23.4")
    expect(formatScore(0)).toBe("0:00.0")
    expect(formatScore(9_990)).toBe("0:09.9")
  })

  it("cuts a time short rather than rounding it up into a better one", () => {
    expect(formatScore(59_999)).toBe("0:59.9")
  })
})

describe("formatTimeLeft", () => {
  it("counts the second that is still running, so the last one reads as one and not none", () => {
    expect(formatTimeLeft(400)).toBe("00:01")
    expect(formatTimeLeft(1000)).toBe("00:01")
    expect(formatTimeLeft(1001)).toBe("00:02")
    expect(formatTimeLeft(0)).toBe("00:00")
  })
})

describe("msUntilNextUtcDay", () => {
  it("is what is left of the day by the server's clock", () => {
    expect(msUntilNextUtcDay(Date.parse("2026-10-11T23:00:00Z"))).toBe(60 * 60 * 1000)
    expect(msUntilNextUtcDay(Date.parse("2026-10-11T00:00:00Z"))).toBe(24 * 60 * 60 * 1000)
    expect(msUntilNextUtcDay(Date.parse("2026-10-11T12:30:15.500Z"))).toBe(Date.parse("2026-10-12T00:00:00Z") - Date.parse("2026-10-11T12:30:15.500Z"))
  })
})

describe("formatCountdown", () => {
  it("says how long is left, to the minute", () => {
    expect(formatCountdown(82_740_000)).toBe("22h 59m")
    expect(formatCountdown(2_400_000)).toBe("40m")
    expect(formatCountdown(60 * 60 * 1000)).toBe("1h 0m")
    expect(formatCountdown(61_000)).toBe("2m")
  })

  it("doesn't count down the last minute, or below nothing", () => {
    expect(formatCountdown(59_000)).toBe("under a minute")
    expect(formatCountdown(0)).toBe("under a minute")
    expect(formatCountdown(-5000)).toBe("under a minute")
  })
})

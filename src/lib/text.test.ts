import { describe, expect, it } from "vitest"
import { plural } from "./text"

describe("plural", () => {
  it("adds an s for any number but one", () => {
    expect(plural(1, "mine")).toBe("1 mine")
    expect(plural(0, "mine")).toBe("0 mines")
    expect(plural(12, "player")).toBe("12 players")
  })
})

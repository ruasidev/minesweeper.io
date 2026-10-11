// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { rememberRoomToJoin, takeRoomToJoin } from "./roomIntent"

beforeEach(() => sessionStorage.clear())

describe("the room a visitor asked to join", () => {
  it("is there to be taken once they are signed in, and only once", () => {
    rememberRoomToJoin("room-7", 1000)
    expect(takeRoomToJoin(60_000)).toBe("room-7")
    expect(takeRoomToJoin(60_000)).toBeNull()
  })

  it("is the last one they asked for", () => {
    rememberRoomToJoin("room-7", 1000)
    rememberRoomToJoin("room-9", 2000)
    expect(takeRoomToJoin(3000)).toBe("room-9")
  })

  it("isn't kept for long", () => {
    rememberRoomToJoin("room-7", 1000)
    expect(takeRoomToJoin(1000 + 11 * 60 * 1000)).toBeNull()
    // and is forgotten for having been too old
    expect(takeRoomToJoin(2000)).toBeNull()
  })

  it("is nothing when nothing was asked for, or what was kept makes no sense", () => {
    expect(takeRoomToJoin()).toBeNull()
    for (const kept of ["not json", "null", JSON.stringify({ roomId: 7, at: 1000 }), JSON.stringify({ roomId: "room-7" })]) {
      sessionStorage.setItem("roomToJoin", kept)
      expect(takeRoomToJoin(2000)).toBeNull()
    }
  })
})

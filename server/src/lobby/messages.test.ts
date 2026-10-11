import { describe, expect, it } from "vitest"
import type { ClientMessage } from "../../../shared/protocol.js"
import { parseMessage } from "./messages.js"

const parse = (value: unknown) => parseMessage(JSON.stringify(value))

describe("parseMessage", () => {
  it("reads every kind of message a browser sends", () => {
    const messages: ClientMessage[] = [
      { type: "createRoom", name: "Friday", visibility: "private", passcode: "sesame" },
      { type: "createRoom", name: "Open", visibility: "public" },
      { type: "joinRoom", roomId: "abc" },
      { type: "joinRoom", roomId: "abc", passcode: "sesame" },
      { type: "leaveRoom" },
      { type: "chat", text: "hello" },
      { type: "globalChat", text: "hello all" },
      { type: "makeHost", playerId: "bob" },
      { type: "kick", playerId: "bob" },
      { type: "setMode", mode: "race" },
      { type: "setSettings", settings: { rows: 9, cols: 9, mines: 10 } },
      { type: "startGame" },
      { type: "endGame" },
      { type: "giveUp" },
      { type: "spectate", playerId: "bob" },
      { type: "spectate", playerId: null },
      { type: "startSolo", mode: "classic", settings: { rows: 9, cols: 9, mines: 10 }, opening: { row: 4, col: 4 } },
      { type: "startSolo", mode: "daily" },
      { type: "endSolo" },
      { type: "reveal", row: 3, col: 4 },
      { type: "flag", row: 3, col: 4 },
    ]
    for (const message of messages) expect(parse(message)).toEqual(message)
  })

  it("keeps only what a message is made of", () => {
    expect(parse({ type: "reveal", row: 1, col: 2, cheat: true, __proto__: { admin: true } })).toEqual({ type: "reveal", row: 1, col: 2 })
    expect(parse({ type: "startSolo", mode: "classic", opening: { row: 1, col: 2, extra: 3 } }))
      .toEqual({ type: "startSolo", mode: "classic", settings: undefined, opening: { row: 1, col: 2 } })
  })

  it("throws away anything that isn't JSON, or isn't a message", () => {
    for (const raw of ["", "not json", "{", "null", "3", "\"reveal\"", "[]", "[{\"type\":\"leaveRoom\"}]"]) expect(parseMessage(raw)).toBeNull()
    expect(parse({})).toBeNull()
    expect(parse({ type: 3 })).toBeNull()
    expect(parse({ type: "selfDestruct" })).toBeNull()
  })

  it("isn't fooled by the name of something every object has", () => {
    for (const type of ["constructor", "toString", "hasOwnProperty", "__proto__"]) expect(parse({ type })).toBeNull()
  })

  it("throws away a message with a part missing or of the wrong type", () => {
    const broken: unknown[] = [
      { type: "createRoom", name: "Open" },
      { type: "createRoom", name: 5, visibility: "public" },
      { type: "createRoom", name: "Open", visibility: "secret" },
      { type: "createRoom", name: "Open", visibility: "private", passcode: 1234 },
      { type: "joinRoom" },
      { type: "joinRoom", roomId: ["abc"] },
      { type: "chat" },
      { type: "chat", text: { toString: "hi" } },
      { type: "makeHost", playerId: 7 },
      { type: "kick" },
      { type: "setMode", mode: "classic" },
      { type: "setMode", mode: "sprint" },
      { type: "setSettings" },
      { type: "setSettings", settings: "9x9" },
      { type: "setSettings", settings: [9, 9, 10] },
      { type: "spectate" },
      { type: "spectate", playerId: 4 },
      { type: "startSolo" },
      { type: "startSolo", mode: "race" },
      { type: "startSolo", mode: "classic", settings: "big" },
      { type: "startSolo", mode: "classic", opening: { row: "1", col: 2 } },
      { type: "startSolo", mode: "classic", opening: [1, 2] },
      { type: "reveal", row: 1 },
      { type: "reveal", row: "1", col: "2" },
      { type: "flag", row: null, col: 2 },
    ]
    for (const message of broken) expect(parse(message)).toBeNull()
  })
})

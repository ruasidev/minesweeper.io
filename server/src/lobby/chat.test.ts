import { describe, expect, it } from "vitest"
import { CHAT_HISTORY_MAX, CHAT_TEXT_MAX } from "../../../shared/protocol.js"
import { newChatLog, say, type Speaker } from "./chat.js"

const speaker = (id = "ann"): Speaker => ({ player: { id, username: id.toUpperCase(), image: null }, lastChatAt: 0 })

describe("say", () => {
  it("adds what was said, with who said it and when", () => {
    const log = newChatLog()
    const message = say(log, speaker(), "  hello  ", 5000)
    expect(message).toMatchObject({ playerId: "ann", username: "ANN", text: "hello", sentAt: 5000 })
    expect(log.messages).toEqual([message])
  })

  it("gives every message a number of its own", () => {
    const log = newChatLog()
    const first = say(log, speaker("ann"), "one", 1000)!
    const second = say(log, speaker("bob"), "two", 1000)!
    expect(second.id).toBeGreaterThan(first.id)
  })

  it("turns down nothing at all, and too much", () => {
    const log = newChatLog()
    expect(say(log, speaker(), "   ", 1000)).toBeNull()
    expect(say(log, speaker(), "x".repeat(CHAT_TEXT_MAX + 1), 1000)).toBeNull()
    expect(say(log, speaker(), "x".repeat(CHAT_TEXT_MAX), 1000)).not.toBeNull()
  })

  it("holds one player to a gap between messages, without holding up anyone else", () => {
    const log = newChatLog()
    const ann = speaker("ann")
    expect(say(log, ann, "one", 1000)).not.toBeNull()
    expect(say(log, ann, "two", 1400)).toBeNull()
    expect(say(log, speaker("bob"), "hi", 1400)).not.toBeNull()
    expect(say(log, ann, "three", 1500)).not.toBeNull()
  })

  it("remembers only the latest messages", () => {
    const log = newChatLog()
    for (let i = 0; i < CHAT_HISTORY_MAX + 5; i++) say(log, speaker(`p${i}`), `message ${i}`, 1000)
    expect(log.messages).toHaveLength(CHAT_HISTORY_MAX)
    expect(log.messages[0].text).toBe("message 5")
  })
})

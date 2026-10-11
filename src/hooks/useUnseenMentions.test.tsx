// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ChatMessage } from "../../shared/protocol"
import { useUnseenMentions } from "./useUnseenMentions"

// who is signed in and what has been said in the chat everyone shares, as a test sets them
const app = vi.hoisted(() => ({ globalChat: [] as unknown[] }))
vi.mock("../context/AccountContext", () => ({ useAccount: () => ({ session: { user: { id: "ann-id", name: "Ann" } }, profile: { username: "ann" } }) }))
vi.mock("../context/ConnectionContext", () => ({ useConnection: () => ({ globalChat: app.globalChat }) }))

const said = (id: number, username: string, text: string): ChatMessage => ({ id, playerId: `${username}-id`, username, text, sentAt: id })

beforeEach(() => {
  app.globalChat = []
})

describe("useUnseenMentions", () => {
  it("counts the times the player was mentioned since they last looked, and nothing else that was said", () => {
    app.globalChat = [said(1, "bob", "hello")]
    const { result, rerender } = renderHook(({ looking }) => useUnseenMentions(looking), { initialProps: { looking: false } })
    expect(result.current).toBe(0)

    app.globalChat = [...app.globalChat, said(2, "bob", "anyone for a game"), said(3, "cat", "me"), said(4, "bob", "you there @ann?")]
    rerender({ looking: false })
    expect(result.current).toBe(1)

    app.globalChat = [...app.globalChat, said(5, "cat", "@Ann come on"), said(6, "cat", "@annabel too")]
    rerender({ looking: false })
    expect(result.current).toBe(2)
  })

  it("has none left once the chat has been looked at", () => {
    app.globalChat = [said(1, "bob", "hello")]
    const { result, rerender } = renderHook(({ looking }) => useUnseenMentions(looking), { initialProps: { looking: false } })
    app.globalChat = [...app.globalChat, said(2, "bob", "@ann?")]
    rerender({ looking: false })
    expect(result.current).toBe(1)
    rerender({ looking: true })
    expect(result.current).toBe(0)
    rerender({ looking: false })
    expect(result.current).toBe(0)
  })

  it("doesn't count what was there on arriving, or the player naming themselves", () => {
    app.globalChat = [said(1, "bob", "@ann are you about")]
    const { result, rerender } = renderHook(() => useUnseenMentions(false))
    expect(result.current).toBe(0)
    app.globalChat = [...app.globalChat, said(2, "ann", "I am @ann")]
    rerender()
    expect(result.current).toBe(0)
  })
})

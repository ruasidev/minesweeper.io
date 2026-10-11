// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../context/ThemeContext"
import type { ChatMessage } from "../../../shared/protocol"
import ChatBox from "./ChatBox"

// the player reading the chat is ann
vi.mock("../../context/AccountContext", () => ({
  useAccount: () => ({ session: { user: { id: "ann-id", name: "Ann Example" } }, profile: { username: "ann" } }),
}))

const said = (id: number, username: string, text: string): ChatMessage => ({ id, playerId: `${username}-id`, username, text, sentAt: 1_000_000 + id })

function chat(messages: ChatMessage[], people?: string[]) {
  const onSend = vi.fn()
  render(<ThemeProvider><ChatBox messages={messages} onSend={onSend} emptyText="Nothing said yet." people={people} /></ThemeProvider>)
  const box = screen.getByRole("combobox") as HTMLInputElement
  // types into the box, leaving the caret at the end as a keyboard would
  const type = (text: string) => fireEvent.change(box, { target: { value: text, selectionStart: text.length } })
  const offered = () => screen.queryAllByRole("option").map(option => option.textContent)
  return { onSend, box, type, offered }
}

beforeEach(() => {
  // the stand-in page has nothing that watches an element's size
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} })
})

describe("what has been said", () => {
  it("is listed with who said it, or a line saying nothing has been", () => {
    chat([])
    expect(screen.getByText("Nothing said yet.")).toBeTruthy()
  })

  it("picks out a message in which somebody else mentions the player", () => {
    chat([said(1, "bob", "good game"), said(2, "bob", "nice one @ann"), said(3, "cat", "well played @bob"), said(4, "ann", "thanks @ann, I mean me")])
    const picked = screen.getAllByTitle("You were mentioned")
    expect(picked).toHaveLength(1)
    expect(picked[0].textContent).toContain("nice one @ann")
    expect(picked[0].className).toContain("border-amber-400")
  })

  it("goes by the name, however it was capitalised, and not by a name that only begins the same", () => {
    chat([said(1, "bob", "hello @ANN"), said(2, "bob", "hello @annabel")])
    expect(screen.getAllByTitle("You were mentioned").map(message => message.textContent)).toEqual([expect.stringContaining("@ANN")])
  })

  it("shows every mention as a name, whoever it is of", () => {
    chat([said(1, "cat", "well played @bob and @ann")])
    const mentions = [...document.querySelectorAll("p span.font-semibold")].map(span => span.textContent)
    expect(mentions).toEqual(["@bob", "@ann"])
  })
})

describe("mentioning somebody", () => {
  const messages = [said(1, "bob", "hello"), said(2, "cat", "hi"), said(3, "ann", "hey"), said(4, "dee", "evening")]

  it("offers names once an @ is typed: whoever is here first, then whoever spoke last, and never the player", () => {
    const { type, offered, box } = chat(messages, ["zed", "ann", "cat"])
    expect(offered()).toEqual([])
    type("gg @")
    expect(offered()).toEqual(["@zed", "@cat", "@dee", "@bob"])
    expect(box.getAttribute("aria-expanded")).toBe("true")
  })

  it("narrows them down as the name is typed, and offers nothing where no name fits", () => {
    const { type, offered } = chat(messages, ["zed", "cat"])
    type("gg @c")
    expect(offered()).toEqual(["@cat"])
    type("gg @x")
    expect(offered()).toEqual([])
    type("gg @cat ")
    expect(offered()).toEqual([])
  })

  it("fills in the first of them on Enter, which only then sends the message", () => {
    const { type, box, onSend, offered } = chat(messages, ["zed", "cat"])
    type("gg @c")
    fireEvent.keyDown(box, { key: "Enter" })
    expect(box.value).toBe("gg @cat ")
    expect(onSend).not.toHaveBeenCalled()
    expect(offered()).toEqual([])

    fireEvent.submit(box.closest("form")!)
    expect(onSend).toHaveBeenCalledExactlyOnceWith("gg @cat ")
    expect(box.value).toBe("")
  })

  it("moves through them with the arrows, round and round", () => {
    const { type, box } = chat(messages, ["zed", "cat"])
    const selected = () => screen.getAllByRole("option").find(option => option.getAttribute("aria-selected") === "true")?.textContent
    type("@")
    expect(selected()).toBe("@zed")
    fireEvent.keyDown(box, { key: "ArrowDown" })
    expect(selected()).toBe("@cat")
    fireEvent.keyDown(box, { key: "ArrowUp" })
    fireEvent.keyDown(box, { key: "ArrowUp" })
    expect(selected()).toBe("@bob")
    fireEvent.keyDown(box, { key: "Tab" })
    expect(box.value).toBe("@bob ")
  })

  it("takes the one that is pressed", () => {
    const { type, box } = chat(messages, ["zed", "cat"])
    type("@")
    fireEvent.click(screen.getByRole("option", { name: "@dee" }))
    expect(box.value).toBe("@dee ")
  })

  it("puts them away on Escape, until another mention is begun", () => {
    const { type, box, offered } = chat(messages, ["zed", "cat"])
    type("@c")
    fireEvent.keyDown(box, { key: "Escape" })
    expect(offered()).toEqual([])
    type("@ca")
    expect(offered()).toEqual([])
    type("@ca and @")
    expect(offered().length).toBeGreaterThan(0)
  })
})

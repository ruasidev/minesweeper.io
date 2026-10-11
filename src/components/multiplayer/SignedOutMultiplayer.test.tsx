// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../context/ThemeContext"
import type { RoomSummary } from "../../../shared/protocol"
import { takeRoomToJoin } from "../../lib/roomIntent"
import SignedOutMultiplayer from "./SignedOutMultiplayer"

// the rooms the server says are open, as a test sets them
const app = vi.hoisted(() => ({ rooms: null as unknown }))
vi.mock("../../hooks/useOpenRooms", () => ({ useOpenRooms: () => app.rooms }))

const room = (id: string, name: string, visibility: "public" | "private" = "public"): RoomSummary =>
  ({ id, name, visibility, hostUsername: "host", playerCount: 2, inGame: false }) as RoomSummary

function page() {
  const onOpenAuth = vi.fn()
  render(<ThemeProvider><SignedOutMultiplayer onOpenAuth={onOpenAuth} /></ThemeProvider>)
  return onOpenAuth
}

beforeEach(() => {
  sessionStorage.clear()
  app.rooms = [room("r1", "Friday night sweep"), room("r2", "the usual suspects", "private")]
})

describe("the multiplayer page for a visitor", () => {
  it("shows the rooms that are open before anything is asked of them", () => {
    page()
    const headings = screen.getAllByRole("heading").map(heading => heading.textContent)
    expect(headings[0]).toBe("Rooms")
    expect(screen.getByText("Friday night sweep")).toBeTruthy()
    expect(screen.getByText("2 open")).toBeTruthy()
  })

  it("asks for an account when they try to join a room, and remembers which", () => {
    const onOpenAuth = page()
    fireEvent.click(screen.getByRole("button", { name: "Join Friday night sweep" }))
    expect(onOpenAuth).toHaveBeenCalledExactlyOnceWith("signUp")
    expect(takeRoomToJoin()).toBe("r1")
  })

  it("doesn't remember a private room: its passcode is asked for once they are in", () => {
    const onOpenAuth = page()
    fireEvent.click(screen.getByRole("button", { name: "Join the usual suspects" }))
    expect(onOpenAuth).toHaveBeenCalledExactlyOnceWith("signUp")
    expect(takeRoomToJoin()).toBeNull()
  })

  it("asks for an account when they try to open a room", () => {
    const onOpenAuth = page()
    fireEvent.click(screen.getByRole("button", { name: "Create" }))
    expect(onOpenAuth).toHaveBeenCalledExactlyOnceWith("signUp")
  })

  it("has both ways in for someone who already knows they want one", () => {
    const onOpenAuth = page()
    fireEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(onOpenAuth).toHaveBeenLastCalledWith("signIn")
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }))
    expect(onOpenAuth).toHaveBeenLastCalledWith("signUp")
  })

  it("says so when no room is open, and while it is still finding out", () => {
    app.rooms = []
    const first = render(<ThemeProvider><SignedOutMultiplayer onOpenAuth={() => {}} /></ThemeProvider>)
    expect(screen.getByText(/No rooms at the moment/)).toBeTruthy()
    first.unmount()
    app.rooms = null
    render(<ThemeProvider><SignedOutMultiplayer onOpenAuth={() => {}} /></ThemeProvider>)
    expect(screen.getByText("Looking for rooms…")).toBeTruthy()
  })
})

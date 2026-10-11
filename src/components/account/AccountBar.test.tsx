// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../context/ThemeContext"
import AccountBar from "./AccountBar"

// who is signed in, as a test sets it
const app = vi.hoisted(() => ({
  account: {} as { session: unknown, isPending: boolean, isAdmin: boolean, profile: unknown },
  signOut: null as unknown as () => void,
}))
vi.mock("../../context/AccountContext", () => ({ useAccount: () => app.account }))
vi.mock("../../context/SettingsContext", () => ({ useSettings: () => ({ settings: { reduceMotion: true } }) }))
vi.mock("../../lib/authClient", () => ({ authClient: { signOut: () => app.signOut() }, API_URL: "" }))

const actions = () => ({ onOpenAuth: vi.fn(), onOpenProfile: vi.fn(), onOpenHistory: vi.fn(), onOpenPanel: vi.fn() })
function bar() {
  const asked = actions()
  render(<ThemeProvider><AccountBar {...asked} /></ThemeProvider>)
  return asked
}
const menuItems = () => screen.queryAllByRole("menuitem").map(item => item.textContent)
const ANN = { session: { user: { id: "ann-id", name: "Ann Example", image: null } }, isPending: false, isAdmin: false, profile: { username: "ann", elo: 1234, xp: 250, stats: { wins: 7 } } }

beforeEach(() => {
  app.account = { session: null, isPending: false, isAdmin: false, profile: null }
  app.signOut = vi.fn()
})

describe("for someone who isn't signed in", () => {
  it("has the two ways in, each opening the account window on its own form", () => {
    const asked = bar()
    fireEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(asked.onOpenAuth).toHaveBeenLastCalledWith("signIn")
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }))
    expect(asked.onOpenAuth).toHaveBeenLastCalledWith("signUp")
  })

  it("keeps themes and settings a press away: they are for everybody", () => {
    const asked = bar()
    expect(menuItems()).toEqual([])
    fireEvent.click(screen.getByRole("button", { name: "Themes and settings" }))
    expect(menuItems()).toEqual(["Themes", "Settings", "Log in", "Sign up"])
    fireEvent.click(screen.getByRole("menuitem", { name: "Themes" }))
    expect(asked.onOpenPanel).toHaveBeenCalledExactlyOnceWith("themes")
    // picking something puts the menu away
    expect(menuItems()).toEqual([])
  })

  it("shows neither while it isn't known yet whether somebody is signed in", () => {
    app.account = { ...app.account, isPending: true }
    bar()
    expect(screen.queryAllByRole("button")).toEqual([])
  })
})

describe("for the player who is signed in", () => {
  beforeEach(() => {
    app.account = ANN
  })

  it("says who they are, and opens the menu of what is theirs", () => {
    const asked = bar()
    const account = screen.getByRole("button", { name: /@ann/ })
    expect(account.textContent).toContain("Rating 1234")
    expect(account.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(account)
    expect(account.getAttribute("aria-expanded")).toBe("true")
    expect(menuItems()).toEqual(["Profile", "Match history", "Themes", "Settings", "Sign out"])

    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }))
    expect(asked.onOpenPanel).toHaveBeenCalledExactlyOnceWith("settings")
    fireEvent.click(account)
    fireEvent.click(screen.getByRole("menuitem", { name: "Match history" }))
    expect(asked.onOpenHistory).toHaveBeenCalledTimes(1)
    fireEvent.click(account)
    fireEvent.click(screen.getByRole("menuitem", { name: "Profile" }))
    expect(asked.onOpenProfile).toHaveBeenCalledTimes(1)
  })

  it("signs them out from there", () => {
    bar()
    fireEvent.click(screen.getByRole("button", { name: /@ann/ }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }))
    expect(app.signOut).toHaveBeenCalledTimes(1)
  })

  it("closes the menu on a second press of what opened it", () => {
    bar()
    const account = screen.getByRole("button", { name: /@ann/ })
    fireEvent.click(account)
    fireEvent.click(account)
    expect(menuItems()).toEqual([])
  })

  it("marks an admin with the shield alone: the word is in the menu", () => {
    bar()
    expect(screen.queryByRole("img", { name: "Admin account" })).toBeNull()
  })

  it("...and shows it beside an admin's name", () => {
    app.account = { ...ANN, isAdmin: true }
    bar()
    const badge = screen.getByRole("img", { name: "Admin account" })
    expect(badge.textContent).toBe("")
    fireEvent.click(screen.getByRole("button", { name: /@ann/ }))
    expect(screen.getByRole("menu").textContent).toContain("Admin")
  })
})

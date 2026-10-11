// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../context/ThemeContext"
import type { ScoreEntry } from "../../lib/api"
import { BOARD_PRESETS, DAILY_BOARD_SETTINGS } from "../../../shared/game/boards"
import LeaderboardScreen from "./LeaderboardScreen"

// who is looking, which singleplayer game they play, and what the server would answer, as a test sets them
const app = vi.hoisted(() => ({
  account: { session: null as { user: { id: string } } | null, isAdmin: false },
  soloMode: "noGuess",
  getLeaderboard: null as unknown as (board: string, mode: string) => Promise<{ entries: unknown[] }>,
  getDaily: null as unknown as () => Promise<unknown>,
  setScoresHidden: null as unknown as (scores: unknown, hidden: boolean) => Promise<{ ok: true }>,
}))
vi.mock("../../context/AccountContext", () => ({ useAccount: () => app.account }))
vi.mock("../../context/SoloGameContext", () => ({ useSoloGameContext: () => ({ mode: app.soloMode }) }))
vi.mock("../../lib/api", () => ({
  getLeaderboard: (board: string, mode: string) => app.getLeaderboard(board, mode),
  getDaily: () => app.getDaily(),
  setScoresHidden: (scores: unknown, hidden: boolean) => app.setScoresHidden(scores, hidden),
}))

const entry = (username: string, durationMs: number): ScoreEntry =>
  ({ userId: username, username, image: null, durationMs, mineHits: 0, at: "2026-10-01T12:00:00.000Z" })

const [, INTERMEDIATE] = BOARD_PRESETS

// the page, once whatever it asked for has arrived
async function show() {
  const page = render(<ThemeProvider><LeaderboardScreen /></ThemeProvider>)
  await act(async () => {})
  return page
}
const pressed = async (name: string | RegExp, role = "button") => {
  fireEvent.click(screen.getByRole(role, { name }))
  await act(async () => {})
}

beforeEach(() => {
  app.account = { session: null, isAdmin: false }
  app.soloMode = "noGuess"
  // each game has a board of its own: nobody is on both
  app.getLeaderboard = vi.fn(async (_board, mode) => ({ entries: [entry(`${mode}_champion`, 41_230)] }))
  app.getDaily = vi.fn(async () => ({ date: "2026-10-11", settings: DAILY_BOARD_SETTINGS, entries: [entry("early_bird", 95_000)], mine: null }))
  app.setScoresHidden = vi.fn(async () => ({ ok: true as const }))
})

describe("the singleplayer leaderboards", () => {
  it("start on the game the player plays: the one whose boards need no guess, for most", async () => {
    await show()
    expect(app.getLeaderboard).toHaveBeenCalledExactlyOnceWith(INTERMEDIATE.id, "noGuess")
    expect(screen.getByRole("switch", { name: "No guessing" }).getAttribute("aria-checked")).toBe("true")
    expect(screen.getByText(/noGuess_champion/)).toBeTruthy()
    expect(screen.getByText(/on a board that needs no guess/)).toBeTruthy()
  })

  it("start on the classic game for a player who has chosen it", async () => {
    app.soloMode = "classic"
    await show()
    expect(app.getLeaderboard).toHaveBeenCalledExactlyOnceWith(INTERMEDIATE.id, "classic")
    expect(screen.getByRole("switch", { name: "No guessing" }).getAttribute("aria-checked")).toBe("false")
    expect(screen.getByText(/classic_champion/)).toBeTruthy()
    expect(screen.getByText(/laid by chance/)).toBeTruthy()
  })

  it("show the other game's when the switch is flipped, and this one's again when it is flipped back", async () => {
    await show()
    await pressed("No guessing", "switch")
    expect(app.getLeaderboard).toHaveBeenLastCalledWith(INTERMEDIATE.id, "classic")
    expect(screen.getByText(/classic_champion/)).toBeTruthy()
    expect(screen.queryByText(/noGuess_champion/)).toBeNull()
    await pressed("No guessing", "switch")
    expect(app.getLeaderboard).toHaveBeenLastCalledWith(INTERMEDIATE.id, "noGuess")
  })

  it("keep to the game on show when another board is picked", async () => {
    await show()
    await pressed("No guessing", "switch")
    await pressed("Expert")
    expect(app.getLeaderboard).toHaveBeenLastCalledWith(BOARD_PRESETS[2].id, "classic")
  })

  it("say so when nobody is on one yet", async () => {
    app.getLeaderboard = vi.fn(async () => ({ entries: [] }))
    await show()
    expect(screen.getByText("Nobody has cleared this board in singleplayer yet. Be the first.")).toBeTruthy()
    await pressed("No guessing", "switch")
    expect(screen.getByText("Nobody has cleared this board in classic singleplayer yet. Be the first.")).toBeTruthy()
  })
})

describe("the other leaderboards", () => {
  it("have no such switch: there is one multiplayer game, and one board a day", async () => {
    await show()
    await pressed("Multiplayer")
    expect(app.getLeaderboard).toHaveBeenLastCalledWith(INTERMEDIATE.id, "race")
    expect(screen.queryByRole("switch")).toBeNull()
    expect(screen.getByRole("group", { name: "Board" })).toBeTruthy()

    await pressed("Daily")
    expect(app.getDaily).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("switch")).toBeNull()
    expect(screen.queryByRole("group", { name: "Board" })).toBeNull()
    expect(screen.getByText(/early_bird/)).toBeTruthy()
  })

  it("leave the singleplayer switch as it was for when the player comes back to it", async () => {
    await show()
    await pressed("No guessing", "switch")
    await pressed("Multiplayer")
    await pressed("Singleplayer")
    expect(screen.getByRole("switch", { name: "No guessing" }).getAttribute("aria-checked")).toBe("false")
    expect(app.getLeaderboard).toHaveBeenLastCalledWith(INTERMEDIATE.id, "classic")
  })
})

describe("an admin", () => {
  beforeEach(() => {
    app.account = { session: { user: { id: "admin" } }, isAdmin: true }
    vi.stubGlobal("confirm", () => true)
  })

  it("takes a player's results off the leaderboard on show, and no other", async () => {
    await show()
    await pressed("Remove")
    expect(app.setScoresHidden).toHaveBeenCalledExactlyOnceWith({ kind: "singleplayer", mode: "noGuess", userId: "noGuess_champion", ...INTERMEDIATE.settings }, true)

    await pressed("No guessing", "switch")
    await pressed("Remove")
    expect(app.setScoresHidden).toHaveBeenLastCalledWith({ kind: "singleplayer", mode: "classic", userId: "classic_champion", ...INTERMEDIATE.settings }, true)
  })

  it("does the same in multiplayer and on the day's board, which have only the one", async () => {
    await show()
    await pressed("Multiplayer")
    await pressed("Remove")
    expect(app.setScoresHidden).toHaveBeenLastCalledWith({ kind: "multiplayer", userId: "race_champion", ...INTERMEDIATE.settings }, true)
    await pressed("Daily")
    await pressed("Remove")
    expect(app.setScoresHidden).toHaveBeenLastCalledWith({ kind: "daily", userId: "early_bird", date: "2026-10-11" }, true)
  })
})

// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { coveredBoard, uncover } from "../../shared/engine/board"
import { cellAt, colOf, rowOf } from "../../shared/engine/field"
import { generateField } from "../../shared/engine/generate"
import { seedFrom } from "../../shared/engine/testing"
import { viewOf } from "../../shared/engine/view"
import { BEGINNER_BOARD } from "../../shared/game/boards"
import type { LiveGame } from "../lib/connection"
import { useSoloGame } from "./useSoloGame"

// Who is signed in and what the server has said, as a test sets them: the hook reads both from the app's contexts
const app = vi.hoisted(() => ({
  account: { session: null as { user: { id: string } } | null, refreshProfile: () => Promise.resolve() },
  connection: {
    status: "connecting" as string,
    game: null as unknown,
    startSolo: (..._: unknown[]) => {},
    endSolo: () => {},
    reveal: (..._: unknown[]) => {},
    flag: (..._: unknown[]) => {},
  },
}))
vi.mock("../context/AccountContext", () => ({ useAccount: () => app.account }))
vi.mock("../context/ConnectionContext", () => ({ useConnection: () => app.connection }))
// every board made in the browser here is made from the same seed, so a test can know where its mines are
vi.mock("../../shared/engine/seed", async (original) => ({ ...await original<object>(), randomSeed: () => seedFrom(1) }))

const OPENING = { row: 4, col: 4 }
const { field } = generateField(BEGINNER_BOARD, seedFrom(1), { opening: cellAt(9, OPENING.row, OPENING.col) })
const positions = (mines: boolean) => [...field.mines].flatMap((mine, at) => (Boolean(mine) === mines ? [{ row: rowOf(9, at), col: colOf(9, at) }] : []))
const [MINE] = positions(true)

// the game the server would be running after that first click, as it reports it
const serverGame = (changes: Partial<LiveGame> = {}): LiveGame => ({
  id: 11, mode: "noGuess", settings: BEGINNER_BOARD, opening: OPENING, elapsedMs: 0, cells: ".".repeat(40) + "0" + ".".repeat(40), cooldownMs: 0,
  outcome: "playing", durationMs: null, mineHits: 0, percent: 1, layout: null, startedAt: Date.now(), cooldownUntil: 0, ...changes,
})

function signIn() {
  app.account = { ...app.account, session: { user: { id: "ann" } } }
  app.connection = { ...app.connection, status: "connected" }
}

// the hook, on a Beginner board
function setUp() {
  localStorage.setItem("rows", "9")
  localStorage.setItem("cols", "9")
  localStorage.setItem("mines", "10")
  return renderHook(() => useSoloGame())
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_000_000)
  app.account = { session: null, refreshProfile: vi.fn(() => Promise.resolve()) }
  app.connection = { status: "connecting", game: null, startSolo: vi.fn(), endSolo: vi.fn(), reveal: vi.fn(), flag: vi.fn() }
})

describe("the board", () => {
  it("starts out ready, at the size last chosen", () => {
    const { result } = setUp()
    expect(result.current.settings).toEqual(BEGINNER_BOARD)
    expect(result.current.view).toMatchObject({ status: "ready", rows: 9, cols: 9, uncovered: 0 })
    expect(result.current).toMatchObject({ seconds: 0, progress: 0, showResult: false, origin: null })
  })

  it("is whatever is chosen next, remembered for the next visit", () => {
    const { result } = setUp()
    act(() => result.current.chooseBoard({ rows: 16, cols: 16, mines: 40 }))
    expect(result.current.settings).toEqual({ rows: 16, cols: 16, mines: 40 })
    expect(result.current.view.cells).toHaveLength(256)
    expect([localStorage.getItem("rows"), localStorage.getItem("cols"), localStorage.getItem("mines")]).toEqual(["16", "16", "40"])
  })

  it("never has more mines than it can hold, and gets the ones it was short of back when it grows", () => {
    const { result } = setUp()
    act(() => result.current.chooseBoard({ rows: 4, cols: 4, mines: 40 }))
    expect(result.current.settings).toEqual({ rows: 4, cols: 4, mines: 7 })
    expect(result.current.maxMines).toBe(7)
    act(() => result.current.chooseBoard({ ...result.current.settings, rows: 16, cols: 16, mines: 40 }))
    expect(result.current.settings.mines).toBe(40)
  })

  it("is never smaller than the smallest board, whatever was saved", () => {
    localStorage.setItem("rows", "2")
    localStorage.setItem("cols", "1")
    localStorage.setItem("mines", "3")
    expect(renderHook(() => useSoloGame()).result.current.settings).toEqual({ rows: 4, cols: 4, mines: 3 })
  })
})

describe("played in the browser, by someone who isn't signed in", () => {
  it("starts with the first click, and isn't kept", () => {
    const { result } = setUp()
    act(() => result.current.click(4, 4))
    expect(result.current.view.status).toBe("playing")
    expect(result.current.view.uncovered).toBeGreaterThan(8)
    expect(result.current.origin).toEqual(OPENING)
    expect(result.current.saved).toBe(false)
    expect(app.connection.startSolo).not.toHaveBeenCalled()
  })

  it("counts the seconds as it goes", () => {
    const { result } = setUp()
    act(() => result.current.click(4, 4))
    act(() => { vi.advanceTimersByTime(3200) })
    expect(result.current.seconds).toBe(3)
  })

  it("flags a covered cell, and won't uncover one that is flagged", () => {
    const { result } = setUp()
    act(() => result.current.click(4, 4))
    act(() => result.current.flag(MINE.row, MINE.col))
    expect(result.current.view.flagged).toBe(1)
    act(() => result.current.click(MINE.row, MINE.col))
    expect(result.current.view.status).toBe("playing")
  })

  it("can't be flagged before it has begun", () => {
    const { result } = setUp()
    act(() => result.current.flag(0, 0))
    expect(result.current.view).toMatchObject({ status: "ready", flagged: 0 })
  })

  it("is lost on a mine, from which the loss plays out, and the result comes up once that is over", () => {
    const { result } = setUp()
    act(() => result.current.click(4, 4))
    act(() => { vi.advanceTimersByTime(5000) })
    act(() => result.current.click(MINE.row, MINE.col))
    expect(result.current.view.status).toBe("lost")
    expect(result.current.origin).toEqual(MINE)
    // every mine is on the board now, for the loss to play out over
    expect(result.current.view.layout).toContain("1")
    expect(result.current.showResult).toBe(false)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.showResult).toBe(true)
    // the clock stopped where the game did
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(result.current.seconds).toBe(5)
  })

  it("is won by uncovering everything else", () => {
    const { result } = setUp()
    act(() => result.current.click(4, 4))
    for (const { row, col } of positions(false)) {
      if (result.current.view.cells[cellAt(9, row, col)] === ".") act(() => result.current.click(row, col))
    }
    expect(result.current.view.status).toBe("won")
    expect(result.current.progress).toBe(88)
  })

  it("flashes the cells a chord is waiting on rather than doing nothing", () => {
    const { result } = setUp()
    act(() => result.current.click(4, 4))
    const number = [...result.current.view.cells].findIndex(cell => cell >= "1" && cell <= "8")
    act(() => result.current.click(rowOf(9, number), colOf(9, number)))
    expect(result.current.chordHint).toMatchObject({ row: rowOf(9, number), col: colOf(9, number) })
  })

  it("starts over on reset, with a board nobody has played on", () => {
    const { result } = setUp()
    act(() => result.current.click(4, 4))
    const before = result.current.resetKey
    act(() => result.current.reset())
    expect(result.current.view.status).toBe("ready")
    expect(result.current).toMatchObject({ seconds: 0, origin: null, showResult: false })
    expect(result.current.resetKey).toBe(before + 1)
  })

  it("starts over when another board is chosen", () => {
    const { result } = setUp()
    act(() => result.current.click(4, 4))
    act(() => result.current.chooseBoard({ rows: 16, cols: 30, mines: 99 }))
    expect(result.current.view).toMatchObject({ status: "ready", cols: 30 })
  })
})

describe("which game is played", () => {
  it("is the one whose boards need no guess, until the player asks for the classic one", () => {
    const { result } = setUp()
    expect(result.current.mode).toBe("noGuess")
    act(() => result.current.chooseMode("classic"))
    expect(result.current.mode).toBe("classic")
    act(() => result.current.chooseMode("noGuess"))
    expect(result.current.mode).toBe("noGuess")
  })

  it("is remembered for the next visit", () => {
    const first = setUp()
    act(() => first.result.current.chooseMode("classic"))
    expect(localStorage.getItem("soloMode")).toBe(JSON.stringify("classic"))
    first.unmount()
    expect(setUp().result.current.mode).toBe("classic")
  })

  it("is the usual one when what was remembered isn't a game that can be played here", () => {
    for (const saved of ["daily", "race", "bogus", 7]) {
      localStorage.setItem("soloMode", JSON.stringify(saved))
      const { result, unmount } = setUp()
      expect(result.current.mode).toBe("noGuess")
      unmount()
    }
  })

  it("is asked of the server with the first click", () => {
    signIn()
    const { result } = setUp()
    act(() => result.current.chooseMode("classic"))
    act(() => result.current.click(4, 4))
    expect(app.connection.startSolo).toHaveBeenCalledExactlyOnceWith("classic", { settings: BEGINNER_BOARD, opening: OPENING })
  })

  it("is played here in the browser just the same, for someone who isn't signed in", () => {
    // on a board this size chance nearly always lays one that needs a guess, which the usual game would not
    localStorage.setItem("rows", "16")
    localStorage.setItem("cols", "30")
    localStorage.setItem("mines", "99")
    const cellsAfterOpening = (mode: "classic" | "noGuess") => {
      const { result, unmount } = renderHook(() => useSoloGame())
      act(() => result.current.chooseMode(mode))
      act(() => result.current.click(8, 15))
      const { cells } = result.current.view
      unmount()
      return cells
    }
    const expert = { rows: 16, cols: 30, mines: 99 }
    const opened = (guessFree: boolean) => {
      const made = generateField(expert, seedFrom(1), { opening: cellAt(30, 8, 15), guessFree })
      return viewOf(uncover(coveredBoard(made.field), made.opening).board)
    }
    expect(opened(false)).not.toBe(opened(true))
    expect(cellsAfterOpening("classic")).toBe(opened(false))
    expect(cellsAfterOpening("noGuess")).toBe(opened(true))
  })

  it("starts over when it is changed, giving up a game the server was running", () => {
    signIn()
    const { result, rerender } = setUp()
    act(() => result.current.click(4, 4))
    app.connection = { ...app.connection, game: serverGame() }
    rerender()
    expect(result.current.view.status).toBe("playing")

    act(() => result.current.chooseMode("classic"))
    expect(app.connection.endSolo).toHaveBeenCalledTimes(1)
    expect(result.current.view.status).toBe("ready")
    expect(result.current.mode).toBe("classic")
  })

  it("is the game being played for as long as one is, whatever has been chosen for the next", () => {
    signIn()
    // a classic game picked back up from the server, in a browser that has the usual one chosen
    app.connection = { ...app.connection, game: serverGame({ mode: "classic" }) }
    const { result } = setUp()
    expect(result.current.mode).toBe("classic")
    expect(localStorage.getItem("soloMode")).toBe(JSON.stringify("noGuess"))
  })
})

describe("run by the server, for someone signed in", () => {
  it("sends the first click to the server, with the board to play, and waits for the board it opens", () => {
    signIn()
    const { result } = setUp()
    expect(result.current.saved).toBe(true)
    act(() => result.current.click(4, 4))
    expect(app.connection.startSolo).toHaveBeenCalledExactlyOnceWith("noGuess", { settings: BEGINNER_BOARD, opening: OPENING })
    expect(result.current.view.status).toBe("ready")
    // a second click while waiting doesn't ask twice
    act(() => result.current.click(0, 0))
    expect(app.connection.startSolo).toHaveBeenCalledTimes(1)
  })

  it("draws what the server says, and sends it every move", () => {
    signIn()
    const { result, rerender } = setUp()
    act(() => result.current.click(4, 4))
    app.connection = { ...app.connection, game: serverGame() }
    rerender()
    expect(result.current.view).toMatchObject({ status: "playing", uncovered: 1 })
    expect(result.current.saved).toBe(true)

    act(() => result.current.click(0, 0))
    expect(app.connection.reveal).toHaveBeenCalledExactlyOnceWith(0, 0)
    act(() => result.current.flag(8, 8))
    expect(app.connection.flag).toHaveBeenCalledExactlyOnceWith(8, 8)
  })

  it("doesn't trouble the server with a click that can't do anything", () => {
    signIn()
    app.connection = { ...app.connection, game: serverGame({ cells: "F1" + ".".repeat(79) }) }
    const { result } = setUp()
    // a flagged cell is left alone; a number with its mine flagged is a chord, which is the server's to make
    act(() => result.current.click(0, 0))
    expect(app.connection.reveal).not.toHaveBeenCalled()
    act(() => result.current.click(0, 1))
    expect(app.connection.reveal).toHaveBeenCalledExactlyOnceWith(0, 1)
  })

  it("follows the server's clock, and its word on how long the game lasted", () => {
    signIn()
    app.connection = { ...app.connection, game: serverGame({ startedAt: Date.now() - 42_000 }) }
    const { result, rerender } = setUp()
    expect(result.current.seconds).toBe(42)
    app.connection = { ...app.connection, game: serverGame({ outcome: "cleared", durationMs: 61_900, startedAt: Date.now() - 42_000 }) }
    rerender()
    expect(result.current.seconds).toBe(61)
    expect(result.current.view.status).toBe("won")
  })

  it("fetches the player's profile again once a game has ended: their stats have changed", () => {
    signIn()
    app.connection = { ...app.connection, game: serverGame({ outcome: "lost", durationMs: 9000, cells: "*" + ".".repeat(80), layout: "1" + "0".repeat(80) }) }
    const { result } = setUp()
    expect(result.current.origin).toEqual({ row: 0, col: 0 })
    expect(app.account.refreshProfile).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(app.account.refreshProfile).toHaveBeenCalledTimes(1)
  })

  it("gives the game up on the server when it is reset, and shows a fresh board without waiting to hear back", () => {
    signIn()
    app.connection = { ...app.connection, game: serverGame() }
    const { result } = setUp()
    act(() => result.current.reset())
    expect(app.connection.endSolo).toHaveBeenCalledTimes(1)
    // the server's game is still the last thing it said, but it has been put away here
    expect(result.current.view.status).toBe("ready")
    expect(result.current.saved).toBe(true)
  })

  it("leaves another page's game alone: the day's challenge isn't the singleplayer board", () => {
    signIn()
    app.connection = { ...app.connection, game: serverGame({ mode: "daily" }) }
    const { result } = setUp()
    expect(result.current.view.status).toBe("ready")
    act(() => result.current.reset())
    expect(app.connection.endSolo).not.toHaveBeenCalled()
  })
})

describe("when the server doesn't answer", () => {
  it("plays the game in the browser instead, from the same first click, and says it isn't kept", () => {
    signIn()
    const { result } = setUp()
    act(() => result.current.click(4, 4))
    act(() => { vi.advanceTimersByTime(2400) })
    expect(result.current.view.status).toBe("ready")
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current.view.status).toBe("playing")
    expect(result.current.view.cells[cellAt(9, 4, 4)]).toBe("0")
    expect(result.current.saved).toBe(false)
  })

  it("hands back the server's game if it turns up after all", () => {
    signIn()
    const { result, rerender } = setUp()
    act(() => result.current.click(4, 4))
    act(() => { vi.advanceTimersByTime(2600) })
    const cells = result.current.view.cells
    app.connection = { ...app.connection, game: serverGame() }
    rerender()
    expect(app.connection.endSolo).toHaveBeenCalledTimes(1)
    // and goes on with the one being played here
    expect(result.current.view.cells).toBe(cells)
  })

  it("goes back to the server for the next game", () => {
    signIn()
    const { result } = setUp()
    act(() => result.current.click(4, 4))
    act(() => { vi.advanceTimersByTime(2600) })
    act(() => result.current.reset())
    expect(result.current.saved).toBe(true)
    act(() => result.current.click(2, 2))
    expect(app.connection.startSolo).toHaveBeenCalledTimes(2)
  })

  it("plays in the browser straight away while the connection is down", () => {
    app.account = { ...app.account, session: { user: { id: "ann" } } }
    const { result } = setUp()
    expect(result.current.saved).toBe(false)
    act(() => result.current.click(4, 4))
    expect(result.current.view.status).toBe("playing")
    expect(app.connection.startSolo).not.toHaveBeenCalled()
  })
})

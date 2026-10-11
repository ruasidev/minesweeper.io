// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../context/ThemeContext"
import { readyView } from "../../lib/boardView"
import { BEGINNER_BOARD, BOARD_PRESETS } from "../../../shared/game/boards"
import type { SoloGame } from "../../hooks/useSoloGame"
import GameDock from "./GameDock"

// the singleplayer game as a test sets it: the dock only reads it, and says what was asked of it
const solo = vi.hoisted(() => ({ game: {} as Partial<SoloGame> }))
vi.mock("../../context/SoloGameContext", () => ({ useSoloGameContext: () => solo.game }))

const dock = () => render(<ThemeProvider><GameDock /></ThemeProvider>)

beforeEach(() => {
  solo.game = {
    settings: BEGINNER_BOARD, maxMines: 72, mode: "noGuess", view: readyView(BEGINNER_BOARD),
    chooseBoard: vi.fn(), chooseMode: vi.fn(), reset: vi.fn(),
  }
})

describe("before a game", () => {
  it("has the classic boards a press away, with the one chosen marked", () => {
    dock()
    expect(screen.getByRole("button", { name: "Beginner" }).getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Expert" }))
    expect(solo.game.chooseBoard).toHaveBeenCalledExactlyOnceWith(BOARD_PRESETS[2].settings)
  })

  it("keeps the rest of what a board can be behind its last button", () => {
    dock()
    expect(screen.queryByRole("switch")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Board options" }))
    expect(screen.getByRole("heading", { name: "Board options" })).toBeTruthy()
    expect(screen.getByRole("switch", { name: "No guessing" }).getAttribute("aria-checked")).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    expect(screen.queryByRole("switch")).toBeNull()
  })

  it("asks for the classic game when No guessing is switched off, and for the usual one when it is switched back on", () => {
    const first = dock()
    fireEvent.click(screen.getByRole("button", { name: "Board options" }))
    fireEvent.click(screen.getByRole("switch", { name: "No guessing" }))
    expect(solo.game.chooseMode).toHaveBeenCalledExactlyOnceWith("classic")
    first.unmount()

    solo.game = { ...solo.game, mode: "classic", chooseMode: vi.fn() }
    dock()
    fireEvent.click(screen.getByRole("button", { name: /^Board options/ }))
    const setting = screen.getByRole("switch", { name: "No guessing" })
    expect(setting.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(setting)
    expect(solo.game.chooseMode).toHaveBeenCalledExactlyOnceWith("noGuess")
  })

  it("says on that button when boards are being laid by chance, since nothing else on a fresh board does", () => {
    solo.game = { ...solo.game, mode: "classic" }
    dock()
    expect(screen.getByRole("button", { name: "Board options (boards may need a guess)" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Board options" })).toBeNull()
  })
})

describe("once a game is over", () => {
  it("offers the next one", () => {
    solo.game = { ...solo.game, view: { ...readyView(BEGINNER_BOARD), status: "lost" } }
    dock()
    fireEvent.click(screen.getByRole("button", { name: "New game" }))
    expect(solo.game.reset).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("button", { name: "Beginner" })).toBeNull()
  })
})

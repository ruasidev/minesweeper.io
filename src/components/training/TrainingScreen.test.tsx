// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GameAnimationProvider } from "../../context/GameAnimationContext"
import { SettingsProvider } from "../../context/SettingsContext"
import { ThemeProvider } from "../../context/ThemeContext"
import { loadLocalDeck } from "../../lib/training"
import { PATTERNS } from "../../../shared/training/patterns"
import type { Trial } from "../../../shared/training/trial"
import TrainingScreen from "./TrainingScreen"

// nobody is signed in: progress is kept in the browser, and the server is never asked for anything
vi.mock("../../context/AccountContext", () => ({ useAccount: () => ({ session: null, isPending: false }) }))
vi.mock("../../lib/api", () => ({}))

// every round as it is made, so that a test knows what there is to find on the one on the board
const made = vi.hoisted(() => ({ trials: [] as Trial[] }))
vi.mock("../../../shared/training/trial", async (original) => {
  const actual = await original<typeof import("../../../shared/training/trial")>()
  return {
    ...actual,
    makeTrial: (...args: Parameters<typeof actual.makeTrial>) => {
      const trial = actual.makeTrial(...args)
      made.trials.push(trial)
      return trial
    },
  }
})

const onOpenAuth = vi.fn()
// the page as the app has it: in the page's own part of the screen, with something of the app's beside it
const show = (...view: string[]) => render(
  <ThemeProvider>
    <SettingsProvider>
      <GameAnimationProvider>
        <main><TrainingScreen view={view} onOpenAuth={onOpenAuth} /></main>
        <nav><button>Elsewhere</button></nav>
      </GameAnimationProvider>
    </SettingsProvider>
  </ThemeProvider>,
)
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }))
const key = (pressed: string) => act(() => { fireEvent.keyDown(window, { key: pressed }) })
const cell = (trial: Trial, at: number) => document.querySelector(`[data-cell="${Math.floor(at / trial.board.field.cols)},${at % trial.board.field.cols}"]`)!
const onBoard = () => made.trials.at(-1)!

// finds everything there is to find on the round on the board, the quickest way
function solve() {
  const trial = onBoard()
  if (trial.find.safe.length > 0) trial.find.safe.forEach(at => fireEvent.click(cell(trial, at)))
  else trial.find.mines.forEach(at => fireEvent.contextMenu(cell(trial, at)))
}

beforeEach(() => {
  made.trials = []
  // (time stands still: nothing is got ready behind the board, so every round is one that was seen being made)
  vi.useFakeTimers({ now: 1_800_000_000_000 })
})
afterEach(() => {
  vi.useRealTimers()
})

describe("the training page", () => {
  it("lists what there is to practise, with how far along the player is", () => {
    show()
    expect(screen.getByRole("heading", { name: "Training" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Pattern training" })).toBeTruthy()
    expect(screen.getByText(`0 of ${PATTERNS.length} learned`)).toBeTruthy()
    expect(screen.getByRole("progressbar", { name: "Patterns learned" }).getAttribute("aria-valuenow")).toBe("0")
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy()
  })

  it("tells a visitor where their progress is kept, and offers them an account", () => {
    show()
    expect(screen.getByText(/kept in this browser/)).toBeTruthy()
    press("Sign up")
    expect(onOpenAuth).toHaveBeenCalledExactlyOnceWith("signUp")
  })
})

describe("pattern training", () => {
  it("puts a round on the board and says what to do with it, and a little more the first time", () => {
    show("patterns")
    expect(document.querySelectorAll("[data-cell]").length).toBe(onBoard().board.cells.length)
    expect(screen.getByText("Open what must be safe, or flag what must be a mine.")).toBeTruthy()
    expect(screen.getByText(/a lucky guess is a miss/)).toBeTruthy()
    // the pattern isn't named until the round is over: seeing which it is, is the round
    expect(screen.queryByText(/see why/)).toBeNull()
  })

  it("asks how a solved round felt, and one press of the answer is the next round", () => {
    show("patterns")
    solve()
    expect(screen.getByRole("group", { name: "How did that feel?" })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Good.*in 10 min/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Easy.*in 4 days/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /All mines.*see why/ })).toBeTruthy()
    expect(made.trials).toHaveLength(1)
    key("2")
    expect(made.trials).toHaveLength(2)
    expect(screen.getByText("Open what must be safe, or flag what must be a mine.")).toBeTruthy()
    expect(loadLocalDeck().allMines).toMatchObject({ phase: "learning", step: 1 })
    // a player who has done both has been shown how: neither is explained again
    expect(screen.queryByText(/a lucky guess is a miss/)).toBeNull()
    solve()
    expect(screen.queryByText(/How did that feel\? Your answer/)).toBeNull()
    press(/Easy/)
    expect(made.trials).toHaveLength(3)
    expect(loadLocalDeck().allSafe).toMatchObject({ phase: "review", interval: 4 })
  })

  it("takes the space bar for the answer that is ready", () => {
    show("patterns")
    solve()
    key(" ")
    expect(made.trials).toHaveLength(2)
    // nothing but an instant went by: it was easy
    expect(loadLocalDeck().allMines).toMatchObject({ phase: "review", interval: 4 })
  })

  it("leaves a key alone that was pressed on something outside the page", () => {
    show("patterns")
    solve()
    act(() => { fireEvent.keyDown(screen.getByRole("button", { name: "Elsewhere" }), { key: " " }) })
    expect(made.trials).toHaveLength(1)
    // ...and takes one pressed on something of its own
    act(() => { fireEvent.keyDown(screen.getByRole("button", { name: /Hard/ }), { key: " " }) })
    expect(made.trials).toHaveLength(2)
  })

  it("shows what there was to find after a miss, explains nothing, and moves on at a press", () => {
    show("patterns")
    press("Show me")
    expect(screen.getByText("This was there to find.")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Next.*back in 1 min/ })).toBeTruthy()
    expect(screen.queryByText(/Step 1 of/)).toBeNull()
    expect(loadLocalDeck().allMines).toMatchObject({ phase: "learning", step: 0, reviews: 1 })
    // the board is only to look at now
    fireEvent.click(cell(onBoard(), onBoard().find.mines[0]))
    expect(screen.queryByText("That was a mine.")).toBeNull()
    key(" ")
    expect(made.trials).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Show me" })).toBeTruthy()
  })

  it("says what kind of miss it was, and lets the cell it was missed on be asked about", () => {
    show("patterns")
    const trial = onBoard()
    fireEvent.click(cell(trial, trial.find.mines[0]))
    expect(screen.getByText("That was a mine.")).toBeTruthy()
    press("Why?")
    expect(screen.getByText("Step 1 of 2")).toBeTruthy()
  })

  it("explains the pattern on the board, a step at a time, when its name is pressed", () => {
    show("patterns")
    press("Show me")
    press(/All mines.*see why/)
    expect(screen.getByText("Step 1 of 2")).toBeTruthy()
    expect(screen.getByText(/^This \d has \w+ mines? in th/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Next/ })).toBeNull()
    key("ArrowRight")
    expect(screen.getByText("Step 2 of 2")).toBeTruthy()
    expect(screen.getByText("It needs every cell it has: each one is a mine.")).toBeTruthy()
    key("ArrowLeft")
    expect(screen.getByText("Step 1 of 2")).toBeTruthy()
    // out of it by the key, or by stepping past the end, and back where it was left
    key("Escape")
    expect(screen.getByRole("button", { name: /Next/ })).toBeTruthy()
    press(/All mines.*see why/)
    press("The next step")
    press("Done")
    expect(screen.getByRole("button", { name: /Next/ })).toBeTruthy()
    expect(made.trials).toHaveLength(1)
  })

  it("brings the first-time lines back when asked how it works", () => {
    show("patterns")
    press("Show me")
    key(" ")
    expect(screen.queryByText(/a lucky guess is a miss/)).toBeNull()
    press("How this works")
    expect(screen.getByText(/a lucky guess is a miss/)).toBeTruthy()
  })
})

describe("the list of every pattern", () => {
  it("has them all, a family at a time, with where the player stands on each", () => {
    show("patterns", "library")
    for (const heading of ["Counting", "Pairs", "Lines", "Reduction", "Holes", "Triangles", "Advanced", "Endgame"]) expect(screen.getByRole("heading", { name: heading })).toBeTruthy()
    for (const pattern of PATTERNS) expect(screen.getByText(pattern.rule)).toBeTruthy()
    expect(screen.getAllByText("Not met yet")).toHaveLength(PATTERNS.length)
  })

  it("shows a pattern at work on a board when it is opened, and another board when asked", () => {
    show("patterns", "library")
    fireEvent.click(screen.getByText(PATTERNS.find(pattern => pattern.id === "oneTwoOne")!.rule))
    expect(screen.getByText("Step 1 of 5")).toBeTruthy()
    const first = onBoard()
    expect(document.querySelectorAll("[data-cell]").length).toBe(first.board.cells.length)
    press("Another example")
    expect(onBoard()).not.toBe(first)
    expect(onBoard().pattern).toBe("oneTwoOne")
    expect(screen.getByText("Step 1 of 5")).toBeTruthy()
  })
})

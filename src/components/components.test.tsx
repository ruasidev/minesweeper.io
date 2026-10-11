// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { useState, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { InputModeContext } from "../context/InputModeContext"
import { ThemeProvider } from "../context/ThemeContext"
import type { ScoreEntry } from "../lib/api"
import NumberInput from "./app/NumberInput"
import Segmented from "./app/Segmented"
import Switch from "./app/Switch"
import { FlagToggle } from "./minesweeper/Dock"
import OpponentBox from "./multiplayer/OpponentBox"
import ScoreTable from "./scores/ScoreTable"

// nobody is signed in: a player's name is just a name, with no profile behind it to open
vi.mock("../context/AccountContext", () => ({ useAccount: () => ({ session: null }) }))

const themed = (ui: ReactNode) => render(<ThemeProvider>{ui}</ThemeProvider>)

describe("Segmented", () => {
  const options = [{ id: "a", label: "Singleplayer" }, { id: "b", label: "Multiplayer" }, { id: "c", label: "Daily" }]

  it("marks the one chosen, and says which was pressed", () => {
    const onChange = vi.fn()
    themed(<Segmented label="Kind of game" options={options} value="b" onChange={onChange} />)
    expect(screen.getByRole("group", { name: "Kind of game" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Multiplayer" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByRole("button", { name: "Daily" }).getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(screen.getByRole("button", { name: "Daily" }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith("c")
  })
})

describe("Switch", () => {
  function Setting({ start }: { start: boolean }) {
    const [on, setOn] = useState(start)
    return <Switch label="No guessing" checked={on} onChange={setOn}>{on ? "Never a guess." : "Sometimes a guess."}</Switch>
  }

  it("says what it is, whether it is on, and what that means", () => {
    themed(<Setting start />)
    const setting = screen.getByRole("switch", { name: "No guessing" })
    expect(setting.getAttribute("aria-checked")).toBe("true")
    expect(document.getElementById(setting.getAttribute("aria-describedby")!)?.textContent).toBe("Never a guess.")
  })

  it("goes off and on again when it is pressed", () => {
    themed(<Setting start />)
    const setting = screen.getByRole("switch", { name: "No guessing" })
    fireEvent.click(setting)
    expect(setting.getAttribute("aria-checked")).toBe("false")
    expect(screen.getByText("Sometimes a guess.")).toBeTruthy()
    fireEvent.click(setting)
    expect(setting.getAttribute("aria-checked")).toBe("true")
  })

  it("asks for the other of the two, and changes nothing by itself", () => {
    const onChange = vi.fn()
    themed(<Switch label="Sound" checked={false} onChange={onChange} />)
    const setting = screen.getByRole("switch", { name: "Sound" })
    fireEvent.click(setting)
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true)
    expect(setting.getAttribute("aria-checked")).toBe("false")
    expect(setting.hasAttribute("aria-describedby")).toBe(false)
  })
})

describe("NumberInput", () => {
  it("reports what its slider is dragged to", () => {
    const onChange = vi.fn()
    themed(<NumberInput label="Rows" value={10} min={4} max={30} onChange={onChange} />)
    fireEvent.change(screen.getByRole("slider", { name: "Rows" }), { target: { value: "16" } })
    expect(onChange).toHaveBeenCalledExactlyOnceWith(16)
  })

  it("steps one at a time with its buttons, where it has them", () => {
    const onChange = vi.fn()
    themed(<NumberInput stepper label="Mines" value={10} min={1} max={99} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "One more Mines" }))
    fireEvent.click(screen.getByRole("button", { name: "One fewer Mines" }))
    expect(onChange.mock.calls).toEqual([[11], [9]])
  })

  it("won't step past either end", () => {
    const { unmount } = themed(<NumberInput stepper label="Mines" value={1} min={1} max={99} onChange={() => {}} />)
    expect((screen.getByRole("button", { name: "One fewer Mines" }) as HTMLButtonElement).disabled).toBe(true)
    unmount()
    themed(<NumberInput stepper label="Mines" value={99} min={1} max={99} onChange={() => {}} />)
    expect((screen.getByRole("button", { name: "One more Mines" }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("shows the figure with its unit", () => {
    themed(<NumberInput label="size" unit="px" value={40} onChange={() => {}} />)
    expect(screen.getByText("40px")).toBeTruthy()
  })
})

describe("FlagToggle", () => {
  function Toggle() {
    const [flagMode, setFlagMode] = useState(false)
    return <InputModeContext.Provider value={{ flagMode, setFlagMode }}><FlagToggle /></InputModeContext.Provider>
  }

  it("starts on Dig and switches to Flag and back", () => {
    themed(<Toggle />)
    const dig = screen.getByRole("button", { name: "Dig" }), flag = screen.getByRole("button", { name: "Flag" })
    expect([dig, flag].map(button => button.getAttribute("aria-pressed"))).toEqual(["true", "false"])
    fireEvent.click(flag)
    expect([dig, flag].map(button => button.getAttribute("aria-pressed"))).toEqual(["false", "true"])
    fireEvent.click(dig)
    expect(dig.getAttribute("aria-pressed")).toBe("true")
  })
})

describe("OpponentBox", () => {
  const player = { id: "bob", username: "bob", image: null }
  const progress = { sections: [10, 5, 0, 0], percent: 42, mineHits: 0, finishedMs: null, outcome: "playing" as const, place: 2, ratingChange: null }

  it("shows who it is and how far along they are", () => {
    themed(<OpponentBox player={player} progress={progress} sectionCols={2} />)
    expect(screen.getByText("@bob")).toBeTruthy()
    expect(screen.getByText("42%")).toBeTruthy()
  })

  it("says how many mines they have hit", () => {
    themed(<OpponentBox player={player} progress={{ ...progress, mineHits: 2 }} sectionCols={2} />)
    expect(screen.getByText("42% · 2 mines hit")).toBeTruthy()
  })

  it("gives the time of someone who has finished", () => {
    themed(<OpponentBox player={player} progress={{ ...progress, outcome: "cleared", finishedMs: 83_450, percent: 100 }} sectionCols={2} />)
    expect(screen.getByText("Finished in 1:23.4")).toBeTruthy()
  })

  it("is a button to watch them, where it is given something to do when pressed", () => {
    const onSpectate = vi.fn()
    themed(<OpponentBox player={player} progress={progress} sectionCols={2} onSpectate={onSpectate} />)
    fireEvent.click(screen.getByRole("button", { name: /Spectate/ }))
    expect(onSpectate).toHaveBeenCalledOnce()
  })

  it("is cut down to a thumbnail and two lines as a chip", () => {
    themed(<OpponentBox chip player={player} progress={{ ...progress, outcome: "gaveUp" }} sectionCols={2} />)
    expect(screen.getByText("@bob")).toBeTruthy()
    expect(screen.getByText("Gave up · 42%")).toBeTruthy()
  })
})

describe("ScoreTable", () => {
  const entry = (userId: string, durationMs: number, mineHits = 0): ScoreEntry =>
    ({ userId, username: userId, image: null, durationMs, mineHits, at: "2026-10-08T12:00:00Z" })
  const entries = [entry("ann", 61_000), entry("bob", 75_500, 2), entry("cat", 90_000), entry("dee", 120_000)]

  it("lists the players in the order given, each with their place and their time", () => {
    themed(<ScoreTable entries={entries} emptyText="Nobody yet" />)
    const rows = screen.getAllByRole("row").slice(1)
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringMatching(/^1@ann.*1:01\.0$/),
      expect.stringMatching(/^2@bob.*1:15\.5$/),
      expect.stringMatching(/^3@cat.*1:30\.0$/),
      expect.stringMatching(/^4@dee.*2:00\.0$/),
    ])
  })

  it("marks the row of the player looking at it", () => {
    themed(<ScoreTable entries={entries} emptyText="Nobody yet" highlightUserId="bob" />)
    expect(screen.getByText("You").closest("tr")!.textContent).toContain("@bob")
    expect(screen.getAllByText("You")).toHaveLength(1)
  })

  it("leaves out the columns it is told aren't wanted", () => {
    themed(<ScoreTable entries={entries} emptyText="Nobody yet" hideMineHits />)
    expect(screen.queryByText("Mines hit")).toBeNull()
    expect(screen.queryByText("Set on")).toBeNull()
  })

  it("gives admins a way to take a result off, row by row", () => {
    const onRemove = vi.fn()
    themed(<ScoreTable entries={entries} emptyText="Nobody yet" onRemove={onRemove} />)
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1])
    expect(onRemove).toHaveBeenCalledExactlyOnceWith(entries[1])
  })

  it("says so when nobody is on the board yet", () => {
    themed(<ScoreTable entries={[]} emptyText="Nobody has cleared this board yet." />)
    expect(screen.getByText("Nobody has cleared this board yet.")).toBeTruthy()
    expect(screen.queryByRole("table")).toBeNull()
  })
})

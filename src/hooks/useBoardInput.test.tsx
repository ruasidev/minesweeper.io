// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { InputModeContext } from "../context/InputModeContext"
import { SettingsProvider } from "../context/SettingsContext"
import { boardView, readyView, type BoardView } from "../lib/boardView"
import { useBoardInput } from "./useBoardInput"

// One mine in the corner, and only the number furthest from it uncovered: the rest is covered, to be pressed
//   ##
//   #1
const BOARD = boardView({ rows: 2, cols: 2, mines: 1 }, "...1", "playing")

function Grid({ board, onUncover, onFlag }: { board: BoardView, onUncover: (row: number, col: number) => void, onFlag: (row: number, col: number) => void }) {
  const input = useBoardInput(board, onUncover, onFlag)
  return (
    <div data-testid="grid" {...input}>
      {Array.from(board.cells, (_, at) => {
        const mark = `${Math.floor(at / board.cols)},${at % board.cols}`
        return <button key={mark} data-cell={mark}>{mark}</button>
      })}
    </div>
  )
}

function setUp({ flagMode = false, board = BOARD } = {}) {
  const onUncover = vi.fn()
  const onFlag = vi.fn()
  render(
    <SettingsProvider>
      <InputModeContext.Provider value={{ flagMode, setFlagMode: () => {} }}>
        <Grid board={board} onUncover={onUncover} onFlag={onFlag} />
      </InputModeContext.Provider>
    </SettingsProvider>,
  )
  const cell = (row: number, col: number) => screen.getByText(`${row},${col}`)
  return { onUncover, onFlag, cell }
}

// a finger going down on a cell, staying there for a while, and coming back up: which ends in a click, as it does
// in a browser
function touch(target: Element, heldMs = 0, { release = true } = {}) {
  fireEvent.pointerDown(target, { pointerType: "touch", isPrimary: true, clientX: 50, clientY: 50 })
  vi.advanceTimersByTime(heldMs)
  if (!release) return
  fireEvent.pointerUp(target, { pointerType: "touch", isPrimary: true })
  fireEvent.click(target)
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe("a mouse", () => {
  it("uncovers with the left button", () => {
    const { onUncover, onFlag, cell } = setUp()
    fireEvent.pointerDown(cell(0, 1), { pointerType: "mouse" })
    fireEvent.click(cell(0, 1))
    expect(onUncover).toHaveBeenCalledExactlyOnceWith(0, 1)
    expect(onFlag).not.toHaveBeenCalled()
  })

  it("flags with the right button, and keeps the browser's own menu away", () => {
    const { onUncover, onFlag, cell } = setUp()
    fireEvent.pointerDown(cell(0, 0), { pointerType: "mouse", button: 2 })
    const notPrevented = fireEvent.contextMenu(cell(0, 0))
    expect(onFlag).toHaveBeenCalledExactlyOnceWith(0, 0)
    expect(onUncover).not.toHaveBeenCalled()
    expect(notPrevented).toBe(false)
  })

  it("never flags by being held down", () => {
    const { onFlag, cell } = setUp()
    fireEvent.pointerDown(cell(0, 0), { pointerType: "mouse" })
    vi.advanceTimersByTime(5000)
    expect(onFlag).not.toHaveBeenCalled()
  })

  it("flags with the right button whatever the switch for fingers is on", () => {
    const { onFlag, cell } = setUp({ flagMode: true })
    fireEvent.pointerDown(cell(0, 0), { pointerType: "mouse", button: 2 })
    fireEvent.contextMenu(cell(0, 0))
    expect(onFlag).toHaveBeenCalledExactlyOnceWith(0, 0)
  })

  it("does nothing between the cells", () => {
    const { onUncover, onFlag } = setUp()
    fireEvent.click(screen.getByTestId("grid"))
    fireEvent.contextMenu(screen.getByTestId("grid"))
    expect(onUncover).not.toHaveBeenCalled()
    expect(onFlag).not.toHaveBeenCalled()
  })
})

describe("a finger", () => {
  it("uncovers with a tap", () => {
    const { onUncover, onFlag, cell } = setUp()
    touch(cell(0, 1), 80)
    expect(onUncover).toHaveBeenCalledExactlyOnceWith(0, 1)
    expect(onFlag).not.toHaveBeenCalled()
  })

  it("flags by being held, and the lift that follows isn't taken for a tap", () => {
    const { onUncover, onFlag, cell } = setUp()
    touch(cell(0, 0), 350)
    expect(onFlag).toHaveBeenCalledExactlyOnceWith(0, 0)
    expect(onUncover).not.toHaveBeenCalled()
  })

  it("flags the moment it has been held long enough, before it is lifted", () => {
    const { onFlag, cell } = setUp()
    touch(cell(0, 0), 349, { release: false })
    expect(onFlag).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onFlag).toHaveBeenCalledExactlyOnceWith(0, 0)
  })

  it("is back to tapping on the next press after a hold", () => {
    const { onUncover, cell } = setUp()
    touch(cell(0, 0), 400)
    touch(cell(0, 1), 50)
    expect(onUncover).toHaveBeenCalledExactlyOnceWith(0, 1)
  })

  it("doesn't flag if it wanders off while held: the board is being dragged", () => {
    const { onFlag, cell } = setUp()
    fireEvent.pointerDown(cell(0, 0), { pointerType: "touch", isPrimary: true, clientX: 50, clientY: 50 })
    fireEvent.pointerMove(cell(0, 0), { pointerType: "touch", clientX: 50, clientY: 61 })
    vi.advanceTimersByTime(1000)
    expect(onFlag).not.toHaveBeenCalled()
  })

  it("still flags if it only trembles while held", () => {
    const { onFlag, cell } = setUp()
    fireEvent.pointerDown(cell(0, 0), { pointerType: "touch", isPrimary: true, clientX: 50, clientY: 50 })
    fireEvent.pointerMove(cell(0, 0), { pointerType: "touch", clientX: 56, clientY: 44 })
    vi.advanceTimersByTime(350)
    expect(onFlag).toHaveBeenCalledExactlyOnceWith(0, 0)
  })

  it("doesn't flag once the browser has taken the finger over to pan with", () => {
    const { onFlag, cell } = setUp()
    fireEvent.pointerDown(cell(0, 0), { pointerType: "touch", isPrimary: true, clientX: 50, clientY: 50 })
    fireEvent.pointerCancel(cell(0, 0), { pointerType: "touch" })
    vi.advanceTimersByTime(1000)
    expect(onFlag).not.toHaveBeenCalled()
  })

  it("is not pressing a cell once a second finger joins it: the board is being pinched", () => {
    const { onUncover, onFlag, cell } = setUp()
    fireEvent.pointerDown(cell(0, 0), { pointerType: "touch", isPrimary: true, clientX: 50, clientY: 50 })
    fireEvent.pointerDown(cell(0, 1), { pointerType: "touch", isPrimary: false, clientX: 90, clientY: 50 })
    vi.advanceTimersByTime(1000)
    fireEvent.click(cell(0, 0))
    expect(onFlag).not.toHaveBeenCalled()
    expect(onUncover).not.toHaveBeenCalled()
  })

  it("flags once, on phones that also send the browser's own menu for a held finger", () => {
    const { onFlag, cell } = setUp()
    touch(cell(0, 0), 350, { release: false })
    fireEvent.contextMenu(cell(0, 0))
    expect(onFlag).toHaveBeenCalledOnce()
  })

  it("chords an uncovered number with a tap, and has nothing to flag there by holding", () => {
    const { onUncover, onFlag, cell } = setUp()
    touch(cell(1, 1), 50)
    expect(onUncover).toHaveBeenCalledExactlyOnceWith(1, 1)
    touch(cell(1, 1), 600, { release: false })
    expect(onFlag).not.toHaveBeenCalled()
  })

  it("is held for as long as the setting says", () => {
    localStorage.setItem("settings", JSON.stringify({ holdMs: 150 }))
    const { onFlag, cell } = setUp()
    touch(cell(0, 0), 149, { release: false })
    expect(onFlag).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onFlag).toHaveBeenCalledExactlyOnceWith(0, 0)
  })

  it("gives a tick in the hand when a hold lands, where the phone can", () => {
    const vibrate = vi.fn()
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { vibrate }))
    const { cell } = setUp()
    touch(cell(0, 0), 350, { release: false })
    expect(vibrate).toHaveBeenCalledOnce()
  })
})

describe("a finger with the switch on Flag", () => {
  it("flags a covered cell with a tap", () => {
    const { onUncover, onFlag, cell } = setUp({ flagMode: true })
    touch(cell(0, 0), 50)
    expect(onFlag).toHaveBeenCalledExactlyOnceWith(0, 0)
    expect(onUncover).not.toHaveBeenCalled()
  })

  it("uncovers a covered cell by being held", () => {
    const { onUncover, onFlag, cell } = setUp({ flagMode: true })
    touch(cell(0, 1), 350)
    expect(onUncover).toHaveBeenCalledExactlyOnceWith(0, 1)
    expect(onFlag).not.toHaveBeenCalled()
  })

  it("still chords an uncovered number with a tap", () => {
    const { onUncover, onFlag, cell } = setUp({ flagMode: true })
    touch(cell(1, 1), 50)
    expect(onUncover).toHaveBeenCalledExactlyOnceWith(1, 1)
    expect(onFlag).not.toHaveBeenCalled()
  })
})

describe("a board nobody has played on yet", () => {
  const fresh = readyView({ rows: 2, cols: 2, mines: 1 })

  it("is opened by a tap, even with the switch on Flag: there is nothing to flag yet", () => {
    const { onUncover, onFlag, cell } = setUp({ flagMode: true, board: fresh })
    touch(cell(0, 0))
    expect(onUncover).toHaveBeenCalledExactlyOnceWith(0, 0)
    expect(onFlag).not.toHaveBeenCalled()
  })

  it("is opened by holding a cell too, once", () => {
    const { onUncover, onFlag, cell } = setUp({ board: fresh })
    touch(cell(1, 0), 1000)
    expect(onUncover).toHaveBeenCalledExactlyOnceWith(1, 0)
    expect(onFlag).not.toHaveBeenCalled()
  })
})

import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react"
import { useInputMode } from "../context/InputModeContext"
import { useSettings } from "../context/SettingsContext"
import type { BoardView } from "../lib/boardView"
import { isOnBoard } from "../../shared/engine/field"
import { isUncovered } from "../../shared/engine/view"

// how far a finger may wander (px) and still count as holding a cell. How long it has to stay down is a setting
const HOLD_SLACK = 10

type CellAction = (row: number, col: number) => void

// the cell an event happened on, from the mark each cell carries (see Cell.tsx)
function cellAt(target: EventTarget): { row: number, col: number } | null {
  const mark = (target as HTMLElement).closest?.<HTMLElement>("[data-cell]")?.dataset.cell
  if (!mark) return null
  const [row, col] = mark.split(",").map(Number)
  return { row, col }
}

// Turns what is done to a board with a mouse or a finger into the two things that can be done to a cell: uncover it
// (which chords an uncovered number) or flag it. One set of handlers for the whole board, to go on the grid itself.
//
// - A mouse: the left button uncovers, the right button flags.
// - A finger: a tap uncovers, holding it down flags. With the switch under the board on Flag, those two swap over
//   for a covered cell, for the stretch of a game where flags are what is being placed
//
// A board nobody has played on yet has nothing to flag: whatever is done to it is its first click
export function useBoardInput(view: BoardView, onUncover: CellAction, onFlag: CellAction) {
  const { flagMode } = useInputMode()
  const { holdMs } = useSettings().settings
  // what the timer of a held finger acts on: whatever is current when it runs out, not when it was started
  const latest = useRef({ view, onUncover, onFlag, flagMode })
  useEffect(() => {
    latest.current = { view, onUncover, onFlag, flagMode }
  })

  const hold = useRef<{ timer: ReturnType<typeof setTimeout>, x: number, y: number } | null>(null)
  // the click that comes when a held finger is lifted has already been dealt with
  const swallowClick = useRef(false)
  const lastPointer = useRef("mouse")

  const letGo = () => {
    if (hold.current) clearTimeout(hold.current.timer)
    hold.current = null
  }
  useEffect(() => letGo, [])

  // Does what a tap on a cell, or holding it, means. Returns whether that was anything
  function press(row: number, col: number, held: boolean) {
    const { view, onUncover, onFlag, flagMode } = latest.current
    if (!isOnBoard(view, row, col)) return false
    if (view.status === "ready") {
      onUncover(row, col)
      return true
    }
    // an uncovered cell has nothing to flag: a tap chords it, and holding it does nothing
    if (isUncovered(view.cells[row * view.cols + col])) {
      if (!held) onUncover(row, col)
      return !held
    }
    if (held !== flagMode) onFlag(row, col)
    else onUncover(row, col)
    return true
  }

  return {
    onPointerDown(e: PointerEvent) {
      lastPointer.current = e.pointerType
      swallowClick.current = false
      letGo()
      if (e.pointerType === "mouse") return
      // a second finger: the board is being pinched, and neither finger is pressing a cell
      if (!e.isPrimary) {
        swallowClick.current = true
        return
      }
      const cell = cellAt(e.target)
      if (!cell) return
      const timer = setTimeout(() => {
        hold.current = null
        if (!press(cell.row, cell.col, true)) return
        swallowClick.current = true
        // a tick in the hand where the phone can give one, since the finger is covering what just changed
        navigator.vibrate?.(15)
      }, holdMs)
      hold.current = { timer, x: e.clientX, y: e.clientY }
    },
    onPointerMove(e: PointerEvent) {
      if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > HOLD_SLACK) letGo()
    },
    onPointerUp: letGo,
    // the browser has taken the finger over to pan the board
    onPointerCancel: letGo,
    onPointerLeave: letGo,
    onClick(e: MouseEvent) {
      if (swallowClick.current) {
        swallowClick.current = false
        return
      }
      const cell = cellAt(e.target)
      if (cell) press(cell.row, cell.col, false)
    },
    onContextMenu(e: MouseEvent) {
      e.preventDefault()
      // some phones send this for a held finger as well, which has its own timer above
      if (lastPointer.current !== "mouse") return
      const cell = cellAt(e.target)
      if (cell) latest.current.onFlag(cell.row, cell.col)
    },
  }
}

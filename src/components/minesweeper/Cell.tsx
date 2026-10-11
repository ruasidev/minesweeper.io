import { memo, useEffect, useState, type ReactNode } from "react"
import { Bomb } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { CELL_FLAGGED, CELL_MINE, isUncovered, numberOn } from "../../../shared/engine/view"
import FlagIcon from "./FlagIcon"

export type CellProps = {
  row: number
  col: number
  // what the cell shows: its character in the board's view (see shared/engine/view.ts)
  cell: string
  animationClass?: string
  animationDelay?: string
  chordHintKey?: number
  // set on a cell that a mine going off has just covered back up: which blast, and how long it takes to reach the cell
  blastId?: number
  blastDelayMs?: number
  // changes when a new game starts
  resetKey: number
}

const NUMBER_COLORS = ["", "text-blue-600", "text-green-600", "text-red-600", "text-purple-700", "text-orange-700", "text-cyan-700", "text-black", "text-gray-600"]

// One cell of a board. It only draws: its size comes from the grid it sits in (BoardViewport), and presses are
// picked up by the grid for all its cells at once (useBoardInput), which finds the cell by the mark it carries here.
// Everything it is given is a plain value, so a move redraws the handful of cells it changed and no others
function Cell({ row, col, cell, animationClass, animationDelay, chordHintKey, blastId, blastDelayMs = 0, resetKey }: CellProps) {
  const [hideValue, setHideValue] = useState(false)
  const { theme } = useTheme()
  const flagged = cell === CELL_FLAGGED
  // An uncovered mine that is simply sitting there, as it does where uncovering one doesn't end the game.
  // Where it does, an uncovered mine means the game is lost, and the loss animation takes it from here
  const openMine = cell === CELL_MINE && !animationClass
  const number = numberOn(cell)

  useEffect(() => {
    setHideValue(false)
  }, [resetKey])

  let value: ReactNode = number ? String(number) : ""
  // smaller than a number, which leaves it room on every side: a cell full to its edges with flag reads as a
  // block of colour and not as a flag
  if (flagged) value = <FlagIcon className="w-[0.8em] h-[0.8em]" />
  if (openMine) value = <Bomb className="w-[1em] h-[1em]" />
  if (hideValue) value = ""

  const look = flagged || openMine ? `${theme.cellFlagged} ${theme.cellHoverBgFlagged}`
    : isUncovered(cell) ? `${theme.cellVisible} ${theme.cellHoverBgVisible}`
    : `${theme.cellHidden} ${theme.cellHoverBgHidden}`

  return (
    <button
      data-cell={`${row},${col}`}
      style={{ animationDelay }}
      className={`border flex items-center justify-center rounded font-extrabold leading-none
        ${theme.cellBorder} ${theme.cellHoverBorder} ${look}
        ${number ? NUMBER_COLORS[number] : ""}
        ${animationClass ? `animate-${animationClass}` : ""}
        ${chordHintKey !== undefined || blastId !== undefined ? "relative" : ""}
      `}
      onAnimationStart={() => {
        if (animationClass) setHideValue(true)
      }}
    >
      {value}
      {/* keyed so a repeated chord attempt restarts the flash */}
      {chordHintKey !== undefined && (
        <span key={chordHintKey} className="absolute inset-0 rounded-[inherit] animate-chordHint" />
      )}
      {/* Covered back up by a mine going off. The cell still looks uncovered for the moment the blast takes to reach
          it, then flashes, and that look shrinks away to show the covered cell it now is */}
      {blastId !== undefined && (
        <>
          <span
            key={`cover-${blastId}`}
            className={`absolute inset-0 rounded-[inherit] pointer-events-none animate-blastCover ${theme.cellVisible}`}
            style={{ animationDelay: `${blastDelayMs}ms` }}
          />
          <span
            key={`flash-${blastId}`}
            className="absolute inset-0 rounded-[inherit] pointer-events-none animate-blastFlash"
            style={{ animationDelay: `${blastDelayMs}ms` }}
          />
        </>
      )}
    </button>
  )
}

export default memo(Cell)

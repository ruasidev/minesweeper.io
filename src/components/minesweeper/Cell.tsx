import { memo, useEffect, useState, type ReactNode } from "react"
import { Bomb, FlagTriangleRight } from "lucide-react"
import type { CellProps } from "../../game/types"
import { useTheme } from "../../context/ThemeContext"

// One cell of a board. It only draws: its size comes from the grid it sits in (BoardViewport), and presses are
// picked up by the grid for all its cells at once (useBoardInput), which finds the cell by the mark it carries here
function Cell({ cell, animationClass, animationDelay, chordHintKey, blastId, blastDelayMs = 0, resetKey }: CellProps) {
  const [hideValue, setHideValue] = useState(false)
  const { theme } = useTheme()
  // An uncovered mine that is simply sitting there. Only multiplayer has these: uncovering a mine doesn't end
  // the game there. In singleplayer an uncovered mine means the game is lost, and the loss animation takes it from here
  const isOpenMine = cell.revealed && cell.hasMine && !animationClass

  useEffect(() => {
    setHideValue(false)
  }, [resetKey])

  let value: ReactNode = ""
  let textColor = ""
  if (cell.revealed && cell.neighborCount > 0) {
    value = cell.neighborCount.toString()
    textColor = getNumberColor(cell.neighborCount)
  }
  // filled in, so it still reads as a flag when the cells are small
  if (cell.flagged) value = <FlagTriangleRight className="w-[1em] h-[1em]" fill="currentColor" />
  if (isOpenMine) value = <Bomb className="w-[1em] h-[1em]" />

  if (hideValue) value = ""

  let themeClasses = `
    ${theme.cellBorder} 
    ${theme.cellHoverBorder}
  `
  if (cell.flagged || isOpenMine) {
    themeClasses += `
      ${theme.cellFlagged} 
      ${theme.cellHoverBgFlagged}
    `
  } else if (!cell.revealed) {
    themeClasses += `
      ${theme.cellHidden} 
      ${theme.cellHoverBgHidden}
    `
  } else {
    themeClasses += `
      ${theme.cellVisible} 
      ${theme.cellHoverBgVisible}
    `
  }

  return (
    <button
      data-cell={`${cell.row},${cell.col}`}
      style={{ animationDelay: animationDelay }}
      className={`border flex items-center justify-center rounded font-extrabold leading-none
        ${themeClasses}
        ${textColor}
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

// A move changes a handful of cells, and the rest have nothing to redraw. A board is rebuilt from scratch whenever
// the server sends one, so a cell is the same if it looks the same, not only if it is the very same object
export default memo(Cell, (before, after) =>
  before.cell.revealed === after.cell.revealed
  && before.cell.flagged === after.cell.flagged
  && before.cell.hasMine === after.cell.hasMine
  && before.cell.neighborCount === after.cell.neighborCount
  && before.cell.row === after.cell.row
  && before.cell.col === after.cell.col
  && before.animationClass === after.animationClass
  && before.animationDelay === after.animationDelay
  && before.chordHintKey === after.chordHintKey
  && before.blastId === after.blastId
  && before.blastDelayMs === after.blastDelayMs
  && before.resetKey === after.resetKey)

function getNumberColor(count: number): string {
  switch (count) {
    case 1: return "text-blue-600"
    case 2: return "text-green-600"
    case 3: return "text-red-600"
    case 4: return "text-purple-700"
    case 5: return "text-orange-700"
    case 6: return "text-cyan-700"
    case 7: return "text-black"
    case 8: return "text-gray-600"
    default: return ""
  }
}

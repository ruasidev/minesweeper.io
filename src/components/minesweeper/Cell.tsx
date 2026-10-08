import { useEffect, useState, type ReactNode } from "react"
import { Bomb, FlagTriangleRight } from "lucide-react"
import type { CellProps } from "../../game/types"
import { useTheme } from "../../context/ThemeContext"
import { useSettings } from "../../context/SettingsContext"

export default function Cell({ cell, animationClass, animationDelay, chordHintKey, resetKey, onClick, onRightClick }: CellProps) {
  const [hideValue, setHideValue] = useState(false)
  const { theme } = useTheme()
  const { settings } = useSettings()
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
      onClick={() => onClick(cell.row, cell.col)}
      onContextMenu={() => onRightClick(cell.row, cell.col)}
      style={{
        animationDelay: animationDelay,
        width: settings.cellSize,
        height: settings.cellSize,
        fontSize: settings.cellSize * settings.cellFontScale / 100,
      }}
      className={`border flex items-center justify-center rounded font-extrabold leading-none
        ${themeClasses}
        ${textColor}
        ${animationClass ? `animate-${animationClass}` : ""}
        ${chordHintKey !== undefined ? "relative" : ""}
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
    </button>
  )
}

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

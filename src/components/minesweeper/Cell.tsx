import { useEffect, useState } from "react"
import type { CellProps } from "../../game/types"
import { useTheme } from "../../context/ThemeContext"
import { useMinesweeperGameContext } from "../../context/MinesweeperGameContext"
import { useSettings } from "../../context/SettingsContext"

export default function Cell({ cell, animationClass, animationDelay, chordHintKey }: CellProps) {
  const [hideValue, setHideValue] = useState(false)
  const { theme } = useTheme()
  const { settings } = useSettings()
  const { resetKey, handleClickCell, handleRightClickCell } = useMinesweeperGameContext()

  useEffect(() => {
    setHideValue(false)
  }, [resetKey])

  let value = ""
  let textColor = ""
  if (cell.revealed && cell.neighborCount > 0) {
    value = cell.neighborCount.toString()
    textColor = getNumberColor(cell.neighborCount)
  }
  if (cell.flagged) value = "F"

  if (hideValue) value = ""

  let themeClasses = `
    ${theme.cellBorder} 
    ${theme.cellHoverBorder}
  `
  if (cell.flagged) {
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
      onClick={() => handleClickCell(cell.row, cell.col)}
      onContextMenu={() => handleRightClickCell(cell.row, cell.col)}
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

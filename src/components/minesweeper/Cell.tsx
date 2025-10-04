import { useEffect, useState } from "react"
import type { CellProps } from "../../game/types"

export default function Cell({ cell, resetKey, animationClass, animationDelay, theme, onClick, onRightClick }: CellProps) {
  const [hideValue, setHideValue] = useState(false)

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
      onClick={onClick}
      onContextMenu={() => onRightClick?.()}
      style={{ animationDelay: animationDelay }}
      className={`w-10 h-10 border flex items-center justify-center rounded font-extrabold text-3xl
        ${themeClasses}
        ${textColor}
        ${animationClass ? `animate-${animationClass}` : ""}
      `}
      onAnimationStart={() => {
        if (animationClass) setHideValue(true)
      }}
    >
      {value}
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

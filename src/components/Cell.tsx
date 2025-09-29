import { boardAnimClass, type LossAnimationChoices } from "../game/animations"
import type { CellProps } from "../game/types"

export default function Cell({ cell, animationClass, animationDelay, theme, onClick, onRightClick, onMiddleClick }: CellProps) {
  let value = ""
  let textColor = ""
  if (cell.revealed) {
    if (cell.hasMine) {
      textColor = "text-black"
    } else if (cell.neighborCount > 0) {
      value = cell.neighborCount.toString()
      textColor = getNumberColor(cell.neighborCount)
    }
  } else if (cell.flagged) {
    value = "F"
  }

  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onRightClick?.()
      }}
      style={{ 
        animationDelay: animationDelay
      }}
      className={`w-10 h-10 border flex items-center justify-center rounded font-extrabold
        ${theme.cellBorder}
        ${theme.cellHoverBg}
        ${theme.cellHoverBorder}
        ${boardAnimClass[animationClass as LossAnimationChoices]}
        ${textColor}
        ${cell.revealed ? theme.cellVisible : theme.cellHidden}
        ${cell.flagged ? theme.cellFlagged : ""}
        `}
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

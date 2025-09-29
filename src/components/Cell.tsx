import type { CellProps } from "../game/types"

export default function Cell({ cell, animationClass, animationDelay, theme, onClick, onRightClick, onMiddleClick }: CellProps) {
  let value = ""
  let textColor = ""
  if(cell.revealed && cell.neighborCount > 0) {
    value = cell.neighborCount.toString()
    textColor = getNumberColor(cell.neighborCount)
  }
  if(cell.flagged) value = 'F'

    // Cell styling based on theme
    let themeClasses = (`
      ${theme.cellBorder} 
      ${theme.cellHoverBorder}
    `)
    if(cell.flagged) {              // Cell is hidden and flagged
      themeClasses += (`
        ${theme.cellFlagged} 
        ${theme.cellHoverBgFlagged}
      `)
    } else if(!cell.revealed) {     // Cell is hidden and not flagged
      themeClasses += (`
        ${theme.cellHidden} 
        ${theme.cellHoverBgHidden}
      `)
    } else {                        // Cell is visible 
      themeClasses += (`
        ${theme.cellVisible} 
        ${theme.cellHoverBgVisible}
      `)
    }

  return (
    <button
      onClick={onClick}   // Reveal
      onContextMenu={() => {
        onRightClick?.()  // Flag (if hidden)
      }}
      style={{ animationDelay: animationDelay }}
      className={`w-10 h-10 border flex items-center justify-center rounded font-extrabold text-3xl
        ${themeClasses}
        ${textColor}
        animate-${animationClass}
      `}
    >
      {value}
    </button>
  )
}

// Return the color of the cell text value based on the number of neighboring mines
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

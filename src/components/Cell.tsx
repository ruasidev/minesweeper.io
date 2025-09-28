import type { CellProps } from "../game/types"

export default function Cell({ cell, onClick, onRightClick }: CellProps) {
  let value = ""
  let textColor = ""
  if (cell.revealed) {
    if (cell.hasMine) {
      value = "B"
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
      className={`w-10 h-10 border border-black flex items-center justify-center rounded hover:border-red-700 font-extrabold
        ${textColor}
        ${cell.revealed ? "bg-gray-600" : "bg-gray-500 hover:bg-gray-600"}
        ${cell.flagged ? "bg-red-500" : ""}`}
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

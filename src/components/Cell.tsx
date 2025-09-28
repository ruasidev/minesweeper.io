import type { CellProps, LossAnimation } from "../game/types"

export default function Cell({ cell, gameLost, lossAnimation, lossOrigin, onClick, onRightClick }: CellProps) {
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

  const isOrigin = lossOrigin && cell.row === lossOrigin.row && cell.col === lossOrigin.col

  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onRightClick?.()
      }}
      style={{
        animationDelay: gameLost && cell.hasMine && lossOrigin && !isOrigin
            ? `${(Math.abs(cell.row - lossOrigin.row) + Math.abs(cell.col - lossOrigin.col)) * 30}ms`
            : "0ms"
      }}
      className={`w-10 h-10 border border-black flex items-center justify-center rounded hover:border-red-700 font-extrabold 
        ${gameLost && cell.hasMine 
            ? isOrigin
                ? "explode"
                : lossAnimationClass(lossAnimation)
            : ""}
        ${textColor}
        ${cell.revealed ? "bg-gray-600" : "bg-gray-500 hover:bg-gray-600"}
        ${cell.flagged ? "bg-red-500" : ""}`}
    >
      {value}
    </button>
  )
}

function lossAnimationClass(type: LossAnimation): string {
  switch (type) {
    case "explode": return "explode"
    case "shake": return "animate-shake"
    case "fade": return "animate-fade"
    case "pulse": return "animate-pulseOut"
    case "spin": return "animate-spinOut"
    case "drop": return "animate-dropDown"
    case "flash": return "animate-flash"
    default: return ""
  }
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

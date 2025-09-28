import type { Cell as CellType } from "../game/types"

type CellProps = {
  cell: CellType
  onClick?: () => void
  onRightClick?: () => void
}

export default function Cell({ cell, onClick, onRightClick }: CellProps) {
  let value = ""
  if (cell.revealed) {
    value = cell.hasMine ? "B" : cell.neighborCount ? cell.neighborCount.toString() : ""
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
      className={`w-8 h-8 border border-gray-400 flex items-center justify-center rounded-sm
        ${cell.revealed ? "bg-gray-200" : "bg-gray-500 hover:bg-gray-600"}
        ${cell.flagged ? "bg-red-500" : ""}`}
    >
      {value}
    </button>
  )
}

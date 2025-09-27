import { useState } from "react"
import { createBoard } from "../game/board"
import type { Cell as CellType } from "../game/types"

export default function Board() {
  const [board, setBoard] = useState(() => createBoard(10, 10, 15))

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${board[0].length}, 2rem)` }}>
      {board.flatMap((row, r) =>
        row.map((cell, c) => (
          <button key={`${r}-${c}`}>
            {cell.revealed ? (cell.hasMine ? "💣" : cell.neighborCount) : ""}
          </button>
        ))
      )}
    </div>
  )
}

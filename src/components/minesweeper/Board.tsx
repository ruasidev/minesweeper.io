import { useMinesweeperGameContext } from "../../context/MinesweeperGameContext"
import BoardGrid from "./BoardGrid"

// The singleplayer board
export default function Board() {
  const { board, lastClicked, chordHint, resetKey, handleClickCell, handleRightClickCell } = useMinesweeperGameContext()
  return (
    <BoardGrid
      board={board}
      lastClicked={lastClicked}
      chordHint={chordHint}
      resetKey={resetKey}
      onCellClick={handleClickCell}
      onCellRightClick={handleRightClickCell}
    />
  )
}

import { memo, useCallback, useMemo } from "react"
import { useBoardSounds } from "../../hooks/useBoardSounds"
import { viewOfBoard, type BoardView } from "../../lib/boardView"
import type { Mark } from "../../lib/training"
import type { Board } from "../../../shared/engine/board"
import BoardGrid from "../minesweeper/BoardGrid"
import BoardViewport from "../minesweeper/BoardViewport"
import PatternMarks from "./PatternMarks"

// the board is only redrawn when the board itself changes, not for what is drawn over it
const Grid = memo(BoardGrid)

const nothing = () => {}

type TrialBoardProps = {
  // the board of a round, as it now stands
  board: Board
  // what is pointed out on it
  marks?: Mark[]
  why?: { cell: number, onAsk: () => void } | null
  // What a click and a flag do, each given the cell. Left out, the board is only to look at
  onOpen?: (at: number) => void
  onFlag?: (at: number) => void
}

// The board of a round of training. It is a board like any other, drawn by what draws every board and pressed the
// way every board is pressed; what a press means is up to the round. It is never drawn as won or lost: a round is
// over in a second or two and another follows, which is no place for a board's ending to play out. A mine that was
// uncovered just lies there
export default function TrialBoard({ board, marks = [], why, onOpen, onFlag }: TrialBoardProps) {
  const { rows, cols } = board.field
  const view = useMemo((): BoardView => ({ ...viewOfBoard(board), status: "playing", layout: null }), [board])
  useBoardSounds(view)
  const click = useCallback((row: number, col: number) => onOpen?.(row * cols + col), [onOpen, cols])
  const rightClick = useCallback((row: number, col: number) => onFlag?.(row * cols + col), [onFlag, cols])

  return (
    <BoardViewport rows={rows} cols={cols} centered readOnly={!onOpen && !onFlag} className="px-2 py-5">
      <Grid view={view} origin={null} chordHint={null} resetKey={0} onCellClick={onOpen ? click : nothing} onCellRightClick={onFlag ? rightClick : nothing} />
      <PatternMarks cols={cols} marks={marks} why={why} />
    </BoardViewport>
  )
}

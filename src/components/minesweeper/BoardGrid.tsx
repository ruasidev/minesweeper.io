import Cell from "./Cell"
import { useGameAnimations } from "../../context/GameAnimationContext"
import { useBoardInput } from "../../hooks/useBoardInput"
import type { ChordHint } from "../../hooks/useChordHint"
import type { Blast } from "../../lib/blast"
import { isKnownMine, type BoardView } from "../../lib/boardView"
import { CELL_HIDDEN, isUncovered } from "../../../shared/engine/view"
import type { CellPosition } from "../../../shared/protocol"

// how much later the blast of a mine reaches a cell for every cell it is away
const BLAST_MS_PER_CELL = 45

export type BoardGridProps = {
  view: BoardView
  // where the win and loss animations spread out from
  origin: CellPosition | null
  chordHint: ChordHint | null
  blast?: Blast | null
  // changes when a new game starts
  resetKey: number
  onCellClick: (row: number, col: number) => void
  onCellRightClick: (row: number, col: number) => void
}

// Draws a board and reports what is done to its cells. Whose board it is, and what uncovering or flagging a cell
// does, is up to whoever uses it. How big the cells are is up to what it is drawn in: the --cell-size, --cell-gap
// and --cell-font of a BoardViewport
export default function BoardGrid({ view, origin, chordHint, blast, resetKey, onCellClick, onCellRightClick }: BoardGridProps) {
  const { lossAnimation, winAnimation } = useGameAnimations()
  const input = useBoardInput(view, onCellClick, onCellRightClick)
  const { cols, status } = view
  // What plays out over a board that has just ended: a loss over its mines, a win over everything uncovered.
  // Either spreads out from where the last move was made, reaching a cell later the further away it is
  const ending = status === "lost" ? lossAnimation : status === "won" ? winAnimation : null

  return (
    <div
      className="grid game-motion board-grid"
      {...input}
      style={{
        gridTemplateColumns: `repeat(${cols}, var(--cell-size, 40px))`,
        gridAutoRows: "var(--cell-size, 40px)",
        gap: "var(--cell-gap, 2px)",
        fontSize: "var(--cell-font, 30px)",
      }}
    >
      {Array.from(view.cells, (cell, at) => {
        const row = Math.floor(at / cols)
        const col = at % cols
        const isOrigin = origin !== null && row === origin.row && col === origin.col
        const mine = isKnownMine(view, at)
        const animated = ending !== null && (status === "lost" ? mine : isUncovered(cell) && !mine)
        const distance = origin ? Math.abs(row - origin.row) + Math.abs(col - origin.col) : 0

        // a chord that isn't ready flashes the covered, unflagged cells around the number it was tried on
        const hinted = chordHint !== null && cell === CELL_HIDDEN && Math.abs(row - chordHint.row) <= 1 && Math.abs(col - chordHint.col) <= 1
        const blastHere = blast?.covered.has(`${row},${col}`) ? blast : null

        return (
          <Cell
            key={at}
            row={row}
            col={col}
            cell={cell}
            animationClass={animated ? (isOrigin && ending.originAnim) || ending.id : undefined}
            animationDelay={animated ? `${distance * ending.animDuration}ms` : "0ms"}
            chordHintKey={hinted ? chordHint.id : undefined}
            blastId={blastHere?.id}
            blastDelayMs={blastHere ? Math.round(Math.hypot(row - blastHere.row, col - blastHere.col) * BLAST_MS_PER_CELL) : undefined}
            resetKey={resetKey}
          />
        )
      })}
    </div>
  )
}

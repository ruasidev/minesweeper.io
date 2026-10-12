import { cellBox } from "../../lib/boardMetrics"
import type { Mark } from "../../lib/training"
import FlagIcon from "../minesweeper/FlagIcon"

// Colours that mean the same on every theme: amber for what is being looked at, red for a mine, green for safe.
// Each is a tint over the cell with a line round it inside the cell's own edge, so two marked cells side by side
// stay two cells
const LOOKS: Record<Mark["as"], string> = {
  group: "bg-amber-400/35 ring-2 ring-inset ring-amber-400",
  mine: "bg-red-500/25 ring-[3px] ring-inset ring-red-500 text-red-500",
  safe: "bg-green-500/25 ring-[3px] ring-inset ring-green-500",
  number: "ring-[3px] ring-amber-400 shadow-[0_0_0_2px_rgb(0_0_0/0.35)]",
  wrong: "ring-[3px] ring-inset ring-red-500",
}

type PatternMarksProps = {
  cols: number
  marks: Mark[]
  // the cell a round was missed on, and what asking about it does: it gets a small tag to press
  why?: { cell: number, onAsk: () => void } | null
}

// What is drawn over a board in training: the answer to a round that was missed, or one step of a pattern's
// explanation. It goes inside a BoardViewport beside the grid, and is placed in the board's own units (see
// boardMetrics.ts), so it sits on its cells whatever size they are drawn at. None of it can be pressed but the tag
export default function PatternMarks({ cols, marks, why }: PatternMarksProps) {
  const place = (cell: number) => cellBox(Math.floor(cell / cols), cell % cols)
  return (
    <>
      {marks.map(mark => (
        <span
          key={`${mark.cell}-${mark.as}`}
          className={`absolute z-10 flex items-center justify-center rounded pointer-events-none animate-popIn ${LOOKS[mark.as]}`}
          style={place(mark.cell)}
        >
          {/* a mine that was there to be found is shown as it would have been marked */}
          {mark.as === "mine" && <FlagIcon className="w-1/2 h-1/2 opacity-90" />}
        </span>
      ))}
      {why && (
        <span className="absolute z-20 pointer-events-none" style={place(why.cell)}>
          <button
            className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[70%] px-2 py-0.5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-4 whitespace-nowrap shadow-md shadow-black/40 cursor-pointer pointer-events-auto pressable"
            onClick={why.onAsk}
          >
            Why?
          </button>
        </span>
      )}
    </>
  )
}

import { useState } from "react"
import { blastBetween, type Blast } from "../lib/blast"

// What a mine going off has just done to a board, worked out from how the board now differs from how it was last
// drawn. Null when the latest change wasn't a mine going off
export function useBlast(cells: string, cols: number): Blast | null {
  const [seen, setSeen] = useState<{ cells: string, blast: Blast | null }>({ cells, blast: null })
  // worked out while drawing, not after, so the blast is on screen in the same frame as the board it happened to
  if (cells !== seen.cells) setSeen({ cells, blast: blastBetween(seen.cells, cells, cols) })
  return cells === seen.cells ? seen.blast : null
}

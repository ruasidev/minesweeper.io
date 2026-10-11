import { useEffect, useRef } from "react"
import type { BoardView } from "../lib/boardView"
import { playSound } from "../lib/sounds"

type Heard = Pick<BoardView, "status" | "uncovered" | "flagged" | "openMines">

// Plays the sounds of a board being played, by watching what changes on it from one moment to the next.
// It works the same for any board, whoever is running the game
export function useBoardSounds(view: BoardView | null) {
  const previous = useRef<Heard | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = view
    // the first board seen, or none at all: nothing has happened on it yet
    if (!view || !before) return

    if (view.status === "lost" && before.status !== "lost") {
      playSound("mineClick")
      playSound("boardExplodes")
    } else if (view.status === "won" && before.status !== "won") {
      playSound("win")
    } else if (view.openMines > before.openMines) {
      playSound("mineHit")
    } else if (view.uncovered > before.uncovered) {
      playSound("reveal")
    } else if (view.status === before.status && Math.abs(view.flagged - before.flagged) === 1) {
      // exactly one flag more or fewer; a new game wiping the flags is not a flag being placed
      playSound("flag")
    }
  }, [view])
}

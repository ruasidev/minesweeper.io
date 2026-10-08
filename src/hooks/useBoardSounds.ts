import { useEffect, useRef } from "react"
import type { Board } from "../../shared/board"
import { playSound } from "../lib/sounds"

// Plays the sounds of a board being played, by watching what changes on it from one moment to the next.
// It works the same for a singleplayer board and for a player's own board in multiplayer
export function useBoardSounds(board: Board | null) {
  const previous = useRef<{ status: Board["status"], revealed: number, flagged: number, openMines: number } | null>(null)

  useEffect(() => {
    if (!board) {
      previous.current = null
      return
    }
    const now = {
      status: board.status,
      revealed: board.revealedCount,
      flagged: board.flaggedCount,
      // mines lying uncovered: one in a lost singleplayer game, any number in multiplayer
      openMines: board.grid.flat().filter(cell => cell.revealed && cell.hasMine).length,
    }
    const before = previous.current
    previous.current = now
    // the first board seen: nothing has happened on it yet
    if (!before) return

    if (now.status === "lost" && before.status !== "lost") {
      playSound("mineClick")
      playSound("boardExplodes")
    } else if (now.status === "won" && before.status !== "won") {
      playSound("win")
    } else if (now.openMines > before.openMines) {
      playSound("mineHit")
    } else if (now.revealed > before.revealed) {
      playSound("reveal")
    } else if (now.status === before.status && Math.abs(now.flagged - before.flagged) === 1) {
      // exactly one flag more or fewer; a new game wiping the flags is not a flag being placed
      playSound("flag")
    }
  }, [board])
}

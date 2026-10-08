import { useEffect, useRef } from "react"
import { useMinesweeperGameContext } from "../context/MinesweeperGameContext"
import { useAccount } from "../context/AccountContext"
import { recordGame } from "../lib/api"

// Saves each finished game to the signed-in player's stats. Games finished while signed out are not saved
export function useReportGameResult() {
  const { session } = useAccount()
  const { board, rows, cols, mines, time, resetKey } = useMinesweeperGameContext()
  // resetKey of the last game that was dealt with, so a game is only ever sent once
  const handledGame = useRef<number | null>(null)

  useEffect(() => {
    const finished = board.status === "won" || board.status === "lost"
    if (!finished || handledGame.current === resetKey) return
    handledGame.current = resetKey
    if (!session) return

    recordGame({ rows, cols, mines, won: board.status === "won", durationSeconds: time })
      .catch(error => console.warn("Could not save the game result:", error))
  }, [board.status, resetKey, session, rows, cols, mines, time])
}

import { useEffect, useRef } from "react"
import { useAccount } from "../context/AccountContext"
import { useMinesweeperGameContext } from "../context/MinesweeperGameContext"
import { recordGame } from "../lib/api"

// Tells the server about each singleplayer game the signed-in player started, once it is over: won, lost,
// or abandoned (reset part-way through). That is what their stats, time played and experience come from.
// Games played while signed out are not saved
export function useReportGameResult() {
  const { session, refreshProfile } = useAccount()
  const { board, rows, cols, mines, time, resetKey } = useMinesweeperGameContext()
  const signedIn = Boolean(session)

  // the game last seen, to notice it ending or being thrown away
  const last = useRef({ resetKey, status: board.status, rows, cols, mines, time })
  // resetKey of the last game that was reported, so a game is only ever sent once
  const reported = useRef<number | null>(null)

  useEffect(() => {
    const before = last.current
    last.current = { resetKey, status: board.status, rows, cols, mines, time }

    const send = (game: typeof before, outcome: "won" | "lost" | "abandoned") => {
      if (reported.current === game.resetKey) return
      reported.current = game.resetKey
      if (!signedIn) return
      recordGame({ rows: game.rows, cols: game.cols, mines: game.mines, outcome, durationSeconds: game.time })
        // their level and stats may just have changed
        .then(refreshProfile)
        .catch(error => console.warn("Could not save the game:", error))
    }

    // a game in progress was replaced by a new one
    if (resetKey !== before.resetKey && before.status === "playing") send(before, "abandoned")
    if (board.status === "won" || board.status === "lost") send(last.current, board.status)
  }, [board.status, resetKey, signedIn, rows, cols, mines, time, refreshProfile])
}

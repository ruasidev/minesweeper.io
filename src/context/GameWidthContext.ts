import { createContext, useContext, useEffect } from "react"

// Lets whichever game is being played tell the app how wide its board is,
// so the app can move the left pane out of the way when the window is too narrow for both
export const GameWidthContext = createContext<(width: number | null) => void>(() => {})

// `width` is the room the game needs in px while it is being played, and null when there's no game on
export function useReportGameWidth(width: number | null) {
  const report = useContext(GameWidthContext)
  useEffect(() => {
    report(width)
    return () => report(null)
  }, [report, width])
}

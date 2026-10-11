import { createContext, useContext, type ReactNode } from "react"
import { useSoloGame, type SoloGame } from "../hooks/useSoloGame"

const SoloGameContext = createContext<SoloGame | undefined>(undefined)

// The singleplayer game lives above the pages, so one in progress is still there after a look at another page
export function SoloGameProvider({ children }: { children: ReactNode }) {
  return <SoloGameContext.Provider value={useSoloGame()}>{children}</SoloGameContext.Provider>
}

export function useSoloGameContext(): SoloGame {
  const game = useContext(SoloGameContext)
  if (!game) throw new Error("useSoloGameContext must be used within SoloGameProvider")
  return game
}

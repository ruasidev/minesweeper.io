import { createContext, useContext } from "react"

type InputMode = {
  // On a touch screen there is one way to press a cell and two things a press could mean. With this on, a tap
  // flags a covered cell instead of uncovering it, and holding a finger down does the other
  flagMode: boolean
  setFlagMode: (on: boolean) => void
}

// What a tap on a board does, shared by every board in the app so the switch for it means the same everywhere.
// The app keeps it (App.tsx)
export const InputModeContext = createContext<InputMode>({ flagMode: false, setFlagMode: () => {} })

export function useInputMode() {
  return useContext(InputModeContext)
}

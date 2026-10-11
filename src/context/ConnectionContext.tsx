import { createContext, useContext, type ReactNode } from "react"
import { useServerConnection, type ServerConnection } from "../hooks/useServerConnection"
import { useAccount } from "./AccountContext"

const ConnectionContext = createContext<ServerConnection | undefined>(undefined)

// One connection to the game server for the whole app, open whenever someone is signed in. Every game the server
// runs and both chats talk over it, wherever in the app the player happens to be
export function ConnectionProvider({ children }: { children: ReactNode }) {
  const { session } = useAccount()
  const connection = useServerConnection(session?.user.id ?? null)
  return <ConnectionContext.Provider value={connection}>{children}</ConnectionContext.Provider>
}

// While nobody is signed in there is no connection behind this: nothing arrives and nothing sent goes anywhere
export function useConnection() {
  const connection = useContext(ConnectionContext)
  if (!connection) throw new Error("useConnection must be used within ConnectionProvider")
  return connection
}

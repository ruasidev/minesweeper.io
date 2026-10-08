import { createContext, useContext, type ReactNode } from "react";
import { useMultiplayer, type Multiplayer } from "../hooks/useMultiplayer";
import { useAccount } from "./AccountContext";

const ConnectionContext = createContext<Multiplayer | undefined>(undefined);

// One connection to the game server for the whole app, open whenever someone is signed in. Multiplayer, the daily
// challenge and the global chat all talk over it, wherever in the app the player happens to be
export function ConnectionProvider({ children }: { children: ReactNode }) {
  const { session } = useAccount();
  const connection = useMultiplayer(session?.user.id ?? null);

  return (
    <ConnectionContext.Provider value={connection}>
      {children}
    </ConnectionContext.Provider>
  );
}

// While nobody is signed in there is no connection behind this: nothing arrives and nothing sent goes anywhere
export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used within ConnectionProvider");
  return ctx;
}

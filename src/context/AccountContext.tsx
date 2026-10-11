import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { getProfile, type Profile } from "../lib/api"
import { authClient } from "../lib/authClient"
import { isAdminRole } from "../lib/roles"

interface AccountContextType {
  // null when signed out
  session: ReturnType<typeof authClient.useSession>["data"]
  // true until the first check of whether someone is signed in has finished
  isPending: boolean
  isAdmin: boolean
  // the signed-in player's profile; null when signed out or while it loads
  profile: Profile | null
  setProfile: (profile: Profile) => void
  refreshProfile: () => Promise<void>
  // re-reads who is signed in, after their name or photo changes
  refreshSession: () => Promise<void>
}

const AccountContext = createContext<AccountContextType | undefined>(undefined)

export function AccountProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending, refetch } = authClient.useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const userId = session?.user.id

  const refreshProfile = useCallback(async () => setProfile(await getProfile()), [])
  const refreshSession = useCallback(() => refetch(), [refetch])

  // Load the profile on sign-in, drop it on sign-out
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    let cancelled = false
    getProfile()
      .then(loaded => { if (!cancelled) setProfile(loaded) })
      .catch(error => console.warn("Could not load the profile:", error))
    return () => { cancelled = true }
  }, [userId])

  return (
    <AccountContext.Provider value={{ session, isPending, isAdmin: isAdminRole(session?.user.role), profile, setProfile, refreshProfile, refreshSession }}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error("useAccount must be used within AccountProvider")
  return ctx
}

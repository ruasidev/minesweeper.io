import type { AuthMode } from "../../game/types"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import AdminBadge from "../admin/AdminBadge"
import FloatingWindow from "../app/FloatingWindow"
import ProfileView from "./ProfileView"
import SignInForm from "./SignInForm"

type AccountModalProps = {
  isOpen: boolean
  onClose: () => void
  // which form a signed-out player sees
  authMode: AuthMode
  onAuthModeChange: (mode: AuthMode) => void
}

// Log in / sign up, or the signed-in player's own profile, in a window covering most of the screen
export default function AccountModal({ isOpen, onClose, authMode, onAuthModeChange }: AccountModalProps) {
  const { theme } = useTheme()
  const { session, isPending, isAdmin } = useAccount()

  if (!isOpen) return null

  return (
    <FloatingWindow
      title={session ? "Profile" : "Account"}
      badge={isAdmin && <AdminBadge />}
      onClose={onClose}
      className="w-[75vw] h-[78vh]"
    >
      {isPending ? (
        <span className={`text-sm opacity-70 cursor-default ${theme.textBody}`}>Loading…</span>
      ) : session ? (
        // keyed by account so nothing from a previous player's profile is left on screen
        <ProfileView key={session.user.id} onSignedOut={onClose} />
      ) : (
        <div className="w-full max-w-sm">
          <SignInForm mode={authMode} onModeChange={onAuthModeChange} onSignedIn={onClose} autoFocus />
        </div>
      )}
    </FloatingWindow>
  )
}

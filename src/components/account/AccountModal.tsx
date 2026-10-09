import type { AuthMode } from "../../game/types"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import AdminBadge from "../admin/AdminBadge"
import FloatingWindow from "../app/FloatingWindow"
import AuthShowcase from "./AuthShowcase"
import ProfileView from "./ProfileView"
import SignInForm from "./SignInForm"

type AccountModalProps = {
  isOpen: boolean
  onClose: () => void
  // which form a signed-out player sees
  authMode: AuthMode
  onAuthModeChange: (mode: AuthMode) => void
}

// Log in / sign up in a window of its own shape, or the signed-in player's own profile in one covering most of the screen
export default function AccountModal({ isOpen, onClose, authMode, onAuthModeChange }: AccountModalProps) {
  const { theme } = useTheme()
  const { session, isPending, isAdmin } = useAccount()

  if (!isOpen) return null

  if (!session && !isPending) {
    return (
      // Just wide enough for the form, or for the form and what an account is for beside it when there is room.
      // It is as tall as signing up needs either way, so switching to logging in doesn't make the window jump
      <FloatingWindow onClose={onClose} className="w-[min(27rem,94vw)] md:w-[min(54rem,94vw)] max-h-[94vh]">
        <div className="flex min-h-[40rem]">
          <AuthShowcase />
          <div className="flex-1 min-w-0 flex flex-col justify-center px-7 py-10 sm:px-10">
            <SignInForm mode={authMode} onModeChange={onAuthModeChange} onSignedIn={onClose} autoFocus />
          </div>
        </div>
      </FloatingWindow>
    )
  }

  return (
    <FloatingWindow
      title={session ? "Profile" : "Account"}
      badge={isAdmin && <AdminBadge />}
      onClose={onClose}
      className="w-[75vw] h-[78vh]"
    >
      {session ? (
        // keyed by account so nothing from a previous player's profile is left on screen
        <ProfileView key={session.user.id} onSignedOut={onClose} />
      ) : (
        <span className={`text-sm opacity-70 cursor-default ${theme.textBody}`}>Loading…</span>
      )}
    </FloatingWindow>
  )
}

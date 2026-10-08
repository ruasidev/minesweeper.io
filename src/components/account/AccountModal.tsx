import { useEffect, useState } from "react"
import { X } from "lucide-react"
import type { AuthMode } from "../../game/types"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import ScreenDim from "../minesweeper/infoDisplay/ScreenDim"
import AdminBadge from "../admin/AdminBadge"
import ProfileView from "./ProfileView"
import SignInForm from "./SignInForm"

type AccountModalProps = {
  isOpen: boolean
  onClose: () => void
  // which form a signed-out player sees
  authMode: AuthMode
  onAuthModeChange: (mode: AuthMode) => void
}

// Log in / sign up, or the signed-in player's profile, floating over the dimmed screen
export default function AccountModal({ isOpen, onClose, authMode, onAuthModeChange }: AccountModalProps) {
  const { theme } = useTheme()
  const { session, isPending, isAdmin } = useAccount()
  const [visible, setVisible] = useState(false)

  // fade-in
  useEffect(() => {
    if (!isOpen) {
      setVisible(false)
      return
    }
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <ScreenDim visible={visible} onDismiss={onClose} soft>
      {/* Covers most of the screen; what's inside starts at the top left of it */}
      <div
        className={`flex flex-col w-[75vw] h-[78vh] rounded-xl shadow-2xl border-2 overflow-hidden
          transform transition-transform duration-500 ease-out
          ${visible ? "scale-100" : "scale-90"}
          ${theme.menuBg}
          ${theme.menuBorder}
        `}
      >
        <div className="flex justify-between items-center px-8 pt-6">
          <div className="flex items-center gap-3">
            <h2 className={`text-2xl font-semibold cursor-default ${theme.textHead}`}>{session ? "Profile" : "Account"}</h2>
            {isAdmin && <AdminBadge />}
          </div>
          <button
            onClick={onClose}
            className={`
              p-2 rounded transition-colors cursor-pointer
              ${theme.textHead} ${theme.itemHoverBg}
              hover:opacity-80 active:opacity-60
            `}
          >
            <X className="w-5 h-5 pressable" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-8 py-6">
          {isPending ? (
            <span className={`text-sm opacity-70 cursor-default ${theme.textBody}`}>Loading…</span>
          ) : session ? (
            // keyed by account so nothing from a previous player's profile is left on screen
            <ProfileView key={session.user.id} onSignedOut={onClose} />
          ) : (
            <div className="w-full max-w-sm">
              <SignInForm mode={authMode} onModeChange={onAuthModeChange} onSignedIn={onClose} />
            </div>
          )}
        </div>
      </div>
    </ScreenDim>
  )
}

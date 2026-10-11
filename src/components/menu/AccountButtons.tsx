import { useState } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import type { AuthMode } from "../../game/types"
import { useLayout } from "../../hooks/useLayout"
import { avatarSrc } from "../../lib/avatar"
import AccountMenu from "../account/AccountMenu"
import AdminBadge from "../admin/AdminBadge"

type AccountButtonsProps = {
  onOpenAuth: (mode: AuthMode) => void
  onOpenProfile: () => void
  onOpenHistory: () => void
}

// The account corner of the header: "Log in" / "Sign up" when signed out, which open the account window on that
// form; otherwise who is signed in, which opens the menu of what is theirs. On a phone they are cut down to fit
// beside the game's name
export default function AccountButtons({ onOpenAuth, onOpenProfile, onOpenHistory }: AccountButtonsProps) {
  const { theme } = useTheme()
  // the button itself while its menu is open: the menu hangs off it
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const { session, isPending, isAdmin, profile } = useAccount()
  const slim = useLayout().mode === "phone"

  // Not known yet whether someone is signed in; show neither rather than flash the wrong one
  if (isPending) return null

  if (!session) {
    const size = slim ? "h-9 px-2.5 text-sm" : "h-9 px-3.5"
    return (
      <>
                <button
                    onClick={() => onOpenAuth("signIn")}
                    className={`${size} rounded-lg font-semibold whitespace-nowrap transition-colors hover:opacity-80 pressable ${theme.textHead} ${theme.itemHoverBg}`}
                >
                    Log in
                </button>
                {/* the one a new visitor is after: filled in, so it is the thing to press */}
                <button
                    onClick={() => onOpenAuth("signUp")}
                    className={`${size} rounded-lg font-semibold whitespace-nowrap pressable hover:brightness-110 ${theme.itemSelected}`}
                >
                    Sign up
                </button>
      </>
    )
  }

  return (
    <>
        <button
            onClick={(e) => {
                const pressed = e.currentTarget
                setMenuAnchor(open => open ? null : pressed)
            }}
            aria-haspopup="menu"
            aria-expanded={menuAnchor !== null}
            className={`h-10 flex items-center gap-2 rounded-lg transition-colors hover:opacity-80 pressable ${slim ? "px-1" : "pl-3 pr-1.5"} ${theme.textHead} ${theme.itemHoverBg}`}
            title="Account"
        >
            {isAdmin && !slim && <AdminBadge />}
            {!slim && <span className="font-semibold max-w-40 truncate">{profile?.username ?? session.user.name}</span>}
            <img
                src={avatarSrc(session.user.image)}
                alt={slim ? "Your profile" : ""}
                referrerPolicy="no-referrer"
                className={`w-8 h-8 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
            />
        </button>
        {menuAnchor && <AccountMenu anchor={menuAnchor} onClose={() => setMenuAnchor(null)} onOpenProfile={onOpenProfile} onOpenHistory={onOpenHistory} />}
    </>
  )
}

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { History, LogOut, User } from "lucide-react"
import { useAccount } from "../../context/AccountContext"
import { useSettings } from "../../context/SettingsContext"
import { useTheme } from "../../context/ThemeContext"
import { ghostColors } from "../../game/themes"
import { paneLook } from "../../hooks/useFormStyles"
import { authClient } from "../../lib/authClient"
import { avatarSrc } from "../../lib/avatar"
import AdminBadge from "../admin/AdminBadge"
import LevelBar from "./LevelBar"

// keeps the menu this far from what it hangs off and from the edges of the screen
const GAP = 8

type AccountMenuProps = {
  // what was pressed to open the menu: the menu hangs off it
  anchor: HTMLElement
  onClose: () => void
  onOpenProfile: () => void
  onOpenHistory: () => void
}

// What the signed-in player's own corner of the app opens: who they are and how they stand, and the things that
// are theirs (their profile, their games, signing out). It is the one place for all of it, where it used to be
// spread between the header and the navigation. It closes on a press anywhere else, or the Escape key
export default function AccountMenu({ anchor, onClose, onOpenProfile, onOpenHistory }: AccountMenuProps) {
  const { theme } = useTheme()
  const { settings } = useSettings()
  const { session, profile, isAdmin } = useAccount()
  const menuRef = useRef<HTMLDivElement>(null)
  // null until the menu has been measured
  const [position, setPosition] = useState<{ top: number, left: number } | null>(null)

  // Under what was pressed with their right-hand edges in line, or above it where there is no room below (the
  // foot of the rail), and never off the screen. Worked out again once the profile has loaded, which makes it taller
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const pressed = anchor.getBoundingClientRect()
    const fitsBelow = pressed.bottom + GAP + menu.offsetHeight <= window.innerHeight - GAP
    setPosition({
      top: fitsBelow ? pressed.bottom + GAP : Math.max(GAP, pressed.top - GAP - menu.offsetHeight),
      left: Math.max(GAP, Math.min(pressed.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - GAP)),
    })
  }, [anchor, profile])

  useEffect(() => {
    const handlePress = (e: PointerEvent) => {
      const target = e.target as Node
      // a press on the button itself is left to the button, which closes the menu it opened
      if (!menuRef.current?.contains(target) && !anchor.contains(target)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("pointerdown", handlePress)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("pointerdown", handlePress)
      document.removeEventListener("keydown", handleKey)
    }
  }, [anchor, onClose])

  if (!session) return null
  const item = (icon: ReactNode, label: string, onPick: () => void) => (
    <button
      role="menuitem"
      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-md font-semibold text-left pressable-soft ${ghostColors(theme)}`}
      onClick={() => {
        onPick()
        onClose()
      }}
    >
      {icon}
      {label}
    </button>
  )

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={`fixed z-50 flex flex-col gap-3 w-72 max-w-[calc(100vw-1rem)] p-3 cursor-default
        ${position ? (settings.reduceMotion ? "" : "animate-popIn") : "invisible"}
        ${paneLook(theme)} ${theme.textBody}`}
      style={position ?? { top: 0, left: 0 }}
    >
      <div className="flex items-center gap-3 px-1 pt-1">
        <img
          src={avatarSrc(session.user.image)}
          alt=""
          referrerPolicy="no-referrer"
          className={`w-11 h-11 shrink-0 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold truncate ${theme.textHead}`}>@{profile?.username ?? session.user.name}</span>
            {isAdmin && <AdminBadge />}
          </div>
          {profile && <div className="text-xs opacity-70 truncate">Rating {profile.elo} · {profile.stats.wins} {profile.stats.wins === 1 ? "win" : "wins"}</div>}
        </div>
      </div>
      {profile && <div className="px-1"><LevelBar xp={profile.xp} compact /></div>}

      <div className={`flex flex-col gap-0.5 pt-2 border-t ${theme.menuBorder}`}>
        {item(<User className="w-5 h-5 shrink-0" />, "Profile", onOpenProfile)}
        {item(<History className="w-5 h-5 shrink-0" />, "Match history", onOpenHistory)}
        {item(<LogOut className="w-5 h-5 shrink-0" />, "Sign out", () => authClient.signOut())}
      </div>
    </div>,
    document.body,
  )
}

import { useState } from "react"
import { ChevronsUpDown, Settings } from "lucide-react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { ghostColors } from "../../game/themes"
import { avatarSrc } from "../../lib/avatar"
import AdminBadge from "../admin/AdminBadge"
import AccountMenu, { type AccountActions } from "./AccountMenu"

// The player's own corner of the app, at the foot of the navigation: who is signed in, which opens the menu of
// what is theirs (their profile, their games, how the app looks and behaves for them). For someone who isn't
// signed in it is the two ways in, with the way to themes and settings beside them: those are for everybody
export default function AccountBar(actions: AccountActions) {
  const { theme } = useTheme()
  // what was pressed while its menu is open: the menu hangs off it
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const { session, isPending, isAdmin, profile } = useAccount()
  const toggleMenu = (pressed: HTMLElement) => setMenuAnchor(open => (open ? null : pressed))
  const menu = menuAnchor && <AccountMenu anchor={menuAnchor} onClose={() => setMenuAnchor(null)} {...actions} />

  // Not known yet whether someone is signed in: its room is kept, and neither is shown rather than flash the wrong one
  if (isPending) return <div className="h-13" />

  if (!session) {
    const button = "flex-1 min-w-0 h-10 px-2 rounded-lg text-sm font-semibold whitespace-nowrap pressable"
    return (
      <div className="flex items-center gap-1.5">
        <button className={`${button} ${ghostColors(theme)}`} onClick={() => actions.onOpenAuth("signIn")}>Log in</button>
        {/* the one a new visitor is after: filled in, so it is the thing to press */}
        <button className={`${button} hover:brightness-110 ${theme.itemSelected}`} onClick={() => actions.onOpenAuth("signUp")}>Sign up</button>
        <button
          className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-lg pressable ${ghostColors(theme)}`}
          title="Themes and settings"
          aria-label="Themes and settings"
          aria-haspopup="menu"
          aria-expanded={menuAnchor !== null}
          onClick={e => toggleMenu(e.currentTarget)}
        >
          <Settings className="w-5 h-5" />
        </button>
        {menu}
      </div>
    )
  }

  return (
    <>
      <button
        className={`flex items-center gap-2.5 w-full p-2 rounded-lg text-left pressable-soft ${ghostColors(theme)}`}
        title="Account"
        aria-haspopup="menu"
        aria-expanded={menuAnchor !== null}
        onClick={e => toggleMenu(e.currentTarget)}
      >
        <img
          src={avatarSrc(session.user.image)}
          alt=""
          referrerPolicy="no-referrer"
          className={`shrink-0 w-9 h-9 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
        />
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="flex items-center gap-1.5">
            <span className={`font-semibold truncate ${theme.textHead}`}>@{profile?.username ?? session.user.name}</span>
            {isAdmin && <AdminBadge iconOnly />}
          </span>
          {profile && <span className="text-xs opacity-70 truncate">Rating {profile.elo}</span>}
        </span>
        <ChevronsUpDown className="shrink-0 w-4 h-4 opacity-60" />
      </button>
      {menu}
    </>
  )
}

import { useState, type ReactNode } from "react"
import { Menu, UserRound } from "lucide-react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import type { Route } from "../../game/types"
import { useLayout } from "../../hooks/useLayout"
import { APP_NAME } from "../../lib/app"
import { avatarSrc } from "../../lib/avatar"
import AccountMenu, { type AccountActions } from "../account/AccountMenu"
import { MAIN_PAGES } from "./navItems"

type NavTabsProps = {
  route: Route
  onNavigate: (route: Route) => void
  moreOpen: boolean
  onToggleMore: () => void
  // something is waiting behind "More": the player was mentioned in the global chat
  moreBadge: boolean
  // how many multiplayer rooms are open right now
  openRooms: number
}

// the tabs, and whether they are the lower ones (see Tab)
type TabsProps = NavTabsProps & { tight?: boolean }

type TabProps = {
  icon: ReactNode
  label: string
  selected: boolean
  // a dot on it: something new is waiting behind it
  badge?: boolean
  // a figure on it
  count?: number
  // where there is little height to spare (along the bottom of a phone, down the side of one held sideways):
  // the tile behind the icon is a little lower
  tight?: boolean
  onClick: () => void
}

// One tab: its icon on a tile that fills with the theme's highlight when this is where the player is, and its name
// underneath. The tile has the rounded corners everything else that can be chosen in the app has, and is only as
// wide as an icon needs: the names are longer than that, and are given the full width of the tab to themselves
function Tab({ icon, label, selected, badge, count, tight, onClick }: TabProps) {
  const { theme } = useTheme()
  return (
    <button
      aria-current={selected ? "page" : undefined}
      className={`group flex flex-col items-center justify-center min-w-0 cursor-pointer ${tight ? "gap-0.5" : "gap-1"} ${selected ? theme.textHead : `${theme.textBody} opacity-70 hover:opacity-100`}`}
      onClick={onClick}
    >
      <span
        className={`relative flex items-center justify-center w-12 transition-colors duration-200
          ${tight ? "h-7 rounded-lg" : "h-8 rounded-[0.625rem]"}
          ${selected ? theme.itemSelected : "group-hover:bg-current/10"}`}
      >
        {icon}
        {badge && <span className="absolute top-0.5 right-2.5 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-black/30" />}
        {count !== undefined && count > 0 && (
          <span className={`absolute -top-1 right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full border text-[10px] font-bold leading-none ${theme.menuBg} ${theme.menuBorder} ${theme.textHead}`}>{count}</span>
        )}
      </span>
      <span className="max-w-full px-0.5 text-[11px] max-[359px]:text-[10px] font-semibold leading-tight truncate">{label}</span>
    </button>
  )
}

// The tabs themselves, the same on a phone and on a tablet: only where they are put differs.
// First the main pages...
function PageTabs({ route, onNavigate, moreOpen, openRooms, tight }: TabsProps) {
  return MAIN_PAGES.map(({ route: to, short, icon: Icon }) => (
    <Tab
      key={to}
      icon={<Icon className="w-5 h-5" />}
      label={short}
      selected={!moreOpen && route === to}
      count={to === "multiplayer" ? openRooms : undefined}
      tight={tight}
      onClick={() => onNavigate(to)}
    />
  ))
}

// ...then "More", which is lit while it is open, and while the page showing is the one that is reached through it
function MoreTab({ route, moreOpen, onToggleMore, moreBadge, tight }: TabsProps) {
  return <Tab icon={<Menu className="w-5 h-5" />} label="More" selected={moreOpen || route === "admin"} badge={moreBadge && !moreOpen} tight={tight} onClick={onToggleMore} />
}

// The tabs along the bottom of a phone: the four main pages within reach of a thumb, and everything else behind
// "More". A pane like the header, floating clear of the edges with the page passing underneath
export function TabBar(props: NavTabsProps) {
  const styles = useFormStyles()
  return (
    <nav
      aria-label="Main"
      className={`absolute z-40 grid grid-cols-5 h-14 ${styles.pane}`}
      style={{
        left: "calc(var(--gap) + env(safe-area-inset-left))",
        right: "calc(var(--gap) + env(safe-area-inset-right))",
        bottom: "max(var(--gap), env(safe-area-inset-bottom))",
      }}
    >
      <PageTabs {...props} tight />
      <MoreTab {...props} tight />
    </nav>
  )
}

type NavRailProps = NavTabsProps & AccountActions

// The same tabs down the left of a tablet, or of a phone on its side: a pane in the place the left pane has on a
// desktop, cut down to its icons. Like that pane it has the game's logo at its head and the player's own corner at
// its foot: their picture, which opens the menu of what is theirs
export function NavRail({ onOpenAuth, onOpenProfile, onOpenHistory, onOpenPanel, ...tabsProps }: NavRailProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { session, isPending } = useAccount()
  // the picture at the foot of the rail while its menu is open: the menu hangs off it
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  // each tab's height: closer together on a phone held sideways, where there is little height to fit them all in
  const tight = useLayout().short
  const rows = tight ? "auto-rows-[3.25rem]" : "auto-rows-[4rem]"
  return (
    <nav
      aria-label="Main"
      className={`absolute z-40 flex flex-col items-stretch w-(--rail-w) overflow-hidden ${styles.pane}`}
      style={{
        left: "calc(var(--gap) + env(safe-area-inset-left))",
        top: "calc(var(--top-space) + var(--gap))",
        bottom: "max(var(--gap), env(safe-area-inset-bottom))",
      }}
    >
      <button className={`shrink-0 flex justify-center cursor-pointer ${tight ? "pt-2" : "pt-3 pb-1"}`} title={APP_NAME} onClick={() => tabsProps.onNavigate("game")}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt={APP_NAME} className="w-8 h-8" />
      </button>

      {/* The pages at the head of the rail and "More" at its foot, as the left pane of a desktop has its links and
          its tools. Where the screen is too short to keep them apart they close up, and scroll rather than squash */}
      <div className="flex-1 min-h-0 flex flex-col justify-between py-2 overflow-y-auto hide-scrollbar">
        <div className={`shrink-0 grid ${rows}`}><PageTabs {...tabsProps} tight={tight} /></div>
        <div className={`shrink-0 grid ${rows}`}><MoreTab {...tabsProps} tight={tight} /></div>
      </div>

      {!isPending && (
        <button
          className={`shrink-0 flex justify-center cursor-pointer ${tight ? "pb-2" : "pb-3"} ${theme.textBody}`}
          title={session ? "Account" : "Log in, sign up, themes and settings"}
          aria-label={session ? "Account" : "Log in, sign up, themes and settings"}
          aria-haspopup="menu"
          aria-expanded={menuAnchor !== null}
          onClick={(e) => {
            const pressed = e.currentTarget
            setMenuAnchor(open => open ? null : pressed)
          }}
        >
          {session
            ? <img src={avatarSrc(session.user.image)} alt="" referrerPolicy="no-referrer" className={`w-9 h-9 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`} />
            : <span className={`flex items-center justify-center w-9 h-9 rounded-full border ${theme.itemBg} ${theme.itemBorder}`}><UserRound className="w-5 h-5" /></span>}
        </button>
      )}
      {menuAnchor && (
        <AccountMenu anchor={menuAnchor} onClose={() => setMenuAnchor(null)} onOpenAuth={onOpenAuth} onOpenProfile={onOpenProfile} onOpenHistory={onOpenHistory} onOpenPanel={onOpenPanel} />
      )}
    </nav>
  )
}

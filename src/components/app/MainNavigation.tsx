import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { ArrowLeft, CalendarDays, CircleHelp, Lock, MessageCircle, Paintbrush, Settings, ShieldCheck, Swords, Trophy, User } from "lucide-react"
import { useAccount } from "../../context/AccountContext"
import { useConnection } from "../../context/ConnectionContext"
import { useTheme } from "../../context/ThemeContext"
import type { MainNavigationProps, Panel } from "../../game/types"
import { useOpenRooms } from "../../hooks/useOpenRooms"
import { avatarSrc } from "../../lib/avatar"
import LevelBar from "../account/LevelBar"
import GlobalChat from "../menu/GlobalChat"
import HowToPlay from "../menu/HowToPlay"
import SettingsMenu from "../menu/SettingsMenu"
import SidebarMenu from "../menu/SidebarMenu"
import SidebarSectionHeader from "../menu/SidebarSectionHeader"

// How narrow and how wide the pane can be dragged, in px
export const NAV_MIN_WIDTH = 192
export const NAV_MAX_WIDTH = 448
export const NAV_DEFAULT_WIDTH = 256
// Themes and settings need more room than the navigation's links
export const NAV_PANEL_MIN_WIDTH = 320

// The strip on the left taken up by the pane: its width plus the gap on either side of it.
// Whatever is beside the pane starts this far in. When the pane is out of the way (--nav-shown is 0)
// the strip shrinks to just the room for the button that brings the pane back
export const NAV_SPACE = "max(3.25rem, calc(var(--nav-w) * var(--nav-shown) + var(--nav-gap) * 2))"

// What replaces the navigation when one of the entries at its foot is opened.
// `fills` is for a view that takes up the pane's whole height and scrolls inside itself, rather than with the pane
const panels: Record<Panel, { title: string, content: ReactNode, fills?: boolean }> = {
  chat: { title: "Global chat", content: <GlobalChat />, fills: true },
  themes: { title: "Themes", content: <SidebarMenu /> },
  settings: { title: "Settings", content: <SettingsMenu /> },
  help: { title: "How to play", content: <HowToPlay /> },
}

// How many of the open rooms the pane lists
const ROOMS_SHOWN = 3

type NavItemProps = {
  icon: ReactNode
  label: string
  selected?: boolean
  // a small note at the end, like how many unread messages are behind the entry
  tag?: string
  onClick: () => void
}

function NavItem({ icon, label, selected, tag, onClick }: NavItemProps) {
  const { theme } = useTheme()
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-md border font-semibold text-left pressable
        ${theme.itemBg}
        ${theme.itemBorder}
        ${theme.itemHoverBg}
        ${theme.textBody}
        ${selected ? `ring-2 ${theme.itemSelectedBorder}` : ""}
      `}
    >
      {icon}
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {tag && <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-green-500 text-white text-xs leading-none">{tag}</span>}
    </button>
  )
}

// The pane floating on the left, between the board (which slides underneath it) and the account window
// (which opens above everything). It holds the main navigation, and themes or settings in its place while one is open.
// Its width and distance from the edges are the --nav-w and --nav-gap variables set on <main>
export default function MainNavigation({
  route, onNavigate, width, minWidth, onWidthChange, openPanel, onOpenPanel, onClosePanel, offScreen, onOpenAuth, onOpenProfile, onPickRoom,
}: MainNavigationProps) {
  const { theme } = useTheme()
  const { session, isPending, isAdmin, profile } = useAccount()
  const openRooms = useOpenRooms()

  // How many messages have arrived in the global chat since it was last looked at.
  // What was already there on arriving doesn't count, and neither does anything this player said
  const { globalChat } = useConnection()
  const [seenChatId, setSeenChatId] = useState<number | null>(null)
  const latestChatId = globalChat.at(-1)?.id ?? 0
  useEffect(() => {
    if (openPanel === "chat" || (seenChatId === null && latestChatId > 0)) setSeenChatId(latestChatId)
  }, [openPanel, latestChatId, seenChatId])
  const unseenChat = globalChat.filter(message => message.id > (seenChatId ?? latestChatId) && message.playerId !== session?.user.id).length
  const navRef = useRef<HTMLElement>(null)

  // The view stays rendered after it is closed, until it has finished sliding back out
  const [shownPanel, setShownPanel] = useState<Panel | null>(openPanel)
  if (openPanel && openPanel !== shownPanel) setShownPanel(openPanel)
  const panel = shownPanel && panels[shownPanel]
  const isPanelOpen = openPanel !== null

  // Dragging the right edge resizes the pane
  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    const handle = e.currentTarget
    const main = navRef.current?.closest("main")
    const startX = e.clientX
    let newWidth = width
    handle.setPointerCapture(e.pointerId)
    // switches off the width animation (see appAnimations.css) so the pane follows the pointer exactly
    main?.setAttribute("data-resizing", "")

    const move = (moveEvent: PointerEvent) => {
      newWidth = Math.min(NAV_MAX_WIDTH, Math.max(minWidth, width + moveEvent.clientX - startX))
      // Written straight to the CSS variable while dragging: going through React state
      // would re-render the whole board for every pixel of movement
      main?.style.setProperty("--nav-w", `${newWidth}px`)
    }
    const end = () => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", end)
      handle.removeEventListener("pointercancel", end)
      main?.removeAttribute("data-resizing")
      onWidthChange(newWidth)
    }
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", end)
    handle.addEventListener("pointercancel", end)
  }

  return (
    <nav
      ref={navRef}
      // off screen it can't be clicked or tabbed into
      inert={offScreen}
      // slides out past the left edge as --nav-visible goes from 1 to 0 (animated: see appAnimations.css)
      style={{ "--nav-visible": offScreen ? 0 : 1, transform: "translateX(calc((var(--nav-visible) - 1) * (100% + var(--nav-gap) * 2)))" } as CSSProperties}
      className={`
        animate-nav-visible
        absolute z-40 left-(--nav-gap) top-(--nav-gap) bottom-(--nav-gap) w-(--nav-w)
        rounded-xl overflow-hidden
        shadow-2xl shadow-black/70 ring-1 ring-white/20
        ${theme.menuBg}
        ${theme.menuBorder}
      `}
    >
      {/* The navigation and the view opened from it are two layers: one slides out to the left as the other slides in from the right */}
      <div
        inert={isPanelOpen}
        className={`absolute inset-0 overflow-y-auto p-3 hide-scrollbar transition-transform duration-300 ease-out ${isPanelOpen ? "-translate-x-full" : ""}`}
      >
        <div className="flex flex-col gap-3 min-h-full">
          <NavItem icon={<User className="w-5 h-5 shrink-0" />} label="Singleplayer" selected={route === "game"} onClick={() => onNavigate("game")} />
          <NavItem icon={<Swords className="w-5 h-5 shrink-0" />} label="Multiplayer" selected={route === "multiplayer"} onClick={() => onNavigate("multiplayer")} />
          <NavItem icon={<CalendarDays className="w-5 h-5 shrink-0" />} label="Daily challenge" selected={route === "daily"} onClick={() => onNavigate("daily")} />
          <NavItem icon={<Trophy className="w-5 h-5 shrink-0" />} label="Leaderboard" selected={route === "leaderboard"} onClick={() => onNavigate("leaderboard")} />
          {isAdmin && (
            <NavItem icon={<ShieldCheck className="w-5 h-5 shrink-0" />} label="Admin" selected={route === "admin"} onClick={() => onNavigate("admin")} />
          )}

          {/* What's going on in multiplayer right now. A room that can be walked into is a button that does so */}
          {openRooms && (
            <div className="mt-2">
              <SidebarSectionHeader text={`Open rooms (${openRooms.length})`} />
              <div className={`flex flex-col gap-1 text-sm ${theme.textBody}`}>
                {openRooms.length === 0 && <p className="opacity-70 cursor-default">None right now.</p>}
                {openRooms.slice(0, ROOMS_SHOWN).map(room => (
                  <button
                    key={room.id}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-left cursor-pointer ${theme.itemHoverBg}`}
                    title={room.inGame ? "A game is in progress" : room.visibility === "private" ? "Private: needs the passcode" : "Join this room"}
                    onClick={() => onPickRoom(room)}
                  >
                    {room.visibility === "private" && <Lock className="w-3.5 h-3.5 shrink-0" />}
                    <span className="flex-1 min-w-0 truncate font-semibold">{room.name}</span>
                    <span className="shrink-0 text-xs opacity-70">{room.inGame ? "in game" : `${room.playerCount} in`}</span>
                  </button>
                ))}
                {openRooms.length > ROOMS_SHOWN && (
                  <button className="px-2 text-left text-xs opacity-70 cursor-pointer hover:underline" onClick={() => onNavigate("multiplayer")}>
                    and {openRooms.length - ROOMS_SHOWN} more
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Who is playing: their record so far, or the way to start keeping one */}
          {!isPending && (
            <div className="mt-2">
              <SidebarSectionHeader text="You" />
              {session ? (
                <div className="flex flex-col gap-2">
                <button className={`flex items-center gap-3 w-full p-2 rounded text-left cursor-pointer ${theme.itemHoverBg} ${theme.textBody}`} title="Open your profile" onClick={onOpenProfile}>
                  <img
                    src={avatarSrc(session.user.image)}
                    alt=""
                    referrerPolicy="no-referrer"
                    className={`w-9 h-9 shrink-0 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">@{profile?.username ?? session.user.name}</span>
                    {profile && <span className="block truncate text-xs opacity-70">Rating {profile.elo} · {profile.stats.wins} {profile.stats.wins === 1 ? "win" : "wins"}</span>}
                  </span>
                </button>
                {profile && <div className="px-2"><LevelBar xp={profile.xp} compact /></div>}
                </div>
              ) : (
                <div className={`flex flex-col items-start gap-2 text-sm ${theme.textBody}`}>
                  <p className="opacity-70 cursor-default">Make an account to keep your stats, play multiplayer and take the daily challenge.</p>
                  <button className={`px-3 py-1 rounded-md border font-semibold pressable ${theme.itemBg} ${theme.itemBorder} ${theme.itemHoverBg}`} onClick={() => onOpenAuth("signUp")}>
                    Sign up
                  </button>
                </div>
              )}
            </div>
          )}

          {/* pushed to the bottom of the pane */}
          <div className="mt-auto flex flex-col gap-3">
            <NavItem
              icon={<MessageCircle className="w-5 h-5 shrink-0" />}
              label="Global chat"
              tag={unseenChat > 0 ? `${unseenChat} new` : undefined}
              onClick={() => onOpenPanel("chat")}
            />
            <NavItem icon={<CircleHelp className="w-5 h-5 shrink-0" />} label="How to play" onClick={() => onOpenPanel("help")} />
            <NavItem icon={<Paintbrush className="w-5 h-5 shrink-0" />} label="Themes" onClick={() => onOpenPanel("themes")} />
            <NavItem icon={<Settings className="w-5 h-5 shrink-0" />} label="Settings" onClick={() => onOpenPanel("settings")} />
          </div>
        </div>
      </div>

      <div
        inert={!isPanelOpen}
        className={`absolute inset-0 overflow-y-auto p-3 hide-scrollbar transition-transform duration-300 ease-out ${isPanelOpen ? "" : "translate-x-full"}`}
        onTransitionEnd={(e) => {
          // slid all the way out: nothing left to show
          if (e.target === e.currentTarget && !isPanelOpen) setShownPanel(null)
        }}
      >
        {panel && (
          <div className={`flex flex-col gap-6 ${panel.fills ? "h-full" : ""}`}>
            <div className="flex items-center gap-2">
              <button
                onClick={onClosePanel}
                title="Back"
                className={`
                  p-2 rounded transition-colors cursor-pointer
                  ${theme.textHead} ${theme.itemHoverBg}
                  hover:opacity-80 active:opacity-60
                `}
              >
                <ArrowLeft className="w-5 h-5 pressable" />
              </button>
              <h2 className={`text-2xl font-semibold cursor-default ${theme.textHead}`}>{panel.title}</h2>
            </div>

            {panel.content}
          </div>
        )}
      </div>

      <div
        onPointerDown={startResize}
        title="Drag to resize"
        className="absolute top-0 bottom-0 right-0 w-2 cursor-col-resize touch-none hover:bg-white/20 active:bg-white/30"
      />
    </nav>
  )
}

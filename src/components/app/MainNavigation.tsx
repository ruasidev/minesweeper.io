import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { ArrowLeft, CircleHelp, MessageCircle, Paintbrush, Settings, ShieldCheck, X } from "lucide-react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { ghostColors } from "../../game/themes"
import { paneLook } from "../../hooks/useFormStyles"
import type { Panel, Route } from "../../game/types"
import { plural } from "../../lib/text"
import GlobalChat from "../menu/GlobalChat"
import HowToPlay from "../menu/HowToPlay"
import SettingsMenu from "../menu/SettingsMenu"
import SidebarMenu from "../menu/SidebarMenu"
import { MAIN_PAGES } from "./navItems"
import { APP_VERSION } from "./NavigationBar"

// What the navigation shows and does, wherever it is put
export type NavContentProps = {
  route: Route
  onNavigate: (route: Route) => void
  openPanel: Panel | null
  onOpenPanel: (panel: Panel) => void
  onClosePanel: () => void
  // how many times the player has been mentioned in the global chat since they last looked at it
  chatMentions: number
  // how many multiplayer rooms are open right now
  openRooms: number
  // on a phone or a tablet: the main pages are tabs there, so they are left out here
  compact?: boolean
  // given where the navigation is something brought up and put away again: it gets an X that does this
  onClose?: () => void
}

// The navigation as the pane floating on the left of a desktop
type MainNavigationProps = NavContentProps & {
  width: number
  minWidth: number
  onWidthChange: (width: number) => void
  // moved out past the left edge, to leave a game the whole width of a narrow window
  offScreen: boolean
}

// How narrow and how wide the pane can be dragged, in px
export const NAV_MIN_WIDTH = 192
export const NAV_MAX_WIDTH = 448
export const NAV_DEFAULT_WIDTH = 256
// Themes and settings need more room than the navigation's links
export const NAV_PANEL_MIN_WIDTH = 320

// The strip on the left taken up by the pane, which whatever is beside the pane starts clear of. It is worked out
// where the pane is laid out (App.tsx), and is nothing at all on the layouts that have no pane
export const NAV_SPACE = "var(--nav-space, 0px)"

// What replaces the navigation when one of the entries at its foot is opened.
// `fills` is for a view that takes up the pane's whole height and scrolls inside itself, rather than with the pane
const panels: Record<Panel, { title: string, content: ReactNode, fills?: boolean }> = {
  chat: { title: "Global chat", content: <GlobalChat />, fills: true },
  themes: { title: "Themes", content: <SidebarMenu /> },
  settings: { title: "Settings", content: <SettingsMenu /> },
  help: { title: "How to play", content: <HowToPlay /> },
}

type NavItemProps = {
  icon: ReactNode
  label: string
  selected?: boolean
  // A small note at the end: how many unread messages are behind the entry, how many rooms are open.
  // `fresh` is for one that is news, and stands out; the other kind is just a figure
  tag?: string
  fresh?: boolean
  onClick: () => void
}

function NavItem({ icon, label, selected, tag, fresh, onClick }: NavItemProps) {
  const { theme } = useTheme()
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-md font-semibold text-left pressable-soft
        ${ghostColors(theme, selected)}
      `}
    >
      {icon}
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {tag && (
        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-xs leading-none ${fresh ? "bg-green-500 text-white" : "border border-current opacity-70"}`}>{tag}</span>
      )}
    </button>
  )
}

// What the pane holds: the places to go, the tools at its foot, and whichever of chat, themes, settings or help has
// been opened from those, which slides in over the rest. It fills whatever it is put in: the pane floating on the
// left of a desktop, or what "More" brings up where the navigation is tabs. There the main pages are the tabs, so
// `compact` leaves them out. (What is the signed-in player's own is not here: it is behind their picture, in the header)
export function NavContent({ route, onNavigate, openPanel, onOpenPanel, onClosePanel, chatMentions, openRooms, compact, onClose }: NavContentProps) {
  const { theme } = useTheme()
  const { isAdmin } = useAccount()

  // The view stays rendered after it is closed, until it has finished sliding back out
  const [shownPanel, setShownPanel] = useState<Panel | null>(openPanel)
  if (openPanel && openPanel !== shownPanel) setShownPanel(openPanel)
  const panel = shownPanel && panels[shownPanel]
  const isPanelOpen = openPanel !== null

  const iconButtonClass = `p-2 rounded transition-colors cursor-pointer ${theme.textHead} ${theme.itemHoverBg} hover:opacity-80 active:opacity-60`
  const closeButton = onClose && (
    <button onClick={onClose} title="Close" className={`${iconButtonClass} ml-auto`}>
      <X className="w-5 h-5 pressable" />
    </button>
  )

  const pages = (
    <>
      {!compact && MAIN_PAGES.map(({ route: to, label, icon: Icon }) => (
        <NavItem
          key={to}
          icon={<Icon className="w-5 h-5 shrink-0" />}
          label={label}
          selected={route === to}
          // what's going on in multiplayer right now, said on the way to it
          tag={to === "multiplayer" && openRooms > 0 ? `${openRooms} open` : undefined}
          onClick={() => onNavigate(to)}
        />
      ))}
      {isAdmin && (
        <NavItem icon={<ShieldCheck className="w-5 h-5 shrink-0" />} label="Admin" selected={route === "admin"} onClick={() => onNavigate("admin")} />
      )}
    </>
  )

  const tools = (
    <>
      <NavItem
        icon={<MessageCircle className="w-5 h-5 shrink-0" />}
        label="Global chat"
        tag={chatMentions > 0 ? plural(chatMentions, "mention") : undefined}
        fresh
        onClick={() => onOpenPanel("chat")}
      />
      <NavItem icon={<CircleHelp className="w-5 h-5 shrink-0" />} label="How to play" onClick={() => onOpenPanel("help")} />
      <NavItem icon={<Paintbrush className="w-5 h-5 shrink-0" />} label="Themes" onClick={() => onOpenPanel("themes")} />
      <NavItem icon={<Settings className="w-5 h-5 shrink-0" />} label="Settings" onClick={() => onOpenPanel("settings")} />
    </>
  )

  const links = (
    <div className={`flex justify-center gap-4 text-xs opacity-60 ${theme.textBody}`}>
      <a className="hover:underline" href="/privacy.html" target="_blank" rel="noopener">Privacy</a>
      <a className="hover:underline" href="/terms.html" target="_blank" rel="noopener">Terms</a>
      {/* the header that carries the version elsewhere isn't there on every small screen */}
      {compact && <span className="cursor-default">{APP_VERSION}</span>}
    </div>
  )

  return (
    <>
      {/* The navigation and the view opened from it are two layers: one slides out to the left as the other slides in from the right */}
      <div
        inert={isPanelOpen}
        className={`absolute inset-0 overflow-y-auto p-3 hide-scrollbar transition-transform duration-300 ease-out ${isPanelOpen ? "-translate-x-full" : ""}`}
      >
        {compact ? (
          <div className="flex flex-col gap-2 min-h-full">
            <div className="flex items-center gap-2 pl-2">
              <h2 className={`text-2xl font-semibold cursor-default ${theme.textHead}`}>More</h2>
              {closeButton}
            </div>
            <div className="flex flex-col gap-1">
              {pages}
              {tools}
            </div>
            <div className="mt-auto pt-4">{links}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 min-h-full">
            {pages}
            {/* pushed to the bottom of the pane */}
            <div className="mt-auto flex flex-col gap-2">
              {tools}
              {links}
            </div>
          </div>
        )}
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
              <button onClick={onClosePanel} title="Back" className={iconButtonClass}>
                <ArrowLeft className="w-5 h-5 pressable" />
              </button>
              <h2 className={`text-2xl font-semibold cursor-default ${theme.textHead}`}>{panel.title}</h2>
              {closeButton}
            </div>

            {panel.content}
          </div>
        )}
      </div>
    </>
  )
}

// The pane floating on the left of a desktop, under the header, between the board (which slides underneath it) and
// the account window (which opens above everything). Its width and its distance from the edges are the --nav-w
// and --gap variables the app lays itself out with (App.tsx)
export default function MainNavigation({ width, minWidth, onWidthChange, offScreen, ...content }: MainNavigationProps) {
  const { theme } = useTheme()
  const navRef = useRef<HTMLElement>(null)

  // Dragging the right edge resizes the pane
  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    const handle = e.currentTarget
    const main = navRef.current?.closest<HTMLElement>("[data-app]")
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
      style={{
        "--nav-visible": offScreen ? 0 : 1,
        transform: "translateX(calc((var(--nav-visible) - 1) * (100% + var(--gap) * 2)))",
        top: "calc(var(--top-space) + var(--gap))",
      } as CSSProperties}
      className={`
        animate-nav-visible
        absolute z-40 left-(--gap) bottom-(--gap) w-(--nav-w)
        overflow-hidden
        ${paneLook(theme)}
      `}
    >
      <NavContent {...content} />

      <div
        onPointerDown={startResize}
        title="Drag to resize"
        className="absolute top-0 bottom-0 right-0 w-2 cursor-col-resize touch-none hover:bg-white/20 active:bg-white/30"
      />
    </nav>
  )
}

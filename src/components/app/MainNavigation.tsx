import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { ArrowLeft, Paintbrush, Settings, ShieldCheck, Swords, User } from "lucide-react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import type { MainNavigationProps, Panel } from "../../game/types"
import SettingsMenu from "../menu/SettingsMenu"
import SidebarMenu from "../menu/SidebarMenu"

// How narrow and how wide the pane can be dragged, in px
export const NAV_MIN_WIDTH = 192
export const NAV_MAX_WIDTH = 448
export const NAV_DEFAULT_WIDTH = 256
// Themes and settings need more room than the navigation's links
export const NAV_PANEL_MIN_WIDTH = 320

// The strip on the left taken up by the pane: its width plus the gap on either side of it.
// Whatever is beside the pane starts this far in
export const NAV_SPACE = "calc(var(--nav-w) + var(--nav-gap) * 2)"

// What replaces the navigation when "Themes" or "Settings" is opened
const panels: Record<Panel, { title: string, content: ReactNode }> = {
  themes: { title: "Themes", content: <SidebarMenu /> },
  settings: { title: "Settings", content: <SettingsMenu /> },
}

type NavItemProps = {
  icon: ReactNode
  label: string
  note?: string
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}

function NavItem({ icon, label, note, selected, disabled, onClick }: NavItemProps) {
  const { theme } = useTheme()
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-md border font-semibold text-left
        ${theme.itemBg}
        ${theme.itemBorder}
        ${theme.textBody}
        ${selected ? `ring-2 ${theme.itemSelectedBorder}` : ""}
        ${disabled ? "opacity-60 cursor-default" : `pressable ${theme.itemHoverBg}`}
      `}
    >
      {icon}
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {note && <span className="block truncate text-xs font-normal opacity-80">{note}</span>}
      </span>
    </button>
  )
}

// The pane floating on the left, between the board (which slides underneath it) and the account window
// (which opens above everything). It holds the main navigation, and themes or settings in its place while one is open.
// Its width and distance from the edges are the --nav-w and --nav-gap variables set on <main>
export default function MainNavigation({ route, onNavigate, width, minWidth, onWidthChange, openPanel, onOpenPanel, onClosePanel }: MainNavigationProps) {
  const { theme } = useTheme()
  const { isAdmin } = useAccount()
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
      className={`
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
          <NavItem icon={<Swords className="w-5 h-5 shrink-0" />} label="Multiplayer" note="Coming soon" disabled />
          {isAdmin && (
            <NavItem icon={<ShieldCheck className="w-5 h-5 shrink-0" />} label="Admin" selected={route === "admin"} onClick={() => onNavigate("admin")} />
          )}

          {/* pushed to the bottom of the pane */}
          <div className="mt-auto flex flex-col gap-3">
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
          <div className="flex flex-col gap-6">
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

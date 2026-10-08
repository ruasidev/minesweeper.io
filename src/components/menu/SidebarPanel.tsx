import { useEffect, useRef } from "react"
import type { SidebarPanelProps } from "../../game/types"
import { X } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"

// The floating pane on the right side of the screen, shared by the themes menu and the settings menu
export default function SidebarPanel({ title, isOpen, onClose, children }: SidebarPanelProps) {
  const { theme } = useTheme();
  const panelRef = useRef<HTMLElement>(null)

  // Close on a click anywhere outside the panel.
  // Caught in the capture phase and stopped there, so the click that closes the panel
  // doesn't also press whatever was under it (reveal a cell, ...).
  // The header buttons that open the panels are left alone so they can close or switch panels themselves
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element
      if (panelRef.current?.contains(target) || target.closest("[data-panel-toggle]")) return
      e.stopPropagation()
      e.preventDefault()
      onClose()
    }
    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [isOpen, onClose])

  return (
    <aside
      ref={panelRef}
      className={`
        absolute z-50 top-8 bottom-8 right-8 w-80
        transition-all duration-300 hide-scrollbar
        ${isOpen 
          ? "opacity-100 translate-x-0 scale-105 pointer-events-auto" 
          : "opacity-0 translate-x-8 scale-95 pointer-events-none"}
      `}
    >
      <div
        className={`
          h-full rounded-xl overflow-hidden
          shadow-2xl shadow-black/70 ring-1 ring-white/20
          backdrop-blur-md
          ${theme.menuBg}
          ${theme.menuBorder}
        `}
      >
        <div className="flex flex-col gap-6 h-full overflow-y-auto p-4 hide-scrollbar">
          <div className="flex justify-between items-center">
            <h2 className={`text-2xl font-semibold cursor-default ${theme.textHead}`}>{title}</h2>
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

          {children}
        </div>
      </div>
    </aside>
  )
}

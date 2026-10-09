import { useEffect, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { useLayout } from "../../hooks/useLayout"
import ScreenDim from "../minesweeper/infoDisplay/ScreenDim"

type FloatingWindowProps = {
  // Left out by a window that lays itself out: it gets no title bar and no padding, only the X in its corner
  title?: string
  // shown beside the title
  badge?: ReactNode
  onClose: () => void
  // how big the window is, where there is room for a window
  className: string
  // On a phone: a sheet that comes up from the bottom and is only as tall as what is in it, for something small.
  // Without this the window takes the whole of a phone's screen, as a page of its own
  sheet?: boolean
  children: ReactNode
}

// A window floating over the dimmed screen. It is on screen for as long as it is rendered,
// and asks to be closed by its X, the Escape key, or a click on the dimmed area around it.
// A phone has no room to float a window in, so there it fills the screen, or comes up from the bottom as a sheet
export default function FloatingWindow({ title, badge, onClose, className, sheet, children }: FloatingWindowProps) {
  const { theme } = useTheme()
  const { mode, short } = useLayout()
  const cramped = mode === "phone" || short
  const [visible, setVisible] = useState(false)

  // fade-in
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose])

  const closeButton = (
    <button
      onClick={onClose}
      title="Close"
      className={`
        p-2 rounded transition-colors cursor-pointer
        ${title === undefined ? "absolute top-3 right-3 z-10" : ""}
        ${theme.textHead} ${theme.itemHoverBg}
        hover:opacity-80 active:opacity-60
      `}
    >
      <X className="w-5 h-5 pressable" />
    </button>
  )

  // The shape it takes: a window where there is room. On a phone, either all of the screen bar the gap every pane
  // keeps from its edges, or a sheet that comes up to rest at the foot of it
  const edges = "w-[calc(100%-1rem)] rounded-2xl border-2"
  const shape = !cramped ? `rounded-xl border-2 ${visible ? "scale-100" : "scale-90"} ${className}`
    : sheet ? `${edges} self-end mb-2 max-h-[calc(100%-1rem)] ${visible ? "" : "translate-y-full"}`
    : `${edges} h-[calc(100%-1rem)] ${visible ? "" : "translate-y-8"}`
  const inset = cramped ? "px-4" : "px-8"

  return (
    <ScreenDim visible={visible} onDismiss={onClose} soft>
      <div
        className={`relative flex flex-col shadow-2xl overflow-hidden
          transform transition-transform duration-200 ease-out
          ${shape}
          ${theme.menuBg}
          ${theme.menuBorder}
        `}
      >
        {title === undefined ? closeButton : (
          <div className={`flex justify-between items-center ${inset} ${cramped ? "pt-3" : "pt-6"}`}>
            <div className="flex items-center gap-3">
              <h2 className={`font-semibold cursor-default ${cramped ? "text-xl" : "text-2xl"} ${theme.textHead}`}>{title}</h2>
              {badge}
            </div>
            {closeButton}
          </div>
        )}

        <div className={`flex-1 min-h-0 overflow-y-auto hide-scrollbar ${title === undefined ? "" : `${inset} ${cramped ? "py-4" : "py-6"}`}`}>
          {children}
        </div>
      </div>
    </ScreenDim>
  )
}

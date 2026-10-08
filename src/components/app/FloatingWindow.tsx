import { useEffect, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import ScreenDim from "../minesweeper/infoDisplay/ScreenDim"

type FloatingWindowProps = {
  title: string
  // shown beside the title
  badge?: ReactNode
  onClose: () => void
  // how big the window is
  className: string
  children: ReactNode
}

// A window floating over the dimmed screen. It is on screen for as long as it is rendered,
// and asks to be closed by its X, the Escape key, or a click on the dimmed area around it
export default function FloatingWindow({ title, badge, onClose, className, children }: FloatingWindowProps) {
  const { theme } = useTheme()
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

  return (
    <ScreenDim visible={visible} onDismiss={onClose} soft>
      <div
        className={`flex flex-col rounded-xl shadow-2xl border-2 overflow-hidden
          transform transition-transform duration-200 ease-out
          ${visible ? "scale-100" : "scale-90"}
          ${className}
          ${theme.menuBg}
          ${theme.menuBorder}
        `}
      >
        <div className="flex justify-between items-center px-8 pt-6">
          <div className="flex items-center gap-3">
            <h2 className={`text-2xl font-semibold cursor-default ${theme.textHead}`}>{title}</h2>
            {badge}
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
          {children}
        </div>
      </div>
    </ScreenDim>
  )
}

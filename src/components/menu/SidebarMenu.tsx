import type { SidebarProps } from "../../game/types"
import { LossAnimationSelect } from "./LossAnimationSelect"
import { WinAnimationSelect } from "./WinAnimationSelect"
import { ThemeSelect } from "./ThemeSelect"
import { X } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"

export default function SidebarMenu({ 
  currentWinAnimation, currentLossAnimation,
  setWinAnimation, setLossAnimation,
  isOpen, onClose
}: SidebarProps) {
  const { theme } = useTheme();
  return (
    <aside
      className={`
        pointer-events-none absolute z-50
        top-8 bottom-8 right-8
        w-80  /* keep constant width */
        transition-all duration-300
        hide-scrollbar
        ${isOpen 
          ? "opacity-100 translate-x-0 scale-105" 
          : "opacity-0 translate-x-8 scale-95"}
      `}
    >
      <div
        className={`
          pointer-events-auto h-full rounded-xl overflow-hidden
          shadow-2xl shadow-black/70 ring-1 ring-white/20
          backdrop-blur-md
          ${theme.menuBg}
          ${theme.menuBorder}
        `}
      >
        <div className="flex flex-col gap-6 h-full overflow-y-auto p-4 hide-scrollbar">
          <div className="flex justify-between items-center">
            <h2 className={`text-2xl font-semibold cursor-default ${theme.textHead}`}>Menu</h2>
            <button
              onClick={onClose}
              className={`
                p-2 rounded transition-colors
                ${theme.textHead} ${theme.itemHoverBg}
                hover:opacity-80 active:opacity-60
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400
              `}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <ThemeSelect />
          <WinAnimationSelect animation={currentWinAnimation} theme={theme} onChange={setWinAnimation} />
          <LossAnimationSelect animation={currentLossAnimation} theme={theme} onChange={setLossAnimation} />
        </div>
      </div>
    </aside>
  )
}
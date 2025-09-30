import type { SidebarProps } from "../game/types"
import { LossAnimationSelect } from "./LossAnimationSelect"
import { WinAnimationSelect } from "./WinAnimationSelect"
import { ThemeSelect } from "./ThemeSelect"

export default function SidebarMenu({ 
  currentWinAnimation, currentLossAnimation, currentTheme,
  setWinAnimation, setLossAnimation, setTheme,
  isOpen, onClose
}: SidebarProps) {
  return (
    <aside
    className={`
        pointer-events-none absolute inset-y-4 right-4 z-50
        transition-[width,opacity,transform] duration-300
        ${isOpen ? "w-80 opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-4"}
        overflow-hidden
    `}
    >
    <div
        className={`
        pointer-events-auto h-full border rounded-lg shadow-xl overflow-hidden
        backdrop-blur-sm
        ${currentTheme.menuBg}
        ${currentTheme.menuBorder}
        `}
    >
        <div className="flex flex-col gap-6 h-full overflow-y-auto p-4">
        <div className="flex justify-between items-center">
            <h2 className={`text-2xl font-semibold ${currentTheme.textHead}`}>Menu</h2>
            <button onClick={onClose} className={`${currentTheme.textHead}`}>✕</button>
        </div>

        <ThemeSelect themeId={currentTheme.id} theme={currentTheme} onChange={setTheme} />
        <WinAnimationSelect animation={currentWinAnimation} theme={currentTheme} onChange={setWinAnimation} />
        <LossAnimationSelect animation={currentLossAnimation} theme={currentTheme} onChange={setLossAnimation} />
        </div>
    </div>
    </aside>
  )
}

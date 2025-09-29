import type { SidebarProps } from "../game/types"
import { LossAnimationSelect } from "./LossAnimationSelect"
import { WinAnimationSelect } from "./WinAnimationSelect"
import { ThemeSelect } from "./ThemeSelect"

export default function SidebarMenu({ 
    currentWinAnimation, currentLossAnimation, currentTheme,
    setWinAnimation, setLossAnimation, setTheme
}: SidebarProps) {
    return (
        <aside className={`w-80 border-l flex flex-col gap-6 overflow-y-auto p-4 max-h-screen
            ${currentTheme.menuBg}
            ${currentTheme.menuBorder}
        `}>
          <h2 className={`text-2xl font-semibold ${currentTheme.textHead}`}>Menu</h2>
          <ThemeSelect themeId={currentTheme.id} theme={currentTheme} onChange={setTheme} />
          <WinAnimationSelect animation={currentWinAnimation} theme={currentTheme} onChange={setWinAnimation} />
          <LossAnimationSelect animation={currentLossAnimation} theme={currentTheme} onChange={setLossAnimation} />
        </aside>
    )
}
import type { SidebarProps } from "../game/types"
import { LossAnimationSelect } from "./LossAnimationSelect"
import { WinAnimationSelect } from "./WinAnimationSelect"
import { ThemeSelect } from "./ThemeSelect"

export default function SidebarMenu({ 
    currentWinAnimation, currentLossAnimation, currentTheme,
    setWinAnimation, setLossAnimation, setTheme
}: SidebarProps) {
    return (
        <aside className="w-80 border-l border-gray-700 bg-gray-800 flex flex-col gap-6 overflow-y-auto p-4 max-h-screen">
          <h2 className="text-2xl font-semibold">Menu</h2>
          <WinAnimationSelect animation={currentWinAnimation} onChange={setWinAnimation} />
          <LossAnimationSelect animation={currentLossAnimation} onChange={setLossAnimation} />
          <ThemeSelect themeId={currentTheme.id} onChange={setTheme} />
        </aside>
    )
}
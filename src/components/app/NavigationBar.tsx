import { useTheme } from "../../context/ThemeContext"
import type { NavigationBarProps } from "../../game/types"

export default function NavigationBar({ children }: NavigationBarProps) {
  const { theme } = useTheme()
  const version = "v0.9.0-alpha"

  return (
    <header
      className={`p-4 border-b flex items-center 
        ${theme.textHead} 
        ${theme.menuBg}
        ${theme.menuBorder}
      `}
    >
      <div className="flex items-baseline gap-2 cursor-default scale-hover-105">
        <h1 className="text-3xl font-bold">minesweeper.wooasi.com</h1>
        <span className="text-sm opacity-70">({version})</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {children}
      </div>
    </header>
  )
}

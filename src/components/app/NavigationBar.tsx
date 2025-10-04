import { useTheme } from "../../context/ThemeContext"
import type { NavigationBarProps } from "../../game/types"

export default function NavigationBar({ children }: NavigationBarProps) {
  const { theme } = useTheme();
  return (
    <header
      className={`p-4 border-b flex items-center 
        ${theme.textHead} 
        ${theme.menuBg}
        ${theme.menuBorder}
      `}
    >
      <h1 className="text-3xl font-bold cursor-default scale-hover-105">minesweeper.io</h1>
      <div className="ml-auto flex items-center gap-2">
        {children}
      </div>
    </header>
  )
}

import { useTheme } from "../../context/ThemeContext"
import type { NavigationBarProps } from "../../game/types"
import GithubButton from "../menu/GithubButton"

export default function NavigationBar({ children }: NavigationBarProps) {
  const { theme } = useTheme()
  const version = "v0.9.0-alpha"

  return (
    <header
      className={`p-4 border-b flex items-center gap-2 
        ${theme.textHead} 
        ${theme.menuBg}
        ${theme.menuBorder}
      `}
    >
      <div className="flex items-baseline gap-2 cursor-default bounce-hover">
        <h1 className="text-xl font-bold">minesweeper.wooasi.com</h1>
        <span className="text-xs opacity-70">({version})</span>
      </div>
      <GithubButton />

      <div className="ml-auto flex items-center gap-2">
        {children}
      </div>
    </header>
  )
}

import { useTheme } from "../../context/ThemeContext"
import type { NavigationBarProps } from "../../game/types"
import GithubButton from "../menu/GithubButton"

export default function NavigationBar({ children }: NavigationBarProps) {
  const { theme } = useTheme()
  const version = "v1.0.0-beta.1"

  return (
    <header
      className={`p-4 border-b flex items-center gap-2 
        ${theme.textHead} 
        ${theme.menuBg}
        ${theme.menuBorder}
      `}
    >
      <div className="flex items-center gap-2 cursor-default bounce-hover">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="w-9 h-9" />
        {/* the name and the version stay lined up on their baseline, as they were before the logo joined them */}
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-bold">Minesweeper World</h1>
          <span className="text-xs opacity-70">({version})</span>
        </div>
      </div>
      <GithubButton />

      <div className="ml-auto flex items-center gap-2">
        {children}
      </div>
    </header>
  )
}

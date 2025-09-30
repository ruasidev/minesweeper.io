import type { NavigationBarProps } from "../game/types"
import { Github } from "lucide-react"

export default function NavigationBar({ theme, children }: NavigationBarProps) {
  return (
    <header
      className={`p-4 border-b flex items-center 
        ${theme.textHead} 
        ${theme.menuBg}
        ${theme.menuBorder}
      `}
    >
      <h1 className="text-3xl font-bold">minesweeper.io</h1>
      <div className="ml-auto flex items-center gap-2">
        <a
          href="https://youtu.be/dQw4w9WgXcQ?si=din5tDjdkP4h6Ygl"
          target="_blank"
          rel="noopener noreferrer"
          className={`
            p-2 rounded transition-colors
            ${theme.textHead} ${theme.itemHoverBg}
            hover:opacity-80 active:opacity-60
          `}
        >
          <Github className="w-6 h-6" />
        </a>
        {children}
      </div>
    </header>
  )
}

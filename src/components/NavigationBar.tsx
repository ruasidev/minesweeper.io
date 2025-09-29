import type { NavigationBarProps } from "../game/types"

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
        {children}
      </div>
    </header>
  )
}

import { useState } from "react"
import Game from "./components/minesweeper/Game"
import SidebarMenu from "./components/menu/SidebarMenu"
import NavigationBar from "./components/app/NavigationBar"
import { X, Paintbrush, GithubIcon } from "lucide-react"
import { useTheme } from "./context/ThemeContext"
import { GameAnimationProvider } from "./context/GameAnimationContext"
import { MinesweeperGameProvider } from "./context/MinesweeperGameContext"

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { theme } = useTheme();

  return (
    <div className="h-screen w-screen flex flex-col overflow-x-hidden select-none">
      <NavigationBar>
        <a
          href="https://youtu.be/dQw4w9WgXcQ?si=din5tDjdkP4h6Ygl"
          target="_blank"
          rel="noopener noreferrer"
          className={`
            p-2 rounded transition-colors pressable
            ${theme.textHead} ${theme.itemHoverBg}
            hover:opacity-80 active:opacity-60
          `}
        >
          <GithubIcon className="w-6 h-6" />
        </a>
        <button
          onClick={() => setIsMenuOpen(v => !v)}
          className={`p-2 rounded transition-colors pressable ${theme.textHead} ${theme.itemHoverBg}`}
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Paintbrush className="w-6 h-6" />}
        </button>
      </NavigationBar>

      <main className={`relative flex flex-1 min-h-0 ${theme.background} ${theme.font ?? ""}`}
        // Used for adjusting spacing when sidebar menu is open
        style={
          {
            ["--sidebar-w" as any]: "20rem",
            ["--sidebar-gap" as any]: "2rem",
          } as React.CSSProperties
        }
      >
        <GameAnimationProvider>
          <div className={`flex-1 min-w-0 min-h-0`}>
            <MinesweeperGameProvider>
              <Game isMenuOpen={isMenuOpen} />
            </MinesweeperGameProvider>
          </div>

          <SidebarMenu
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
          />
        </GameAnimationProvider>
      </main>
    </div>
  )
}

export default App

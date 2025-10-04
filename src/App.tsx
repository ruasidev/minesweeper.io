import { useState } from "react"
import { useTheme } from "./context/ThemeContext"
import { GameAnimationProvider } from "./context/GameAnimationContext"
import { MinesweeperGameProvider } from "./context/MinesweeperGameContext"

import Game from "./components/minesweeper/Game"
import SidebarMenu from "./components/menu/SidebarMenu"
import NavigationBar from "./components/app/NavigationBar"
import CustomizeMenuButton from "./components/menu/CustomizeMenuButton"
import GithubButton from "./components/menu/GithubButton"
import MultiplayerButton from "./components/menu/MultiplayerButton"

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { theme } = useTheme();

  return (
    <div className="h-screen w-screen flex flex-col overflow-x-hidden select-none">
      <NavigationBar>
        <MultiplayerButton />
        <GithubButton />
        <CustomizeMenuButton isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      </NavigationBar>

      <main className={`relative flex flex-1 min-h-0 ${theme.background} ${theme.font ?? ""}`}
        // Used for adjusting spacing when sidebar menu is open
        // this is so jank but it took so long to make work so i'm not touching it
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

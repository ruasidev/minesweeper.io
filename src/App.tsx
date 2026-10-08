import { useState } from "react"
import { useTheme } from "./context/ThemeContext"
import { GameAnimationProvider } from "./context/GameAnimationContext"
import { MinesweeperGameProvider } from "./context/MinesweeperGameContext"

import Game from "./components/minesweeper/Game"
import SidebarMenu from "./components/menu/SidebarMenu"
import NavigationBar from "./components/app/NavigationBar"
import CustomizeMenuButton from "./components/menu/CustomizeMenuButton"
import SettingsMenu from "./components/menu/SettingsMenu"
import SettingsMenuButton from "./components/menu/SettingsMenuButton"
import GithubButton from "./components/menu/GithubButton"
import MultiplayerButton from "./components/menu/MultiplayerButton"

// The panes that open on the right side of the screen; only one is open at a time
type Panel = "themes" | "settings"

function App() {
  const [openPanel, setOpenPanel] = useState<Panel | null>(null)
  const togglePanel = (panel: Panel) => setOpenPanel(open => open === panel ? null : panel)
  const closePanel = () => setOpenPanel(null)
  const { theme } = useTheme();

  return (
    <div className="h-screen w-screen flex flex-col overflow-x-hidden select-none">
      <NavigationBar>
        <GithubButton />
        <MultiplayerButton />
        <CustomizeMenuButton isMenuOpen={openPanel === "themes"} onToggle={() => togglePanel("themes")} />
        <SettingsMenuButton isMenuOpen={openPanel === "settings"} onToggle={() => togglePanel("settings")} />
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
              <Game isMenuOpen={openPanel !== null} />
            </MinesweeperGameProvider>
          </div>

          <SidebarMenu
            isOpen={openPanel === "themes"}
            onClose={closePanel}
          />
          <SettingsMenu
            isOpen={openPanel === "settings"}
            onClose={closePanel}
          />
        </GameAnimationProvider>
      </main>
    </div>
  )
}

export default App

import { useState } from "react"
import { useTheme } from "./context/ThemeContext"
import { useLocalStorage } from "./hooks/useLocalStorage"
import { useRoute } from "./hooks/useRoute"
import { GameAnimationProvider } from "./context/GameAnimationContext"
import { MinesweeperGameProvider } from "./context/MinesweeperGameContext"

import Game from "./components/minesweeper/Game"
import AdminScreen from "./components/admin/AdminScreen"
import NavigationBar from "./components/app/NavigationBar"
import AccountModal from "./components/account/AccountModal"
import AccountButtons from "./components/menu/AccountButtons"
import MainNavigation, { NAV_DEFAULT_WIDTH, NAV_MIN_WIDTH, NAV_PANEL_MIN_WIDTH } from "./components/app/MainNavigation"
import type { AuthMode, Panel } from "./game/types"

function App() {
  const { route, navigate } = useRoute()
  // Themes and settings open inside the left pane, in place of the navigation
  const [openPanel, setOpenPanel] = useState<Panel | null>(null)
  const [navWidth, setNavWidth] = useLocalStorage<number>("navWidth", NAV_DEFAULT_WIDTH)
  // they need more room than the navigation's links, so the pane is at least that wide while one is open
  const paneMinWidth = openPanel ? NAV_PANEL_MIN_WIDTH : NAV_MIN_WIDTH
  const paneWidth = Math.max(navWidth, paneMinWidth)

  // The account window floats over everything. "Log in" and "Sign up" in the header open it on their own form
  const [accountOpen, setAccountOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>("signIn")
  const openAccount = (mode?: AuthMode) => {
    if (mode) setAuthMode(mode)
    setAccountOpen(true)
  }
  const { theme } = useTheme();

  return (
    <div className="h-screen w-screen flex flex-col overflow-x-hidden select-none">
      <NavigationBar>
        <AccountButtons onOpenAuth={openAccount} onOpenProfile={() => openAccount()} />
      </NavigationBar>

      <main className={`relative flex flex-1 min-h-0 animate-nav-width ${theme.background} ${theme.font ?? ""}`}
        style={
          {
            // the pane on the left: its width (draggable), and its distance from the edges
            "--nav-w": `${paneWidth}px`,
            "--nav-gap": "0.5rem",
          } as React.CSSProperties
        }
      >
        <GameAnimationProvider>
          {/* Layers: the game underneath, the left pane floating over it, the account window over everything */}
          <div className={`flex-1 min-w-0 min-h-0`}>
            {/* the game's state lives above both pages, so a game in progress is still there after a visit to the admin page */}
            <MinesweeperGameProvider>
              {route === "admin" ? <AdminScreen /> : <Game />}
            </MinesweeperGameProvider>
          </div>

          <MainNavigation
            route={route}
            onNavigate={navigate}
            width={paneWidth}
            minWidth={paneMinWidth}
            onWidthChange={setNavWidth}
            openPanel={openPanel}
            onOpenPanel={setOpenPanel}
            onClosePanel={() => setOpenPanel(null)}
          />
          <AccountModal
            isOpen={accountOpen}
            onClose={() => setAccountOpen(false)}
            authMode={authMode}
            onAuthModeChange={setAuthMode}
          />
        </GameAnimationProvider>
      </main>
    </div>
  )
}

export default App

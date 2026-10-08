import { useCallback, useEffect, useRef, useState } from "react"
import { useTheme } from "./context/ThemeContext"
import { useSettings } from "./context/SettingsContext"
import { useLocalStorage } from "./hooks/useLocalStorage"
import { ROUTES, useRoute } from "./hooks/useRoute"
import { useViewportWidth } from "./hooks/useViewportWidth"
import { GameWidthContext } from "./context/GameWidthContext"
import { BadgeGalleryContext } from "./context/BadgeGalleryContext"
import BadgeGallery from "./components/account/BadgeGallery"
import type { BadgeId } from "../shared/badges"
import { GameAnimationProvider } from "./context/GameAnimationContext"
import { MinesweeperGameProvider } from "./context/MinesweeperGameContext"

import Game from "./components/minesweeper/Game"
import AdminScreen from "./components/admin/AdminScreen"
import MultiplayerScreen from "./components/multiplayer/MultiplayerScreen"
import DailyScreen from "./components/scores/DailyScreen"
import LeaderboardScreen from "./components/scores/LeaderboardScreen"
import NavigationBar from "./components/app/NavigationBar"
import AccountModal from "./components/account/AccountModal"
import AccountButtons from "./components/menu/AccountButtons"
import ViewTransition from "./components/app/ViewTransition"
import MainNavigation, { NAV_DEFAULT_WIDTH, NAV_MIN_WIDTH, NAV_PANEL_MIN_WIDTH } from "./components/app/MainNavigation"
import type { AuthMode, Panel } from "./game/types"
import { playSound } from "./lib/sounds"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

// Room a game needs around its board and beside the left pane before the pane has to make way, in px
const GAME_MARGIN = 96

function App() {
  const { route, navigate } = useRoute()
  // Themes and settings open inside the left pane, in place of the navigation
  const [openPanel, setOpenPanel] = useState<Panel | null>(null)
  const [navWidth, setNavWidth] = useLocalStorage<number>("navWidth", NAV_DEFAULT_WIDTH)
  // they need more room than the navigation's links, so the pane is at least that wide while one is open
  const paneMinWidth = openPanel ? NAV_PANEL_MIN_WIDTH : NAV_MIN_WIDTH
  const paneWidth = Math.max(navWidth, paneMinWidth)

  // While a game is being played in a window too narrow to fit its board beside the left pane, the pane
  // moves out of the way. A button brings it back over the game for as long as it is wanted
  const viewportWidth = useViewportWidth()
  // how wide the board being played is, reported by the game itself; null when no game is on
  const [gameWidth, setGameWidth] = useState<number | null>(null)
  const navHidden = gameWidth !== null && openPanel === null && viewportWidth < gameWidth + paneWidth + GAME_MARGIN
  const [navPeeking, setNavPeeking] = useState(false)
  if (!navHidden && navPeeking) setNavPeeking(false)

  // The account window floats over everything. "Log in" and "Sign up" in the header open it on their own form
  const [accountOpen, setAccountOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>("signIn")
  const openAccount = (mode?: AuthMode) => {
    if (mode) setAuthMode(mode)
    setAccountOpen(true)
  }

  // The window listing every badge, opened by clicking a badge anywhere; it marks the ones that player has
  const [galleryBadges, setGalleryBadges] = useState<BadgeId[] | null>(null)

  // A room clicked in the left pane's list: go to the multiplayer page and walk into it there
  const [joinRoomId, setJoinRoomId] = useState<string | null>(null)
  const clearJoinRoom = useCallback(() => setJoinRoomId(null), [])
  const { theme } = useTheme();
  const { settings } = useSettings();

  // The interface makes a sound when the screen changes: going to another page, themes or settings opening
  // or closing, the account window opening. Buttons that leave the screen as it is stay silent
  const lastScreen = useRef({ route, openPanel, accountOpen })
  useEffect(() => {
    const before = lastScreen.current
    lastScreen.current = { route, openPanel, accountOpen }
    if (route !== before.route || openPanel !== before.openPanel || (accountOpen && !before.accountOpen)) playSound("transition")
  }, [route, openPanel, accountOpen])

  return (
    <div className={`h-screen w-screen flex flex-col overflow-x-hidden select-none ${settings.reduceMotion ? "reduce-motion" : ""}`}>
      <NavigationBar>
        <AccountButtons onOpenAuth={openAccount} onOpenProfile={() => openAccount()} />
      </NavigationBar>

      <main className={`relative flex flex-1 min-h-0 animate-nav-width ${theme.background} ${theme.font ?? ""}`}
        style={
          {
            // the pane on the left: its width (draggable), and its distance from the edges
            "--nav-w": `${paneWidth}px`,
            "--nav-gap": "0.5rem",
            // 0 while the layout leaves the pane no room
            "--nav-shown": navHidden ? 0 : 1,
          } as React.CSSProperties
        }
      >
        <BadgeGalleryContext.Provider value={setGalleryBadges}>
        <GameAnimationProvider>
          {/* Layers: the game underneath, the left pane floating over it, the account window over everything */}
          <div className={`flex-1 min-w-0 min-h-0 overflow-hidden`}>
            {/* the singleplayer game's state lives above the pages, so a game in progress is still there after visiting another one */}
            <GameWidthContext.Provider value={setGameWidth}>
            <MinesweeperGameProvider>
              {/* switching page eases the new one in, the same way multiplayer moves between its stages */}
              <ViewTransition view={route} order={ROUTES} className="h-full">
                {route === "admin" ? <AdminScreen />
                  : route === "multiplayer" ? <MultiplayerScreen joinRoomId={joinRoomId} onJoinHandled={clearJoinRoom} />
                  : route === "daily" ? <DailyScreen onOpenAuth={openAccount} />
                  : route === "leaderboard" ? <LeaderboardScreen />
                  : <Game />}
              </ViewTransition>
            </MinesweeperGameProvider>
            </GameWidthContext.Provider>
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
            offScreen={navHidden && !navPeeking}
            onOpenAuth={openAccount}
            onOpenProfile={() => openAccount()}
            onPickRoom={(room) => {
              setJoinRoomId(room.id)
              navigate("multiplayer")
            }}
          />
          {navHidden && (
            <button
              onClick={() => setNavPeeking(peeking => !peeking)}
              title={navPeeking ? "Hide the menu" : "Show the menu"}
              className={`absolute z-40 top-(--nav-gap) p-2 rounded-md border shadow-lg shadow-black/40 cursor-pointer hover:opacity-80
                ${theme.menuBg} ${theme.menuBorder} ${theme.textHead}`}
              // in the corner while the pane is away, just past its edge while it is back
              style={{ left: navPeeking ? "calc(var(--nav-w) + var(--nav-gap) * 2)" : "var(--nav-gap)", transition: "left 300ms ease-out" }}
            >
              {navPeeking ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
          )}
          <AccountModal
            isOpen={accountOpen}
            onClose={() => setAccountOpen(false)}
            authMode={authMode}
            onAuthModeChange={setAuthMode}
          />
          {galleryBadges && <BadgeGallery earned={galleryBadges} onClose={() => setGalleryBadges(null)} />}
        </GameAnimationProvider>
        </BadgeGalleryContext.Provider>
      </main>
    </div>
  )
}

export default App

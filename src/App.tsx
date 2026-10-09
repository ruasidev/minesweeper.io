import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTheme } from "./context/ThemeContext"
import { useSettings } from "./context/SettingsContext"
import { useLocalStorage } from "./hooks/useLocalStorage"
import { ROUTES, useRoute } from "./hooks/useRoute"
import { useLayout } from "./hooks/useLayout"
import { useOpenRooms } from "./hooks/useOpenRooms"
import { useUnseenChat } from "./hooks/useUnseenChat"
import { useTyping, useVisibleHeight } from "./hooks/useVisibleHeight"
import { useViewportWidth } from "./hooks/useViewportWidth"
import { GameWidthContext } from "./context/GameWidthContext"
import { BadgeGalleryContext } from "./context/BadgeGalleryContext"
import BadgeGallery from "./components/account/BadgeGallery"
import type { BadgeId } from "../shared/badges"
import { GameAnimationProvider } from "./context/GameAnimationContext"
import { InputModeContext } from "./context/InputModeContext"
import { MinesweeperGameProvider } from "./context/MinesweeperGameContext"

import Game from "./components/minesweeper/Game"
import AdminScreen from "./components/admin/AdminScreen"
import MultiplayerScreen from "./components/multiplayer/MultiplayerScreen"
import DailyScreen from "./components/scores/DailyScreen"
import LeaderboardScreen from "./components/scores/LeaderboardScreen"
import HistoryScreen from "./components/history/HistoryScreen"
import NavigationBar from "./components/app/NavigationBar"
import AccountModal from "./components/account/AccountModal"
import AccountButtons from "./components/menu/AccountButtons"
import ViewTransition from "./components/app/ViewTransition"
import MainNavigation, { NavContent, NAV_DEFAULT_WIDTH, NAV_MIN_WIDTH, NAV_PANEL_MIN_WIDTH } from "./components/app/MainNavigation"
import MoreSheet from "./components/app/MoreSheet"
import { NavRail, TabBar } from "./components/app/NavTabs"
import type { AuthMode, Panel, Route } from "./game/types"
import { playSound } from "./lib/sounds"

// Room a game needs around its board and beside the left pane before the pane has to make way, in px
const GAME_MARGIN = 96
// how wide the rail of tabs is, in px: what a tablet has for navigation, and what the pane folds down to
const RAIL_WIDTH = 76

function App() {
  const { route, params, navigate } = useRoute()
  // How the app is laid out: the pane on the left of a desktop, a rail of tabs on a tablet, tabs along the
  // bottom of a phone. The pages are the same in all three
  const layout = useLayout()
  const desktop = layout.mode === "desktop"
  const phone = layout.mode === "phone"
  // The header is across the top of every layout but one: a phone on its side has no height to give it, so there
  // the rail carries the logo and the account instead
  const header = !(layout.mode === "rail" && layout.short)
  useVisibleHeight()
  const typing = useTyping()

  // Chat, themes, settings and help open inside the navigation, in place of its links
  const [openPanel, setOpenPanel] = useState<Panel | null>(null)
  // On a phone or a tablet the navigation is behind the "More" tab until it is asked for
  const [moreOpen, setMoreOpen] = useState(false)
  const closeMore = useCallback(() => setMoreOpen(false), [])

  const [navWidth, setNavWidth] = useLocalStorage<number>("navWidth", NAV_DEFAULT_WIDTH)
  // they need more room than the navigation's links, so the pane is at least that wide while one is open
  const paneMinWidth = openPanel ? NAV_PANEL_MIN_WIDTH : NAV_MIN_WIDTH
  const paneWidth = Math.max(navWidth, paneMinWidth)

  // While a game is being played in a window too narrow to fit its board beside the left pane, the pane folds
  // down to the rail of tabs a tablet has: the board gets the room, and the navigation never goes away
  const viewportWidth = useViewportWidth()
  // how wide the board being played is, reported by the game itself; null when no game is on
  const [gameWidth, setGameWidth] = useState<number | null>(null)
  const collapsed = desktop && gameWidth !== null && viewportWidth < gameWidth + paneWidth + GAME_MARGIN
  // the navigation is a rail: always on a tablet, and on a desktop while the pane is folded down
  const rail = layout.mode === "rail" || collapsed
  // with the whole pane on show there is nothing for "More" to bring up
  if (desktop && !collapsed && moreOpen) setMoreOpen(false)
  const unseenChat = useUnseenChat(openPanel === "chat" && ((desktop && !collapsed) || moreOpen))
  // how many multiplayer rooms are open right now, to say so beside the way to them
  const openRooms = useOpenRooms()?.length ?? 0

  // The account window floats over everything. "Log in" and "Sign up" in the header open it on their own form
  const [accountOpen, setAccountOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>("signIn")
  const openAccount = (mode?: AuthMode) => {
    if (mode) setAuthMode(mode)
    setAccountOpen(true)
  }

  // What a tap on a board does on a touch screen: uncover, or flag. One switch for every board in the app
  const [flagMode, setFlagMode] = useState(false)
  const inputMode = useMemo(() => ({ flagMode, setFlagMode }), [flagMode])

  // The window listing every badge, opened by clicking a badge anywhere; it marks the ones that player has
  const [galleryBadges, setGalleryBadges] = useState<BadgeId[] | null>(null)

  const { theme } = useTheme();
  const { settings } = useSettings();

  // Going somewhere puts "More" away: it was only in the way to get there
  const goTo = (to: Route) => {
    navigate(to)
    setMoreOpen(false)
  }
  const navigation = {
    route,
    onNavigate: goTo,
    openPanel,
    onOpenPanel: setOpenPanel,
    onClosePanel: () => setOpenPanel(null),
    unseenChat,
    openRooms,
  }
  const tabs = {
    route,
    onNavigate: goTo,
    moreOpen,
    onToggleMore: () => setMoreOpen(open => !open),
    moreBadge: unseenChat > 0,
    openRooms,
  }
  // what is the signed-in player's own, wherever the way to it is put: the header, or the foot of a rail without one
  const account = {
    onOpenAuth: openAccount,
    onOpenProfile: () => openAccount(),
    onOpenHistory: () => goTo("history"),
  }

  // The interface makes a sound when the screen changes: going to another page, themes or settings opening
  // or closing, "More" or the account window opening. Buttons that leave the screen as it is stay silent
  const lastScreen = useRef({ route, openPanel, accountOpen, moreOpen })
  useEffect(() => {
    const before = lastScreen.current
    lastScreen.current = { route, openPanel, accountOpen, moreOpen }
    if (route !== before.route || openPanel !== before.openPanel || moreOpen !== before.moreOpen || (accountOpen && !before.accountOpen)) playSound("transition")
  }, [route, openPanel, accountOpen, moreOpen])

  // A phone's browser tints its own bars with the page's theme colour. The page says violet, for the cards a
  // link to the game is shared as; once the game is running the bars take the colour of the app's own background
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const color = rootRef.current && getComputedStyle(rootRef.current).backgroundColor
    if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color)
  }, [theme])

  // How the app is laid out, in one place. The page fills the whole screen, and the app's own pieces (the header,
  // the navigation) are panes that float over it, a gap in from the edges and from each other. These say how much
  // of each edge the panes take up, and every page starts its contents clear of them: what a page scrolls passes
  // underneath the panes rather than stopping short of them
  const spaces = {
    // between a pane and the edge of the screen, and between one pane and the next
    "--gap": "0.5rem",
    "--header-h": phone ? "3rem" : "3.5rem",
    "--rail-w": `${RAIL_WIDTH}px`,
    // down to the bottom edge of the header
    "--top-space": header ? "calc(var(--gap) + var(--header-h) + env(safe-area-inset-top))" : "env(safe-area-inset-top)",
    // up to the top edge of the tabs along the bottom of a phone, which are out of the way while its keyboard is up
    "--bottom-space": phone && !typing ? "calc(max(var(--gap), env(safe-area-inset-bottom)) + 3.5rem)" : "env(safe-area-inset-bottom)",
    // In to the right-hand edge of whatever the navigation is on the left. On a desktop that is the pane, with the
    // gap either side of it: as much of the pane's width as is on show
    "--nav-space": desktop ? "calc(var(--nav-w) * var(--nav-shown) + var(--gap) * 2)"
      : phone ? "env(safe-area-inset-left)"
      : "calc(var(--gap) + var(--rail-w) + env(safe-area-inset-left))",
    // The pane on the left of a desktop: its width (draggable), and how much of that the layout makes room for.
    // All of it, or while the pane is folded down to the rail, the share of it that is the rail's width
    ...(desktop ? { "--nav-w": `${paneWidth}px`, "--nav-shown": collapsed ? RAIL_WIDTH / paneWidth : 1 } : {}),
  } as React.CSSProperties

  return (
    <div
      ref={rootRef}
      data-app
      className={`relative app-height w-full overflow-hidden select-none animate-nav-width
        ${theme.background} ${theme.font ?? ""}
        ${settings.reduceMotion ? "reduce-motion" : ""}`}
      style={spaces}
    >
        <BadgeGalleryContext.Provider value={setGalleryBadges}>
        <GameAnimationProvider>
        <InputModeContext.Provider value={inputMode}>
          {/* Layers, from the bottom: the page, the panes floating over it, the windows over everything */}
          <main className="absolute inset-0">
            {/* the singleplayer game's state lives above the pages, so a game in progress is still there after visiting another one */}
            <GameWidthContext.Provider value={setGameWidth}>
            <MinesweeperGameProvider>
              {/* switching page eases the new one in, the same way multiplayer moves between its stages */}
              <ViewTransition view={route} order={ROUTES} className="h-full">
                {route === "admin" ? <AdminScreen />
                  : route === "multiplayer" ? <MultiplayerScreen />
                  : route === "daily" ? <DailyScreen onOpenAuth={openAccount} />
                  : route === "leaderboard" ? <LeaderboardScreen />
                  : route === "history" ? <HistoryScreen userId={params[0] ?? null} gameId={params[1] ? Number(params[1]) : null} onOpenAuth={openAccount} />
                  : <Game />}
              </ViewTransition>
            </MinesweeperGameProvider>
            </GameWidthContext.Provider>
          </main>

          {header && (
            <NavigationBar>
              <AccountButtons {...account} />
            </NavigationBar>
          )}
          {rail && <NavRail {...tabs} {...account} standalone={!header} />}
          {/* out of the way while the keyboard is up: there is little enough room as it is */}
          {phone && !typing && <TabBar {...tabs} />}
          {(!desktop || collapsed) && (
            <MoreSheet open={moreOpen} beside={rail} onClose={closeMore}>
              <NavContent {...navigation} compact onClose={closeMore} />
            </MoreSheet>
          )}

          {/* folded down, the pane slides out from under the rail that has taken its place */}
          {desktop && (
            <MainNavigation
              {...navigation}
              width={paneWidth}
              minWidth={paneMinWidth}
              onWidthChange={setNavWidth}
              offScreen={collapsed}
            />
          )}
          <AccountModal
            isOpen={accountOpen}
            onClose={() => setAccountOpen(false)}
            authMode={authMode}
            onAuthModeChange={setAuthMode}
          />
          {galleryBadges && <BadgeGallery earned={galleryBadges} onClose={() => setGalleryBadges(null)} />}
        </InputModeContext.Provider>
        </GameAnimationProvider>
        </BadgeGalleryContext.Provider>
    </div>
  )
}

export default App

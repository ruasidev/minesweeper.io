import { useTheme } from "../../context/ThemeContext"
import { useMinesweeperGameContext } from "../../context/MinesweeperGameContext"
import { useSettings } from "../../context/SettingsContext"
import { useReportGameResult } from "../../hooks/useReportGameResult"
import GameStatusBar from "./infoDisplay/GameStatusBar"
import Board from "./Board"
import GameResult from "./infoDisplay/GameResult"
import GameControls from "./GameControls"
import { NAV_SPACE } from "../app/MainNavigation"

// Empty space kept to the right of the board, so its end is obvious when scrolled all the way over
const RIGHT_SPACE = "3rem"

export default function Game() {
  const { theme } = useTheme()
  const { board, showResult } = useMinesweeperGameContext()
  const { settings } = useSettings()
  const gameStarted = board.status !== "uninitialized"
  useReportGameResult()

  // The status bar stays pinned while scrolling, floating over the controls and board.
  // With every item switched off there is nothing to show until a game starts and it gets its reset button
  const showStatusBar = gameStarted || Object.values(settings.statusBarItems).some(Boolean)
  const statusBarPosition = showStatusBar ? settings.statusBarPosition : null

  return (
    // At the bottom the status bar itself is the space below the board, so less padding is needed there
    <div className={`h-full min-h-0 overflow-y-auto overflow-x-hidden pt-4 px-2 hide-scrollbar ${statusBarPosition === "bottom" ? "pb-4" : "pb-24"} ${theme.background}`}>
      <div className="flex flex-col gap-6 w-full min-w-0 min-h-full">
        {/* STATS */}
        {statusBarPosition === "top" && (
          // the margins centre it over the board, in the space beside the navigation
          <div className="sticky top-0 z-10 self-center" style={{ marginLeft: NAV_SPACE, marginRight: RIGHT_SPACE }}>
            <GameStatusBar />
          </div>
        )}
        {statusBarPosition === "left" && (
          // Zero-height anchor pinned to the middle of the screen; the bar hangs off it so it takes up no room in the column
          <div className="sticky top-1/2 z-10 h-0 -mb-6 self-start">
            <div className="absolute -translate-y-1/2 w-max" style={{ left: NAV_SPACE }}>
              <GameStatusBar />
            </div>
          </div>
        )}

        {/* CONTROLS */}
        {/* Hidden once the game starts. They keep their space so the board doesn't jump under the cursor on the first click */}
        <div className={`w-full transition-opacity duration-300 ${gameStarted ? "opacity-0" : ""}`} inert={gameStarted} style={{ paddingLeft: NAV_SPACE, paddingRight: RIGHT_SPACE }}>
          <div className="flex justify-center">
            <GameControls />
          </div>
        </div>

        {/* BOARD */}
        <div
          className="relative z-0 w-full min-w-0 overflow-x-auto hide-scrollbar px-3 -mx-1"
          style={{
            // The board starts beside the navigation and slides underneath it when scrolled sideways.
            // On the left the vertical status bar (at most 12rem wide) needs room beside the navigation too
            paddingLeft: statusBarPosition === "left" ? `calc(${NAV_SPACE} + 13rem)` : NAV_SPACE,
            paddingRight: RIGHT_SPACE,
          }}
        >
          <div className="w-max mx-auto">
            <Board />
          </div>
        </div>

        {statusBarPosition === "bottom" && (
          // mt-auto keeps it at the bottom of the screen when the board is shorter than the screen
          <div className="sticky bottom-0 z-10 self-center mt-auto" style={{ marginLeft: NAV_SPACE, marginRight: RIGHT_SPACE }}>
            <GameStatusBar />
          </div>
        )}

        {showResult && (
          <GameResult />
        )}
      </div>
    </div>
  )
}

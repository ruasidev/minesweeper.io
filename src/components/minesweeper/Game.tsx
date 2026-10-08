import { useTheme } from "../../context/ThemeContext"
import { useMinesweeperGameContext } from "../../context/MinesweeperGameContext"
import { useSettings } from "../../context/SettingsContext"
import GameStatusBar from "./infoDisplay/GameStatusBar"
import Board from "./Board"
import GameResult from "./infoDisplay/GameResult"
import GameControls from "./GameControls"

export default function Game({ isMenuOpen }: { isMenuOpen: boolean }) {
  const { theme } = useTheme()
  const { showResult } = useMinesweeperGameContext()
  const { settings } = useSettings()

  // The status bar stays pinned while scrolling, floating over the controls and board.
  // With every item switched off there is nothing to show
  const statusBarPosition = Object.values(settings.statusBarItems).some(Boolean) ? settings.statusBarPosition : null

  // const railRight = isMenuOpen ? "pr-[calc(var(--sidebar-w)+var(--sidebar-gap)+6px)]" : "pr-2"

  return (
    // At the bottom the status bar itself is the space below the board, so less padding is needed there
    <div className={`h-full min-h-0 overflow-y-auto overflow-x-hidden pt-4 px-2 hide-scrollbar ${statusBarPosition === "bottom" ? "pb-4" : "pb-24"} ${theme.background}`}>
      <div className="flex flex-col gap-6 w-full min-w-0 min-h-full">
        {/* STATS */}
        {statusBarPosition === "top" && (
          <div className="sticky top-0 z-10 self-center">
            <GameStatusBar />
          </div>
        )}
        {statusBarPosition === "left" && (
          // Zero-height anchor pinned to the middle of the screen; the bar hangs off it so it takes up no room in the column
          <div className="sticky top-1/2 z-10 h-0 -mb-6 self-start">
            <div className="absolute left-2 -translate-y-1/2 w-max">
              <GameStatusBar />
            </div>
          </div>
        )}

        {/* CONTROLS */}
        <div className="w-full">
          <div className="flex justify-center">
            <GameControls />
          </div>
        </div>

        {/* BOARD */}
        <div
          className="relative z-0 w-full min-w-0 overflow-x-auto hide-scrollbar px-3 -mx-1"
          style={{
            // room for the vertical status bar (at most 12rem wide) when it is on the left
            paddingLeft: statusBarPosition === "left" ? "14rem" : "3rem",
            paddingRight: isMenuOpen
              ? "calc(var(--sidebar-w) + var(--sidebar-gap) + 6px)"
              : "3rem",
            transition: "padding 300ms ease",
          }}
        >
          <div className="w-max mx-auto">
            <Board />
          </div>
        </div>

        {statusBarPosition === "bottom" && (
          // mt-auto keeps it at the bottom of the screen when the board is shorter than the screen
          <div className="sticky bottom-0 z-10 self-center mt-auto">
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

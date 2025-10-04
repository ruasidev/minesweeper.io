import { useTheme } from "../../context/ThemeContext"
import { useMinesweeperGameContext } from "../../context/MinesweeperGameContext"
import { GameStatusBar } from "./infoDisplay/GameStatusBar"
import Board from "./Board"
import GameResult from "./infoDisplay/GameResult"
import GameControls from "./GameControls"

export default function Game({ isMenuOpen }: { isMenuOpen: boolean }) {
  const { theme } = useTheme()
  const { showResult } = useMinesweeperGameContext()

  // const railRight = isMenuOpen ? "pr-[calc(var(--sidebar-w)+var(--sidebar-gap)+6px)]" : "pr-2"
  const railLeft  = "pl-2"

  return (
    <div className={`h-full min-h-0 overflow-y-auto overflow-x-hidden py-4 px-2 hide-scrollbar ${theme.background}`}>
      <div className="flex flex-col gap-6 w-full min-w-0">
        {/* STATS */}
        <div className="w-full">
          <div className="flex justify-center">
            <GameStatusBar />
          </div>
        </div>

        {/* CONTROLS */}
        <div className="w-full">
          <div className="flex justify-center">
            <GameControls />
          </div>
        </div>

        {/* BOARD */}
        <div
          className={`relative z-0 w-full min-w-0 overflow-x-auto hide-scrollbar px-3 -mx-1 ${railLeft}`}
          style={{
            paddingRight: isMenuOpen
              ? "calc(var(--sidebar-w) + var(--sidebar-gap) + 6px)"
              : "0.5rem",
            transition: "padding-right 300ms ease",
          }}
        >
          <div className="w-max mx-auto">
            <Board />
          </div>
        </div>

        {showResult && (
          <GameResult />
        )}
      </div>
    </div>
  )
}

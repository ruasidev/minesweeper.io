import { useEffect, useRef } from "react"
import { useSoloGameContext } from "../../context/SoloGameContext"
import { useSettings } from "../../context/SettingsContext"
import { useReportGameWidth } from "../../context/GameWidthContext"
import { useBoardSounds } from "../../hooks/useBoardSounds"
import { useLayout } from "../../hooks/useLayout"
import { boardSpan } from "../../lib/boardFit"
import { playSound } from "../../lib/sounds"
import GameStatusBar from "./infoDisplay/GameStatusBar"
import Board from "./Board"
import BoardStage from "./BoardStage"
import BoardViewport from "./BoardViewport"
import GameDock from "./GameDock"
import GameResult from "./infoDisplay/GameResult"
import { NAV_SPACE } from "../app/MainNavigation"

// Empty space kept to the right of the board, so its end is obvious when scrolled all the way over
const RIGHT_SPACE = "3rem"

// The room a status bar standing beside the board takes up: the bar itself (12rem) and the gaps either side of it
const SIDE_BAR_SPACE = "13rem"

export default function Game() {
  const { view: board, showResult } = useSoloGameContext()
  const { settings } = useSettings()
  const { compact } = useLayout()
  const gameStarted = board.status !== "ready"
  useBoardSounds(board)

  // The game-over screen arriving after a loss has a sound of its own.
  // (A win already played its sound when the board was cleared.)
  const resultWasShowing = useRef(showResult)
  useEffect(() => {
    if (showResult && !resultWasShowing.current && board.status === "lost") playSound("gameOver")
    resultWasShowing.current = showResult
  }, [showResult, board.status])

  // The status bar stays pinned while scrolling, floating over the controls and board.
  // With every item switched off there is nothing to show until a game starts and it gets its reset button
  const showStatusBar = gameStarted || Object.values(settings.statusBarItems).some(Boolean)
  const statusBarPosition = showStatusBar ? settings.statusBarPosition : null

  // While a game is being played the app is told how wide it is, so the left pane can make way in a narrow window.
  // A status bar standing beside the board, on either side, counts towards that
  const barBeside = statusBarPosition === "left" || statusBarPosition === "right"
  const boardWidth = boardSpan(board.cols, settings.cellSize, settings.cellGap)
  useReportGameWidth(board.status === "playing" ? boardWidth + (barBeside ? 13 * 16 : 0) : null)

  // On a phone or a tablet: the figures along the top, the board in the room between, and under it the dock, which
  // is where the board is picked before a game and what a tap does is switched during one
  if (compact) {
    return (
      <div className="h-full" style={{ paddingTop: "var(--top-space)", paddingBottom: "var(--bottom-space)", paddingLeft: NAV_SPACE, paddingRight: "env(safe-area-inset-right)" }}>
        <BoardStage status={showStatusBar && <GameStatusBar />} dock={<GameDock />}>
          <BoardViewport rows={board.rows} cols={board.cols}>
            <Board />
          </BoardViewport>
        </BoardStage>
        {showResult && <GameResult />}
      </div>
    )
  }

  return (
    // The page is the whole screen and scrolls as one: the board passes under the status bar going up, and under
    // the left pane going sideways. What floats over it stays put: the status bar, and the dock along the bottom
    <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden px-2 pb-2 hide-scrollbar" style={{ paddingTop: "calc(var(--top-space) + 1rem)" }}>
      <div className="flex flex-col gap-6 w-full min-w-0 min-h-full">
        {/* STATS */}
        {statusBarPosition === "top" && (
          // The margins centre it over the board, in the space beside the navigation. It stops a gap short of the
          // top of the screen as the page scrolls: where it sticks is measured from under the padding at the top
          // of the page, which is a little more than a gap
          <div className="sticky z-10 self-center" style={{ top: "calc(var(--gap) - 1rem)", marginLeft: NAV_SPACE, marginRight: RIGHT_SPACE }}>
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

        {statusBarPosition === "right" && (
          // the same again, hung off the right-hand edge of the screen
          <div className="sticky top-1/2 z-10 h-0 -mb-6 self-end">
            <div className="absolute right-2 -translate-y-1/2 w-max">
              <GameStatusBar />
            </div>
          </div>
        )}

        {/* BOARD */}
        <BoardViewport
          rows={board.rows}
          cols={board.cols}
          centered
          // in the middle of the height that is over, when there is any: a board taller than that starts at the top
          className="relative z-0 w-full min-w-0 px-3 -mx-1 my-auto"
          style={{
            // The board starts beside the navigation and slides underneath it when scrolled sideways.
            // A status bar standing on the left needs room beside the navigation too, and one on the right
            // takes the place of the empty space there
            paddingLeft: statusBarPosition === "left" ? `calc(${NAV_SPACE} + ${SIDE_BAR_SPACE})` : NAV_SPACE,
            paddingRight: statusBarPosition === "right" ? `calc(${SIDE_BAR_SPACE} + 0.5rem)` : RIGHT_SPACE,
          }}
        >
          <Board />
        </BoardViewport>

        {/* Along the bottom of the screen, over the board where the board is taller than that: the dock, with the
            status bar on top of it if that is where the status bar has been put. The board's own margins keep them
            at the bottom when the board is short. The space is kept while the dock is away, so nothing shifts when it goes */}
        <div className="sticky bottom-2 z-10 self-center flex flex-col items-center justify-end gap-2 min-h-14 pointer-events-none *:pointer-events-auto" style={{ marginLeft: NAV_SPACE, marginRight: RIGHT_SPACE }}>
          {statusBarPosition === "bottom" && <GameStatusBar />}
          <GameDock />
        </div>

        {showResult && (
          <GameResult />
        )}
      </div>
    </div>
  )
}

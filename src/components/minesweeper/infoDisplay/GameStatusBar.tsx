import type { ReactNode } from "react"
import { Activity } from "lucide-react"
import { useAccount } from "../../../context/AccountContext"
import { useMinesweeperGameContext } from "../../../context/MinesweeperGameContext"
import { useSettings } from "../../../context/SettingsContext"
import { useTheme } from "../../../context/ThemeContext"
import { statusBarItems, type StatusBarItem } from "../../../game/settings"
import type { GameStatus } from "../../../game/types"
import GameBar, { BarField } from "../GameBar"
import MiniClock from "./MiniClock"
import ResetGameButton from "./ResetGameButton"

// what each item is captioned with on the bar: shorter than its name in the settings
const CAPTIONS: Record<StatusBarItem, string> = {
  mines: "Mines",
  status: "Status",
  flags: "Flags left",
  revealed: "Revealed",
  progress: "Progress",
  time: "Time",
}

// how the state of the game is put, and the colour of the dot beside it
const STATES: Record<GameStatus, { word: string, dot: string }> = {
  uninitialized: { word: "Ready", dot: "bg-current opacity-40" },
  playing: { word: "Playing", dot: "bg-green-500" },
  won: { word: "Won", dot: "bg-yellow-400" },
  lost: { word: "Lost", dot: "bg-red-500" },
}

// How the game stands: figures to read, nothing to set. It is made of the same bar as the board's settings
// (GameControls), which is the one with things to press
export default function GameStatusBar() {
  const { theme } = useTheme()
  const { settings } = useSettings()
  const { session } = useAccount()
  const { rows, cols, mines, board, progress, timeSeconds, timeMinutes, saved } = useMinesweeperGameContext()
  const formattedTime = `${timeMinutes.toString().padStart(2, "0")}:${timeSeconds.toString().padStart(2, "0")}`

  // Standing beside the board, on either side, the items are stacked instead of laid out in a row
  const isVertical = settings.statusBarPosition === "left" || settings.statusBarPosition === "right"
  const state = STATES[board.status]

  const content: Record<StatusBarItem, ReactNode> = {
    mines: mines,
    status: (
      <span className="inline-flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${state.dot}`} />
        {state.word}
      </span>
    ),
    flags: mines - board.flaggedCount,
    revealed: <>{board.revealedCount}/{rows * cols - mines}</>,
    progress: <>{progress}%</>,
    time: (
      <span className="inline-flex items-center gap-1.5">
        <MiniClock />
        {formattedTime}
      </span>
    ),
  }

  return (
    <GameBar icon={<Activity className="w-4 h-4" />} label="Game" vertical={isVertical}>
      {statusBarItems.filter(item => settings.statusBarItems[item.id]).map(item => (
        <BarField key={item.id} label={CAPTIONS[item.id]} vertical={isVertical}>
          <span className={`text-sm font-bold leading-5 tabular-nums ${theme.textHead}`}>{content[item.id]}</span>
        </BarField>
      ))}
      {/* Someone signed in expects their games to count. This one won't: the server isn't running it */}
      {session && !saved && (
        <span
          className="px-2 py-1 rounded-md bg-amber-500/15 text-amber-500 text-xs font-semibold"
          title="The connection to the server is down, so this game is played in your browser alone and isn't kept"
        >
          Offline: not saved
        </span>
      )}
      {/* The board's settings are hidden during a game, so this is the way back to them */}
      {board.status !== "uninitialized" && <ResetGameButton />}
    </GameBar>
  )
}

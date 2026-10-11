import type { ReactNode } from "react"
import { Activity } from "lucide-react"
import { useAccount } from "../../../context/AccountContext"
import { useSoloGameContext } from "../../../context/SoloGameContext"
import { useSettings } from "../../../context/SettingsContext"
import { useTheme } from "../../../context/ThemeContext"
import { statusBarItems, type StatusBarItem } from "../../../game/settings"
import { useLayout } from "../../../hooks/useLayout"
import { safeCellsOf, type ViewStatus } from "../../../lib/boardView"
import { formatDuration } from "../../../lib/time"
import { GAME_MODES } from "../../../../shared/game/modes"
import GameBar, { BarField } from "../GameBar"
import MiniClock from "./MiniClock"
import ResetGameButton from "./ResetGameButton"

// what each item is captioned with on the bar: shorter than its name in the settings
const CAPTIONS: Record<StatusBarItem, string> = {
  mines: "Mines in all",
  status: "Status",
  flags: "Mines left",
  revealed: "Revealed",
  progress: "Progress",
  time: "Time",
}

// how the state of the game is put, and the colour of the dot beside it
const STATES: Record<ViewStatus, { word: string, dot: string }> = {
  ready: { word: "Ready", dot: "bg-current opacity-40" },
  playing: { word: "Playing", dot: "bg-green-500" },
  won: { word: "Won", dot: "bg-yellow-400" },
  lost: { word: "Lost", dot: "bg-red-500" },
}

// How the game stands: figures to read, nothing to set.
// On a phone it is a strip the width of the screen with the figures shared out across it, in two rows when there
// are more than fit in one; on a phone held sideways it goes down the side
export default function GameStatusBar() {
  const { theme } = useTheme()
  const { settings } = useSettings()
  const { session } = useAccount()
  const { settings: board, mode: game, view, progress, seconds, saved } = useSoloGameContext()

  const { mode, compact, short } = useLayout()
  // Standing beside the board, on either side, the items are stacked instead of laid out in a row
  const isVertical = compact ? short : settings.statusBarPosition === "left" || settings.statusBarPosition === "right"
  const state = STATES[view.status]
  const shown = statusBarItems.filter(item => settings.statusBarItems[item.id])
  // a phone's width holds four of them side by side
  const columns = !compact ? undefined : mode === "phone" && shown.length > 4 ? Math.ceil(shown.length / 2) : Math.max(1, shown.length)
  const started = view.status !== "ready"

  const content: Record<StatusBarItem, ReactNode> = {
    mines: board.mines,
    status: (
      <span className="inline-flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${state.dot}`} />
        {state.word}
      </span>
    ),
    flags: board.mines - view.flagged,
    revealed: <>{view.uncovered}/{safeCellsOf(board)}</>,
    progress: <>{progress}%</>,
    time: (
      <span className="inline-flex items-center gap-1.5">
        <MiniClock seconds={seconds} />
        {formatDuration(seconds * 1000)}
      </span>
    ),
  }

  return (
    <GameBar
      icon={<Activity className="w-4 h-4" />}
      // which of the singleplayer games this is, where there is room to say: "No guessing", or "Classic"
      label={GAME_MODES[game].label}
      vertical={isVertical}
      columns={columns}
      // up here, away from the thumbs that are busy on the board: it throws the game away
      action={compact && started && <ResetGameButton iconOnly={!isVertical} />}
    >
      {shown.map(item => (
        <BarField key={item.id} label={CAPTIONS[item.id]} vertical={isVertical}>
          <span className={`text-sm font-bold leading-5 tabular-nums ${theme.textHead}`}>{content[item.id]}</span>
        </BarField>
      ))}
      {/* Someone signed in expects their games to count. This one won't: the server isn't running it */}
      {session && !saved && (
        <span
          className="col-span-full px-2 py-1 rounded-md bg-amber-500/15 text-amber-500 text-xs font-semibold"
          title="The connection to the server is down, so this game is played in your browser alone and isn't kept"
        >
          Offline: not saved
        </span>
      )}
      {/* The board's settings are hidden during a game, so this is the way back to them */}
      {!compact && started && <ResetGameButton />}
    </GameBar>
  )
}

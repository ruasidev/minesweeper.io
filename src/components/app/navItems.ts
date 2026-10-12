import { CalendarDays, GraduationCap, Swords, Trophy, User, type LucideIcon } from "lucide-react"
import type { Route } from "../../game/types"

export type NavEntry = {
  route: Route
  label: string
  // what it is called where there is only room for a word: a tab
  short: string
  icon: LucideIcon
  // Along the bottom of a phone there is room for four tabs and "More", and this isn't one of the four: it is
  // behind "More" there. Somewhere to look things up rather than somewhere to play
  behindMore?: boolean
}

// The main places to go, in the order they are listed everywhere: the left pane on a desktop, the tabs on anything smaller
export const MAIN_PAGES: NavEntry[] = [
  { route: "game", label: "Singleplayer", short: "Solo", icon: User },
  { route: "multiplayer", label: "Multiplayer", short: "Multiplayer", icon: Swords },
  { route: "daily", label: "Daily challenge", short: "Daily", icon: CalendarDays },
  { route: "training", label: "Training", short: "Training", icon: GraduationCap },
  { route: "leaderboard", label: "Leaderboard", short: "Leaderboard", icon: Trophy, behindMore: true },
]

// The pages that are tabs along the bottom of a phone, and the ones that are behind "More" there instead. (Down
// the rail of a tablet there is room for all of them.)
export const PHONE_TABS = MAIN_PAGES.filter(page => !page.behindMore)
export const PHONE_MORE = MAIN_PAGES.filter(page => page.behindMore)

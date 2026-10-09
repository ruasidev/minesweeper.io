import { CalendarDays, Swords, Trophy, User, type LucideIcon } from "lucide-react"
import type { Route } from "../../game/types"

export type NavEntry = {
  route: Route
  label: string
  // what it is called where there is only room for a word: a tab
  short: string
  icon: LucideIcon
}

// The main places to go, in the order they are listed everywhere: the left pane on a desktop, the tabs on anything smaller
export const MAIN_PAGES: NavEntry[] = [
  { route: "game", label: "Singleplayer", short: "Solo", icon: User },
  { route: "multiplayer", label: "Multiplayer", short: "Multiplayer", icon: Swords },
  { route: "daily", label: "Daily challenge", short: "Daily", icon: CalendarDays },
  { route: "leaderboard", label: "Leaderboard", short: "Leaderboard", icon: Trophy },
]

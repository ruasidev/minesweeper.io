import type { ReactNode } from "react"
import { CalendarDays, Swords, Trophy } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"

// faint lines like the edges of cells, fading out towards the top
const GRID = {
  backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
  backgroundSize: "2.5rem 2.5rem",
  maskImage: "linear-gradient(to top, black, transparent 70%)",
}

function Reason({ icon, title, children }: { icon: ReactNode, title: string, children: ReactNode }) {
  const { theme } = useTheme()
  return (
    <li className="flex items-start gap-3">
      <span className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border ${theme.itemBg} ${theme.itemBorder} ${theme.textHead}`}>{icon}</span>
      <span>
        <span className={`block font-semibold ${theme.textHead}`}>{title}</span>
        <span className="block text-sm opacity-80">{children}</span>
      </span>
    </li>
  )
}

// The other half of the log in / sign up window: what an account is for. It is set back from the form beside it,
// in the colour of the page behind the window, with a board's lines faintly across the foot of it.
// Only shown when there is room for it
export default function AuthShowcase() {
  const { theme } = useTheme()
  return (
    <div className={`hidden md:flex relative w-[44%] shrink-0 flex-col justify-between gap-10 p-8 border-r cursor-default ${theme.background} ${theme.menuBorder} ${theme.textBody}`}>
      <div className="absolute inset-0 opacity-[0.07]" style={GRID} aria-hidden="true" />

      <div className="relative flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="w-11 h-11" />
        <span className={`text-lg font-bold ${theme.textHead}`}>Minesweeper World</span>
      </div>

      <div className="relative flex flex-col gap-7">
        <h3 className={`text-3xl font-extrabold leading-tight ${theme.textHead}`}>
          Sweep faster.<br />
          Race your friends.
        </h3>
        <ul className="flex flex-col gap-4">
          <Reason icon={<Swords className="w-5 h-5" />} title="Live multiplayer">Everyone gets the same board. First to clear it wins.</Reason>
          <Reason icon={<CalendarDays className="w-5 h-5" />} title="Daily challenge">One new board a day, and everyone's times side by side.</Reason>
          <Reason icon={<Trophy className="w-5 h-5" />} title="Leaderboards and levels">Your stats are kept, and you earn XP, badges and a rating.</Reason>
        </ul>
      </div>
    </div>
  )
}

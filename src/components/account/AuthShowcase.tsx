import type { ReactNode } from "react"
import { CalendarDays, Swords, Trophy } from "lucide-react"

// The game's own colours, taken from its logo. This panel keeps them whatever theme is chosen
const BACKDROP = [
  "radial-gradient(26rem 20rem at 0% 0%, rgba(227, 56, 133, 0.38), transparent 70%)",
  "radial-gradient(26rem 22rem at 100% 100%, rgba(109, 74, 224, 0.5), transparent 70%)",
  "linear-gradient(160deg, #1f1740 0%, #14111f 60%, #0f0e15 100%)",
].join(", ")

// faint lines like the edges of cells, fading out towards the top
const GRID = {
  backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px)",
  backgroundSize: "2.5rem 2.5rem",
  maskImage: "linear-gradient(to top, black, transparent 75%)",
}

function Reason({ icon, title, children }: { icon: ReactNode, title: string, children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 ring-1 ring-white/15">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-white/70">{children}</span>
      </span>
    </li>
  )
}

// The other half of the log in / sign up window: what an account is for. Only shown when there is room for it
export default function AuthShowcase() {
  return (
    <div
      className="hidden md:flex relative w-[44%] shrink-0 flex-col justify-between gap-10 p-8 text-white cursor-default"
      style={{ backgroundImage: BACKDROP }}
    >
      <div className="absolute inset-0" style={GRID} aria-hidden="true" />

      <div className="relative flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="w-11 h-11" />
        <span className="text-lg font-bold">Minesweeper World</span>
      </div>

      <div className="relative flex flex-col gap-7">
        <h3 className="text-3xl font-extrabold leading-tight">
          Sweep faster.<br />
          <span className="bg-linear-to-r from-[#fd8a3c] via-[#f0559b] to-[#a78bfa] bg-clip-text text-transparent">Race your friends.</span>
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

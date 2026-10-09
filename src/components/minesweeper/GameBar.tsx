import type { ReactNode } from "react"
import { useTheme } from "../../context/ThemeContext"

type GameBarProps = {
  // what the bar is, said at its leading end
  icon: ReactNode
  label: string
  // stacked in a column (the status bar down the side of the screen) rather than laid out in a row
  vertical?: boolean
  children: ReactNode
}

// The bar that the game's readouts and the board's settings are both made of, so the two read as a pair.
// Each says which it is at its leading end. What is inside tells them apart at a glance: plain figures to read
// in one, things to press and drag in the other
export default function GameBar({ icon, label, vertical, children }: GameBarProps) {
  const { theme } = useTheme()
  return (
    <div
      className={`flex rounded-xl border overflow-hidden shadow-lg shadow-black/40 ring-1 ring-white/10 cursor-default
        ${vertical ? "flex-col w-48" : "items-stretch"}
        ${theme.menuBg} ${theme.menuBorder} ${theme.textBody}`}
    >
      <div
        className={`flex items-center gap-2 px-3 text-xs font-bold uppercase tracking-wider
          ${vertical ? "py-2 border-b" : "border-r"}
          ${theme.itemBg} ${theme.menuBorder} ${theme.textHead}`}
      >
        {icon}
        {label}
      </div>
      <div className={vertical ? "flex flex-col gap-2.5 px-3 py-3" : "flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2"}>
        {children}
      </div>
    </div>
  )
}

type BarFieldProps = {
  label: string
  // in a bar that is stacked in a column: the caption and what it is for sit side by side on one line
  vertical?: boolean
  children: ReactNode
}

// One thing in a bar, under its small caption: a figure in the status bar, a control in the board's settings
export function BarField({ label, vertical, children }: BarFieldProps) {
  return (
    <div className={vertical ? "flex items-center justify-between gap-3" : "flex flex-col gap-1"}>
      <span className="text-[10px] font-semibold uppercase tracking-wide leading-none opacity-60">{label}</span>
      {children}
    </div>
  )
}

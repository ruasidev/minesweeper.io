import type { ReactNode } from "react"
import { useTheme } from "../../context/ThemeContext"

type GameBarProps = {
  // what the bar is, said at its leading end
  icon: ReactNode
  label: string
  // stacked in a column (the status bar down the side of the screen) rather than laid out in a row
  vertical?: boolean
  // On a small screen: without the label at its leading end, which there is no room for, and as wide as the space
  // it is in. What is in it is shared out in this many equal columns (or stacked, if it is vertical)
  columns?: number
  // at the trailing end of a bar laid out in columns, clear of them: something to press
  action?: ReactNode
  children: ReactNode
}

// The bar that the game's readouts and the board's settings are both made of, so the two read as a pair.
// Each says which it is at its leading end. What is inside tells them apart at a glance: plain figures to read
// in one, things to press and drag in the other
export default function GameBar({ icon, label, vertical, columns, action, children }: GameBarProps) {
  const { theme } = useTheme()
  const frame = `rounded-xl border overflow-hidden shadow-lg shadow-black/40 ring-1 ring-white/10 cursor-default ${theme.menuBg} ${theme.menuBorder} ${theme.textBody}`

  if (columns !== undefined) {
    return (
      <div className={`${frame} flex ${vertical ? "flex-col gap-2 px-3 py-2" : "items-center gap-3 min-h-13 pl-3 pr-1.5 py-1.5"}`}>
        <div
          className={vertical ? "flex flex-col gap-1.5" : "flex-1 min-w-0 grid gap-x-3 gap-y-1.5 py-0.5"}
          style={vertical ? undefined : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {children}
        </div>
        {action}
      </div>
    )
  }

  return (
    <div className={`${frame} flex ${vertical ? "flex-col w-48" : "items-stretch"}`}>
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
    <div className={vertical ? "flex items-center justify-between gap-3" : "flex flex-col gap-1 min-w-0"}>
      <span className="text-[10px] font-semibold uppercase tracking-wide leading-none opacity-60 truncate">{label}</span>
      {children}
    </div>
  )
}

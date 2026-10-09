import type { ButtonHTMLAttributes, ReactNode } from "react"
import { FlagTriangleRight, Shovel } from "lucide-react"
import { useInputMode } from "../../context/InputModeContext"
import { useTheme } from "../../context/ThemeContext"
import { ghostColors } from "../../game/themes"
import { useLayout } from "../../hooks/useLayout"

// The bar under a board on a phone or a tablet, holding what is pressed while playing. It is made like the bars
// above the board, and its buttons are tall enough for a thumb. Down the side of a phone held sideways, it stacks
export default function Dock({ className = "", children }: { className?: string, children: ReactNode }) {
  const { theme } = useTheme()
  const { short } = useLayout()
  return (
    <div
      className={`flex gap-1.5 p-1.5 rounded-xl border shadow-lg shadow-black/40 ring-1 ring-white/10
        ${short ? "flex-col items-stretch" : "items-stretch"}
        ${theme.menuBg} ${theme.menuBorder} ${theme.textBody}
        ${className}`}
    >
      {children}
    </div>
  )
}

type DockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  // one of a set of choices, and the one chosen
  selected?: boolean
  // the one thing to do next: filled in with the theme's highlight
  primary?: boolean
  // just an icon: as wide as it is tall, rather than sharing out the width of the dock
  square?: boolean
}

export function DockButton({ selected, primary, square, className = "", children, ...button }: DockButtonProps) {
  const { theme } = useTheme()
  // stacked down the side of a phone held sideways, every button is the width of the dock and keeps its own height
  const { short } = useLayout()
  return (
    <button
      {...button}
      aria-pressed={selected}
      className={`inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold pressable-soft disabled:opacity-50
        ${short ? "shrink-0 h-9 px-2" : square ? "shrink-0 w-11 h-11" : "flex-1 min-w-0 h-11 px-2"}
        ${primary ? theme.itemSelected : ghostColors(theme, selected)}
        ${selected === false ? "opacity-70" : ""}
        ${className}`}
    >
      {children}
    </button>
  )
}

// The switch for what a tap on a covered cell does, for fingers, which have no right button. Dig is the usual
// state; on Flag it takes the colour flagged cells have on the board, so it is plain at a glance which one is on.
// Holding a finger on a cell always does the other of the two, so the switch is never needed for a single flag
export function FlagToggle() {
  const { theme } = useTheme()
  const { flagMode, setFlagMode } = useInputMode()
  const segment = "flex-1 min-w-0 inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md text-sm font-semibold cursor-pointer transition-colors duration-150"
  return (
    <div role="group" aria-label="What a tap does" className={`flex-1 min-w-0 flex gap-1 p-1 rounded-lg ${theme.itemBg}`}>
      <button aria-pressed={!flagMode} className={`${segment} ${flagMode ? `${theme.textBody} opacity-70` : theme.itemSelected}`} onClick={() => setFlagMode(false)}>
        <Shovel className="w-4 h-4 shrink-0" />
        Dig
      </button>
      <button aria-pressed={flagMode} className={`${segment} ${flagMode ? `${theme.cellFlagged} text-white` : `${theme.textBody} opacity-70`}`} onClick={() => setFlagMode(true)}>
        <FlagTriangleRight className="w-4 h-4 shrink-0" fill="currentColor" />
        Flag
      </button>
    </div>
  )
}

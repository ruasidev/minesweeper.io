import { RotateCcw } from "lucide-react"
import { useSoloGameContext } from "../../../context/SoloGameContext"
import { useTheme } from "../../../context/ThemeContext"

// The one thing on the status bar that can be pressed, so it looks like the buttons everywhere else.
// Where the bar is short of room it is the icon alone, in a box big enough for a finger
export default function ResetGameButton({ iconOnly }: { iconOnly?: boolean }) {
  const { theme } = useTheme()
  const { reset } = useSoloGameContext()
  return (
    <button
      onClick={reset}
      title={iconOnly ? "Reset" : undefined}
      aria-label={iconOnly ? "Reset" : undefined}
      className={`inline-flex items-center justify-center gap-1.5 border rounded-md text-sm font-semibold pressable
        ${iconOnly ? "shrink-0 w-10 h-10" : "px-3 py-1.5 pointer-coarse:py-2.5"}
        ${theme.itemBg} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.itemBorder} ${theme.textBody}
      `}
    >
      <RotateCcw className={iconOnly ? "w-4 h-4" : "w-3.5 h-3.5"} />
      {!iconOnly && "Reset"}
    </button>
  )
}

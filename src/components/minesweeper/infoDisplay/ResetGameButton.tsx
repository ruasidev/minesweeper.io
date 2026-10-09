import { RotateCcw } from "lucide-react"
import { useMinesweeperGameContext } from "../../../context/MinesweeperGameContext"
import { useTheme } from "../../../context/ThemeContext"

// The one thing on the status bar that can be pressed, so it looks like the buttons everywhere else
export default function ResetGameButton() {
    const { theme } = useTheme()
    const { resetGame } = useMinesweeperGameContext()
    return (
        <button
            onClick={resetGame}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border rounded-md text-sm font-semibold pressable
                ${theme.itemBg} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.itemBorder} ${theme.textBody}
            `}
        >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
        </button>
    )
}

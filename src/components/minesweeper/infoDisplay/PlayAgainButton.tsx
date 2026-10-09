import { RotateCcw } from "lucide-react"
import { useMinesweeperGameContext } from "../../../context/MinesweeperGameContext"
import { useTheme } from "../../../context/ThemeContext"

// The way on from the result screen: filled with the theme's highlight, so it is plainly the thing to press
export default function PlayAgainButton({ label }: { label: string }) {
    const { theme } = useTheme()
    const { resetGame } = useMinesweeperGameContext()
    return (
        <button
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 border rounded-lg pressable font-bold
                ${theme.itemSelected} ${theme.itemBorder}
            `}
            onClick={resetGame}
        >
            <RotateCcw className="w-4 h-4" />
            {label}
        </button>
    )
}

import { useMinesweeperGameContext } from "../../../context/MinesweeperGameContext"
import { useTheme } from "../../../context/ThemeContext"

export default function PlayAgainButton() {
    const { theme } = useTheme()
    const { resetGame } = useMinesweeperGameContext()
    return (
        <button
            className={`mt-4 px-6 py-2 border rounded-md pressable font-semibold
                ${theme.itemSelectedBorder}
                ${theme.textHead}
                ${theme.menuBg}
                ${theme.itemHoverBg}
            `}
            onClick={resetGame}
        >
            Play Again
        </button>
    )
}
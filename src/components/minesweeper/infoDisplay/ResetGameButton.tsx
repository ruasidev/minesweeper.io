import { useMinesweeperGameContext } from "../../../context/MinesweeperGameContext"
import { useTheme } from "../../../context/ThemeContext"

export function ResetGameButton() {
    const { theme } = useTheme()
    const { resetGame } = useMinesweeperGameContext()
    return (
        <button
            onClick={resetGame}
            className={`px-4 py-2 border rounded pressable
                ${theme.itemSelectedBorder}
                ${theme.textHead}
                ${theme.menuBg}
                ${theme.itemHoverBg}
            `}
        >
            Reset
        </button>
    )
}
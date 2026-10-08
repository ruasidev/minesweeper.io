import { useMinesweeperGameContext } from "../../../context/MinesweeperGameContext"
import { useTheme } from "../../../context/ThemeContext"

export default function ResetGameButton() {
    const { theme } = useTheme()
    const { resetGame } = useMinesweeperGameContext()
    return (
        <button
            onClick={resetGame}
            className={`px-3 border rounded font-semibold pressable
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
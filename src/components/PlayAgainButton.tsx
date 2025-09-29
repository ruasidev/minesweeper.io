import type { PlayAgainButtonProps } from "../game/types"

export default function PlayAgainButton({ theme, onReset }: PlayAgainButtonProps) {
    return (
        <button
            className={`mt-4 px-6 py-2 border rounded-md pressable font-semibold
                ${theme.itemSelectedBorder}
                ${theme.textHead}
                ${theme.menuBg}
                ${theme.itemHoverBg}
            `}
            onClick={onReset}
        >
            Play Again
        </button>
    )
}
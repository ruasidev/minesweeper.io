import type { ResetGameButtonProps } from "../../game/types"

export function ResetGameButton({ theme, onReset }: ResetGameButtonProps) {
    return (
        <button
            onClick={onReset}
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
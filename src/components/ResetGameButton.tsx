export type ResetGameButtonProps = {
    onReset: () => void
}

export function ResetGameButton({ onReset }: ResetGameButtonProps) {
    return (
        <button
            onClick={onReset}
            className="px-4 py-2 border border-red-400 bg-gray-700 text-white rounded hover:bg-gray-600"
        >
            Reset
        </button>
    )
}
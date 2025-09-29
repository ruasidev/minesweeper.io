import type { GameStatusBarProps } from "../game/types"

export function GameStatusBar({ rows, cols, mines, status, revealedCount, flaggedCount }: GameStatusBarProps) {
    return (
        <div className="border rounded-sm flex gap-8 px-4 py-2 bg-gray-700 text-sm text-gray-200">
            <div>Mines: {mines}</div>
            <div>Status: {status}</div>
            <div>Revealed: {revealedCount}/{rows * cols - mines}</div>
            <div>Flags Remaining: {mines - flaggedCount}</div>
            <div>Progress: {(rows*cols - revealedCount - flaggedCount)/(rows*cols)}</div>
        </div>
    )
}
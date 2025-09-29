import type { GameStatusBarProps } from "../game/types"

export function GameStatusBar({ rows, cols, mines, status, revealedCount, flaggedCount, theme }: GameStatusBarProps) {
    const progress = 
        status === "playing" || status === "won"
            ? Math.round( (1 - ((rows * cols - revealedCount - flaggedCount) / (rows * cols)))*100)
            : 0
    return (
        <div className={`border rounded-sm flex gap-8 px-4 py-2 text-sm
            ${theme.menuBg}
            ${theme.textHead}
        `}
        >
            <div>Mines: {mines}</div>
            <div>Status: {status}</div>
            <div>Flags Remaining: {mines - flaggedCount}</div>
            <div>Revealed: {revealedCount}/{rows * cols - mines}</div>
            <div>Progress: {progress}%</div>
        </div>
    )
}
import type { NavigationBarProps } from "../game/types"

export default function NavigationBar({ theme }: NavigationBarProps) {
    return (
        <header className={`p-4 text-center border-b 
            ${theme.textHead}
            ${theme.menuBg}
        `}
        >
            <h1 className="text-3xl font-bold">minesweeper.io</h1>
        </header>
    )
}
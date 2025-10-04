import type { Dispatch, SetStateAction } from "react";
import { useTheme } from "../../context/ThemeContext";
import { X, Paintbrush } from "lucide-react";

export default function CustomizeMenuButton({ isMenuOpen, setIsMenuOpen }: 
        { isMenuOpen: boolean, setIsMenuOpen: Dispatch<SetStateAction<boolean>>; }) {
    const { theme } = useTheme()

    return (
        <button
            onClick={() => setIsMenuOpen(v => !v)}
            className={`p-2 rounded transition-colors hover:opacity-80 pressable ${theme.textHead} ${theme.itemHoverBg}`}
            title="Customize themes and animations"
        >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Paintbrush className="w-6 h-6" />}
        </button>
    )
}
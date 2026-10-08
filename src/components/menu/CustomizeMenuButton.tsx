import { useTheme } from "../../context/ThemeContext";
import { X, Paintbrush } from "lucide-react";

export default function CustomizeMenuButton({ isMenuOpen, onToggle }: { isMenuOpen: boolean, onToggle: () => void }) {
    const { theme } = useTheme()

    return (
        <button
            data-panel-toggle
            onClick={onToggle}
            className={`p-2 rounded transition-colors hover:opacity-80 pressable ${theme.textHead} ${theme.itemHoverBg}`}
            title="Customize themes and animations"
        >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Paintbrush className="w-6 h-6" />}
        </button>
    )
}

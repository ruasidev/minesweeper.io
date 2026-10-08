import { useTheme } from "../../context/ThemeContext";
import { X, Settings } from "lucide-react";

export default function SettingsMenuButton({ isMenuOpen, onToggle }: { isMenuOpen: boolean, onToggle: () => void }) {
    const { theme } = useTheme()

    return (
        <button
            data-panel-toggle
            onClick={onToggle}
            className={`p-2 rounded transition-colors hover:opacity-80 pressable ${theme.textHead} ${theme.itemHoverBg}`}
            title="Settings"
        >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Settings className="w-6 h-6" />}
        </button>
    )
}

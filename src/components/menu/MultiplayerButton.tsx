import { SwordsIcon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";


export default function MultiplayerButton() {
    const { theme } = useTheme()
    return (
        <button 
            className={`p-2 rounded transition-colors pressable hover:opacity-80 ${theme.textHead} ${theme.itemHoverBg}`}
            title="Coming soon..."
        >
            <SwordsIcon />
        </button>
    )
}
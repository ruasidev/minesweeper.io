import { GithubIcon } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"

export default function GithubButton() {
    const { theme } = useTheme()
    return (
        <a
            href="https://youtu.be/dQw4w9WgXcQ?si=din5tDjdkP4h6Ygl"
            target="_blank"
            rel="noopener noreferrer"
            className={`p-1 rounded transition-colors pressable hover:opacity-80 ${theme.textHead} ${theme.itemHoverBg}`}
            title="Check me out on Github!"
        >
            <GithubIcon className="w-4 h-4" />
        </a>
    )
}
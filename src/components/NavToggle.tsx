import { Menu, X } from "lucide-react"
import type { ThemeProps } from "../game/themes";

function NavToggle({ isOpen, theme, onClick }: { isOpen: boolean; theme: ThemeProps; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`p-2 rounded ${theme.itemHoverBg}`}>
      {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
    </button>
  )
}

import { useTheme } from "../../context/ThemeContext"
import type { ThemeProps } from "../../game/themes"
import { themes } from "../../game/themes"
import SidebarSectionHeader from "./SidebarSectionHeader"

export default function ThemeSelect() {
  const { theme, themeId, setThemeId } = useTheme(); 
  return (
    <div>
      <SidebarSectionHeader text="Themes" />
      <div className="grid grid-cols-2 gap-4">
        {themes.map((t: ThemeProps) => (
          <button
            key={t.id}
            className={`p-3 rounded-md border flex flex-col items-center pressable font-semibold
              ${theme.itemBg}
              ${theme.itemHoverBg}
              ${theme.itemHoverBorder}
              ${themeId === t.id ? `ring-2 ${theme.itemSelectedBorder}` : ""}
              ${theme.itemBorder}
            `}
            onClick={() => setThemeId(t.id)}
            style={{ backgroundColor: t.menuBg }}
          >
            <div className="flex flex-wrap gap-1 p-2 justify-center">
              <div className={`w-4 h-4 rounded-sm ${t.cellHidden}`} title="Hidden cell" />
              <div className={`w-4 h-4 rounded-sm ${t.cellVisible}`} title="Visible cell" />
              <div className={`w-4 h-4 rounded-sm ${t.cellFlagged}`} title="Flagged cell" />
              <div className={`w-4 h-4 rounded-sm ${t.background}`} title="Background" />
            </div>
            <span className={`text-sm ${theme.textBody}`}>{t.name}</span>
          </button>
        ))}
      </div>
    </div>

  )
}
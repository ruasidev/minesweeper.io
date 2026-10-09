import { useTheme } from "../../context/ThemeContext"
import type { ThemeProps } from "../../game/themes"
import { itemColors, themes } from "../../game/themes"
import SidebarSectionHeader from "./SidebarSectionHeader"

export default function ThemeSelect() {
  const { theme, themeId, setThemeId } = useTheme();

  // the dark themes and the light ones are listed apart, each under its own heading
  const group = (heading: string, list: ThemeProps[]) => (
    <div>
      <SidebarSectionHeader text={heading} />
      <div className="grid grid-cols-2 gap-4">
        {list.map((t: ThemeProps) => (
          <button
            key={t.id}
            aria-pressed={themeId === t.id}
            className={`p-3 rounded-md border flex flex-col items-center pressable font-semibold
              ${itemColors(theme, themeId === t.id)}
              ${theme.itemHoverBorder}
              ${theme.itemBorder}
            `}
            onClick={() => setThemeId(t.id)}
          >
            {/* each swatch has a thin edge, so it still shows when it is the same colour as the tile it sits on */}
            <div className="flex flex-wrap gap-1 p-2 justify-center">
              <div className={`w-4 h-4 rounded-sm ring-1 ring-black/25 ${t.cellHidden}`} title="Hidden cell" />
              <div className={`w-4 h-4 rounded-sm ring-1 ring-black/25 ${t.cellVisible}`} title="Visible cell" />
              <div className={`w-4 h-4 rounded-sm ring-1 ring-black/25 ${t.cellFlagged}`} title="Flagged cell" />
              <div className={`w-4 h-4 rounded-sm ring-1 ring-black/25 ${t.background}`} title="Background" />
            </div>
            <span className="text-sm">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    // two sections of the pane, spaced like the others in it
    <>
      {group("Dark themes", themes.filter(t => t.dark))}
      {group("Light themes", themes.filter(t => !t.dark))}
    </>
  )
}

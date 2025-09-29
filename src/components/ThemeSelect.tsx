import type { ThemeProps, ThemeSelectProps } from "../game/themes"
import { themes } from "../game/themes"

export function ThemeSelect({ themeId, theme, onChange }: ThemeSelectProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {themes.map((t: ThemeProps) => (
        <button
          key={t.id}
          className={`p-3 rounded-md border flex flex-col items-center pressable
            ${theme.itemBg}
            ${theme.itemHoverBg}
            ${theme.itemHoverBorder}
            ${themeId === t.id ? `ring-2 ${theme.itemSelectedBorder}` : ""}
            ${theme.itemBorder}
          `}
          onClick={() => onChange(t.id)}
          style={{ backgroundColor: t.menuBg }}
        >
          <div className={`flex gap-1 p-2`}>
            <div className={`w-4 h-4 rounded-sm ${t.cellHidden}`} />
            <div className={`w-4 h-4 rounded-sm ${t.cellVisible}`} />
            <div className={`w-4 h-4 rounded-sm ${t.cellFlagged}`} />
          </div>
          <span className={`text-sm ${theme.textBody}`}>{t.name}</span>
        </button>
      ))}
    </div>
  )
}
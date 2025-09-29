import type { ThemeProps, ThemeSelectProps } from "../game/themes"
import { themes } from "../game/themes"

export function ThemeSelect({ themeId, onChange }: ThemeSelectProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {themes.map((t: ThemeProps) => (
        <button
          key={t.id}
          className={`p-3 rounded border flex flex-col items-center ${
            themeId === t.id ? "ring-2 ring-red-400" : ""
          }`}
          onClick={() => onChange(t.id)}
          style={{ backgroundColor: t.menuBg }}
        >
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: t.cellHidden }} />
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: t.cellVisible }} />
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: t.cellFlagged }} />
          </div>
          <span className="text-xs text-white">{t.name}</span>
        </button>
      ))}
    </div>
  )
}
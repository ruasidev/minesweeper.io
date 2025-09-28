import type { Theme } from "../game/types"

export default function ThemeSelector({
  theme,
  setTheme,
  themes,
}: {
  theme: Theme
  setTheme: (t: Theme) => void
  themes: Theme[]
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-gray-200">Theme</h3>
      <div className="grid grid-cols-2 gap-3">
        {themes.map((t) => (
          <button
            key={t.name}
            onClick={() => setTheme(t)}
            className={`flex flex-col items-center p-2 rounded border ${
              theme.name === t.name ? "border-red-400" : "border-gray-600"
            }`}
            style={{ backgroundColor: t.menuBg }}
          >
            <span className="text-xs mb-1 text-black">{t.name}</span>
            <span className="text-xs mb-1 text-black">By: {t.credits}</span>
            <div className="flex gap-1">
              <span className="w-4 h-4 rounded" style={{ backgroundColor: t.background }} />
              <span className="w-4 h-4 rounded" style={{ backgroundColor: t.cellCovered }} />
              <span className="w-4 h-4 rounded" style={{ backgroundColor: t.cellRevealed }} />
              <span className="w-4 h-4 rounded" style={{ backgroundColor: t.cellFlagged }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

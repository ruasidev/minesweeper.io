import { useState } from "react"
import Game from "./pages/Game"
import { NumberInput } from "./components/NumberInput"
import ThemeSelector from "./components/ThemeSelector"
import type { Theme } from "./game/types"

const themes: Theme[] = [
  {
    name: "Classic",
    background: "#242424",
    menuBg: "#1f2937",
    menuBorder: "#374151",
    cellCovered: "#6b7280",
    cellRevealed: "#4b5563",
    cellFlagged: "#ef4444",
  },
  {
    name: "Ocean",
    background: "#0f172a",
    menuBg: "#1e293b",
    menuBorder: "#334155",
    cellCovered: "#1e3a8a",
    cellRevealed: "#3b82f6",
    cellFlagged: "#f43f5e",
  },
  {
    name: "Forest",
    background: "#1a1f1a",
    menuBg: "#064e3b",
    menuBorder: "#065f46",
    cellCovered: "#166534",
    cellRevealed: "#22c55e",
    cellFlagged: "#d97706",
  },
  {
    name: "Retro",
    background: "#2d1b4e",
    menuBg: "#3b0764",
    menuBorder: "#581c87",
    cellCovered: "#fbbf24",
    cellRevealed: "#facc15",
    cellFlagged: "#e11d48",
  },
  {
    name: "Solarized",
    background: "#002b36",
    menuBg: "#073642",
    menuBorder: "#586e75",
    cellCovered: "#268bd2",
    cellRevealed: "#2aa198",
    cellFlagged: "#dc322f",
  },
  {
    name: "Pastel",
    background: "#fdf6f0",
    menuBg: "#f5e6e8",
    menuBorder: "#e3bac6",
    cellCovered: "#a3c4f3",
    cellRevealed: "#90dbf4",
    cellFlagged: "#f08080",
  },
  {
    name: "Neon",
    background: "#0d0d0d",
    menuBg: "#111827",
    menuBorder: "#1f2937",
    cellCovered: "#22d3ee",
    cellRevealed: "#a78bfa",
    cellFlagged: "#fb7185",
  },
  {
    name: "Desert",
    background: "#ede0d4",
    menuBg: "#ddb892",
    menuBorder: "#b08968",
    cellCovered: "#7f5539",
    cellRevealed: "#e6ccb2",
    cellFlagged: "#9c6644",
  },
]

function App() {
  const [rows, setRows] = useState(15)
  const [cols, setCols] = useState(15)
  const [mines, setMines] = useState(30)
  const [resetKey, setResetKey] = useState(0)

  const [theme, setTheme] = useState<Theme>(themes[0]) // default Classic

  return (
    <div
      className="h-screen w-screen flex flex-col"
      style={{ backgroundColor: theme.background }}
    >
      <header className="p-4 text-center border-b border-gray-700">
        <h1 className="text-3xl font-bold">minesweeper.io</h1>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* left: game + stats */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex flex-col items-center gap-6 min-w-max">
            <Game
              rows={rows}
              cols={cols}
              mines={mines}
              resetKey={resetKey}
              colors={{
                cellCovered: theme.cellCovered,
                cellRevealed: theme.cellRevealed,
                cellFlagged: theme.cellFlagged,
              }}
            />
          </div>
        </div>

        {/* right: controls menu */}
        <aside
          className="w-80 p-4 flex flex-col gap-6"
          style={{
            backgroundColor: theme.menuBg,
            borderLeft: `2px solid ${theme.menuBorder}`,
          }}
        >
          <h2 className="text-2xl font-semibold text-white">Menu</h2>

          <div className="space-y-4">
            <NumberInput label="Rows" value={rows} onChange={setRows} />
            <NumberInput label="Cols" value={cols} onChange={setCols} />
            <NumberInput label="Mines" value={mines} onChange={setMines} />
          </div>

          <button
            onClick={() => setResetKey(prev => prev + 1)}
            className="mt-2 px-4 py-2 rounded-md border border-red-400 bg-gray-700 text-white hover:bg-gray-600"
          >
            Reset
          </button>

          {/* theme selector */}
          <ThemeSelector theme={theme} setTheme={setTheme} themes={themes} />
        </aside>
      </main>
    </div>
  )
}

export default App

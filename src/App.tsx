import { useState } from "react"
import Game from "./pages/Game"
import { NumberInput } from "./components/NumberInput"
import type { LossAnimation } from "./game/types"

function App() {
  const [rows, setRows] = useState(17)
  const [cols, setCols] = useState(20)
  const [mines, setMines] = useState(40)
  const [resetKey, setResetKey] = useState(0)
  const [lossAnimation, setLossAnimation] = useState<LossAnimation>("explode")

  function handleReset() {
    setResetKey(prev => prev + 1)
  }

  return (
    <div className="h-screen w-screen flex flex-col">
      <header className="p-4 text-center border-b border-gray-700">
        <h1 className="text-3xl font-bold">minesweeper.io</h1>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* left: scrollable in both directions */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex flex-col items-center gap-6 min-w-max">
            <Game rows={rows} cols={cols} mines={mines} resetKey={resetKey} lossAnimation={lossAnimation} />
          </div>
        </div>

        {/* right: controls menu */}
        <aside className="w-80 border-l border-gray-700 p-4 bg-gray-800 flex flex-col gap-6">
          <h2 className="text-2xl font-semibold">Menu</h2>

          <div className="space-y-4">
            <NumberInput label="Rows" value={rows} onChange={setRows} />
            <NumberInput label="Cols" value={cols} onChange={setCols} />
            <NumberInput label="Mines" value={mines} onChange={setMines} />
          </div>

          <button
            onClick={handleReset}
            className="mt-2 px-4 py-2 rounded-md border border-red-400 bg-gray-700 text-white hover:bg-gray-600"
          >
            Reset
          </button>

          <div className="space-y-2">
            <label className="text-sm text-gray-300">Loss Animation</label>
            <select 
              value={lossAnimation}
              onChange={(e) => setLossAnimation(e.target.value as LossAnimation)}
              className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
            >
              <option value="explode">Explode</option>
              <option value="shake">Shake</option>
              <option value="fade">Fade</option>
              <option value="pulse">Pulse</option>
              <option value="spin">Spin</option>
              <option value="drop">Drop</option>
              <option value="flash">Flash</option>
              <option value="none">None</option>
            </select>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App

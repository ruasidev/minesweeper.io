import Game from './pages/Game'

function App() {
  return (
    <div className="h-screen w-screen flex flex-col">
      <header className="p-4 text-center border-b border-gray-700">
        <h1 className="text-3xl font-bold">minesweeper.io</h1>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Board on the left */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-4">
          <Game />
        </div>

        {/* Panel on the right */}
        <aside className="w-80 border-l border-gray-700 p-4 bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Menu</h2>
          {/* Example controls */}
          <div className="space-y-4">
            <p className="text-sm text-gray-300">Game settings go here.</p>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App

import { useState } from "react"
import Game from "./pages/Game"
import { winAnimations, lossAnimations, type LossAnimationChoices, type WinAnimationChoices } from "./game/animations"
import { type ThemeChoices, themes } from "./game/themes"
import SidebarMenu from "./components/SidebarMenu"

function App() {
  const [lossAnimationId, setLossAnimationId] = useState<LossAnimationChoices>(lossAnimations[0].id)  // Explode
  const [winAnimationId, setWinAnimationId] = useState<WinAnimationChoices>(winAnimations[0].id)      // Bloom
  const [themeId, setThemeId] = useState<ThemeChoices>(themes[0].id)
  // const [theme, setTheme] = useState<ThemeProps>(themes[0])                                           // Classic

  const winAnimation = winAnimations.find(a => a.id === winAnimationId) || winAnimations[0]
  const lossAnimation = lossAnimations.find(a => a.id === lossAnimationId) || lossAnimations[0]
  const theme = themes.find(a => a.id === themeId) || themes[0]

  return (
    <div className="h-screen w-screen flex flex-col">
      <header className="p-4 text-center border-b border-gray-700">
        <h1 className="text-3xl font-bold">minesweeper.io</h1>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* left: scrollable in both directions */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex flex-col items-center gap-6 min-w-max">
            <Game
              lossAnimation={lossAnimation}
              winAnimation={winAnimation}
              theme={theme}
            />
          </div>
        </div>

        {/* right: controls menu */}
        <SidebarMenu 
          currentWinAnimation={winAnimationId}
          currentLossAnimation={lossAnimationId}
          currentTheme={theme}
          setWinAnimation={setWinAnimationId}
          setLossAnimation={setLossAnimationId}
          setTheme={setThemeId}
        />
        
      </main>
    </div>
  )
}

export default App

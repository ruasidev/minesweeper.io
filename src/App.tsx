import { useState } from "react"
import Game from "./components/Game"
import { winAnimations, lossAnimations, type LossAnimationChoices, type WinAnimationChoices } from "./game/animations"
import { type ThemeChoices, themes } from "./game/themes"
import SidebarMenu from "./components/SidebarMenu"
import NavigationBar from "./components/NavigationBar"

function App() {
  const [lossAnimationId, setLossAnimationId] = useState<LossAnimationChoices>(lossAnimations[0].id)  // Explode
  const [winAnimationId, setWinAnimationId] = useState<WinAnimationChoices>(winAnimations[0].id)      // Bloom
  const [themeId, setThemeId] = useState<ThemeChoices>(themes[0].id)

  const winAnimation = winAnimations.find(a => a.id === winAnimationId) || winAnimations[0]
  const lossAnimation = lossAnimations.find(a => a.id === lossAnimationId) || lossAnimations[0]
  const theme = themes.find(a => a.id === themeId) || themes[0]

  return (
    <div className="h-screen w-screen flex flex-col">
      <NavigationBar theme={theme} />

      <main className="flex flex-1 overflow-hidden">
        {/* CENTRAL GAME BOARD */}
        <Game
          lossAnimation={lossAnimation}
          winAnimation={winAnimation}
          theme={theme}
        />

        {/* RIGHT MENU PANEL */}
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

import { useState } from "react"
import Game from "./components/Game"
import { winAnimations, lossAnimations, type LossAnimationChoices, type WinAnimationChoices } from "./game/animations"
import { type ThemeChoices, themes } from "./game/themes"
import SidebarMenu from "./components/SidebarMenu"
import NavigationBar from "./components/NavigationBar"
import { Menu, X } from "lucide-react"

function App() {
  const [lossAnimationId, setLossAnimationId] = useState<LossAnimationChoices>(lossAnimations[0].id)
  const [winAnimationId, setWinAnimationId] = useState<WinAnimationChoices>(winAnimations[0].id)
  const [themeId, setThemeId] = useState<ThemeChoices>(themes[0].id)
  const [isMenuOpen, setIsMenuOpen] = useState(true)

  const winAnimation = winAnimations.find(a => a.id === winAnimationId) || winAnimations[0]
  const lossAnimation = lossAnimations.find(a => a.id === lossAnimationId) || lossAnimations[0]
  const theme = themes.find(a => a.id === themeId) || themes[0]

  return (
    <div className="h-screen w-screen flex flex-col overflow-x-hidden">
      <NavigationBar theme={theme}>
        <button
          onClick={() => setIsMenuOpen(v => !v)}
          className={`p-2 rounded hover:bg-gray-700 transition-colors ${theme.textHead}`}
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </NavigationBar>

      {/* key bits: relative parent, and let children be shrinkable/scrollable */}
      <main className={`relative flex flex-1 min-h-0 ${theme.background}`}>
        <div
          className={`flex-1 min-w-0 min-h-0`}
        >
          <Game lossAnimation={lossAnimation} winAnimation={winAnimation} theme={theme} isMenuOpen={isMenuOpen} />
        </div>

        <SidebarMenu
          currentWinAnimation={winAnimationId}
          currentLossAnimation={lossAnimationId}
          currentTheme={theme}
          setWinAnimation={setWinAnimationId}
          setLossAnimation={setLossAnimationId}
          setTheme={setThemeId}
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
        />
      </main>
    </div>
  )
}

export default App

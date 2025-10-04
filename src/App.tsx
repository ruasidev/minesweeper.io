import { useState } from "react"
import Game from "./components/minesweeper/Game"
import { winAnimations, lossAnimations, type LossAnimationChoices, type WinAnimationChoices } from "./game/animations"
import SidebarMenu from "./components/menu/SidebarMenu"
import NavigationBar from "./components/app/NavigationBar"
import { X, Paintbrush } from "lucide-react"
import { useTheme } from "./context/ThemeContext"

function App() {
  const [lossAnimationId, setLossAnimationId] = useState<LossAnimationChoices>(lossAnimations[0].id)
  const [winAnimationId, setWinAnimationId] = useState<WinAnimationChoices>(winAnimations[0].id)
  const [isMenuOpen, setIsMenuOpen] = useState(true)

  const { theme } = useTheme();
  const winAnimation = winAnimations.find(a => a.id === winAnimationId) || winAnimations[0]
  const lossAnimation = lossAnimations.find(a => a.id === lossAnimationId) || lossAnimations[0]

  return (
    <div className="h-screen w-screen flex flex-col overflow-x-hidden">
      <NavigationBar>
        <button
          onClick={() => setIsMenuOpen(v => !v)}
          className={`p-2 rounded transition-colors ${theme.textHead} ${theme.itemHoverBg}`}
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Paintbrush className="w-6 h-6" />}
        </button>
      </NavigationBar>

      <main className={`relative flex flex-1 min-h-0 ${theme.background} ${theme.font ?? ""}`}
        // Used for adjusting spacing when sidebar menu is open
        style={
          {
            ["--sidebar-w" as any]: "20rem",
            ["--sidebar-gap" as any]: "2rem",
          } as React.CSSProperties
        }
      >
        <div className={`flex-1 min-w-0 min-h-0`}>
          <Game 
            lossAnimation={lossAnimation} 
            winAnimation={winAnimation} 
            theme={theme} 
            isMenuOpen={isMenuOpen} 
          />
        </div>

        <SidebarMenu
          currentWinAnimation={winAnimationId}
          currentLossAnimation={lossAnimationId}
          setWinAnimation={setWinAnimationId}
          setLossAnimation={setLossAnimationId}
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
        />
      </main>
    </div>
  )
}

export default App

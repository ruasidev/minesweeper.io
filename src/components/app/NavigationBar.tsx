import { useLayout } from "../../hooks/useLayout"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useTheme } from "../../context/ThemeContext"
import GithubButton from "../menu/GithubButton"

type NavigationBarProps = {
  children?: React.ReactNode
}

export const APP_VERSION = "v1.0.0-beta.1"

// The bar across the top: the game's name, and whoever is signed in. It is a pane like the others, floating clear
// of the edges with the page passing underneath; how tall it is and where it sits come from the variables the app
// lays itself out with (App.tsx). A phone gets a slimmer one with just those two things: the rest is under "More"
export default function NavigationBar({ children }: NavigationBarProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const slim = useLayout().mode === "phone"

  return (
    <header
      className={`absolute z-40 flex items-center gap-2 h-(--header-h) ${slim ? "pl-2.5 pr-1.5" : "pl-4 pr-2.5"} ${styles.pane} ${theme.textHead}`}
      style={{
        top: "calc(var(--gap) + env(safe-area-inset-top))",
        left: "calc(var(--gap) + env(safe-area-inset-left))",
        right: "calc(var(--gap) + env(safe-area-inset-right))",
      }}
    >
      <div className="flex items-center gap-2 min-w-0 cursor-default bounce-hover">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="w-8 h-8 shrink-0" />
        <h1 className={`font-bold truncate ${slim ? "text-base" : "text-lg"}`}>Minesweeper World</h1>
        {!slim && <span className={`${styles.tag} normal-case! tracking-normal! font-semibold!`}>{APP_VERSION}</span>}
      </div>
      {!slim && <GithubButton />}

      <div className={`ml-auto shrink-0 flex items-center ${slim ? "gap-1" : "gap-2"}`}>
        {children}
      </div>
    </header>
  )
}

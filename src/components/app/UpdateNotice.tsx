import { RefreshCw } from "lucide-react"
import { useConnection } from "../../context/ConnectionContext"
import { useTheme } from "../../context/ThemeContext"
import { paneLook, useFormStyles } from "../../hooks/useFormStyles"

// Floats over everything once the server has been updated under a page that was left open: the page and the server
// no longer say the same things to each other, so nothing online works until the page is loaded again.
// (Singleplayer still plays, in the browser alone, which is why this is a notice and not a wall.)
export default function UpdateNotice() {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { status } = useConnection()
  if (status !== "outdated") return null

  return (
    <div
      role="alert"
      className={`absolute z-40 left-1/2 -translate-x-1/2 flex items-center gap-3 w-max max-w-[calc(100%-1rem)] px-4 py-3 ${paneLook(theme)} ${theme.textBody}`}
      style={{ top: "calc(var(--top-space) + var(--gap))" }}
    >
      <span className="text-sm cursor-default">Minesweeper World has been updated. Reload to keep playing online.</span>
      <button className={`${styles.primary} inline-flex items-center gap-1.5 py-1.5! text-sm shrink-0`} onClick={() => window.location.reload()}>
        <RefreshCw className="w-3.5 h-3.5" />
        Reload
      </button>
    </div>
  )
}

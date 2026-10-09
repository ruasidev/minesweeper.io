import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useLayout } from "../../hooks/useLayout"
import { useLocalStorage } from "../../hooks/useLocalStorage"
import type { Multiplayer } from "../../hooks/useMultiplayer"
import ChatBox from "./ChatBox"

// How short the pane can be dragged, in px, and how much of the window's height it can take up at most
const HEIGHT_MIN = 130
const HEIGHT_MAX_SHARE = 0.6
const HEIGHT_DEFAULT = 240

// The room's chat, docked along the bottom of the screen while the player is in a room between games.
// Dragging its top edge resizes it, and it can be hidden down to a thin bar that counts what is said in the meantime.
// On a phone it starts out as that bar, because the room itself needs the screen, and opened it takes a set share
// of the height: there is no edge there big enough to drag with a finger
export default function ChatDock({ multiplayer }: { multiplayer: Multiplayer }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { mode, compact } = useLayout()
  // (where it sits, and how far in from the edges, is the page's doing: it is the page's footer)
  const [height, setHeight] = useLocalStorage<number>("chatHeight", HEIGHT_DEFAULT)
  const [hidden, setHidden] = useLocalStorage<boolean>("chatHidden", mode === "phone")
  const { chat } = multiplayer

  // how many messages there were when the chat was last on show, to count the ones that arrive while it is hidden
  const [seenCount, setSeenCount] = useState(chat.length)
  useEffect(() => {
    if (!hidden) setSeenCount(chat.length)
  }, [hidden, chat.length])
  const unseen = Math.max(0, chat.length - seenCount)

  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    const handle = e.currentTarget
    const startY = e.clientY
    const startHeight = height
    handle.setPointerCapture(e.pointerId)

    // dragging up makes it taller
    const move = (moveEvent: PointerEvent) => {
      setHeight(Math.round(Math.min(window.innerHeight * HEIGHT_MAX_SHARE, Math.max(HEIGHT_MIN, startHeight + startY - moveEvent.clientY))))
    }
    const end = () => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", end)
      handle.removeEventListener("pointercancel", end)
    }
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", end)
    handle.addEventListener("pointercancel", end)
  }

  const toggleClass = `p-1 pointer-coarse:p-2 rounded cursor-pointer hover:opacity-80 ${theme.textHead} ${theme.itemHoverBg}`

  if (hidden) {
    return (
      // the whole bar brings the chat back, not only the arrow at its end
      <section className={`${styles.card} flex items-center gap-3 px-4 py-2 cursor-pointer`} onClick={() => setHidden(false)}>
        <h2 className={`font-semibold ${theme.textHead}`}>Chat</h2>
        {unseen > 0 && <span className="px-1.5 py-0.5 rounded-full bg-green-500 text-white text-xs font-semibold leading-none">{unseen} new</span>}
        <button className={`${toggleClass} ml-auto`} title="Show chat">
          <ChevronUp className="w-5 h-5 pressable" />
        </button>
      </section>
    )
  }

  return (
    <section
      className={`${styles.card} relative flex flex-col gap-2 px-4 pt-3 pb-4 overflow-hidden ${compact ? "min-h-48" : ""}`}
      // a set share of what can be seen of the screen where there is no dragging it
      style={{ height: compact ? "calc(var(--app-height, 100dvh) * 0.4)" : height }}
    >
      {!compact && (
        <div
          onPointerDown={startResize}
          title="Drag to resize"
          className="absolute top-0 left-0 right-0 h-2 cursor-row-resize touch-none hover:bg-white/20 active:bg-white/30"
        />
      )}
      <div className="flex items-center">
        <h2 className={`font-semibold cursor-default ${theme.textHead}`}>Chat</h2>
        <button className={`${toggleClass} ml-auto`} title="Hide chat" onClick={() => setHidden(true)}>
          <ChevronDown className="w-5 h-5 pressable" />
        </button>
      </div>
      <ChatBox messages={chat} onSend={multiplayer.sendChat} emptyText="Nothing said yet." />
    </section>
  )
}

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { playSound } from "../../lib/sounds"
import { CHAT_TEXT_MAX, type ChatMessage } from "../../../shared/protocol"
import PlayerName from "../account/PlayerName"

// Keys that don't type anything by themselves
const SILENT_KEYS = ["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "Escape"]

type ChatBoxProps = {
  messages: ChatMessage[]
  onSend: (text: string) => void
  // shown while nothing has been said
  emptyText: string
  // send button under the box rather than beside it, for a narrow space
  stacked?: boolean
}

// A chat: what has been said, newest at the bottom, and a box to say something.
// It fills whatever height it is given; the messages scroll inside it
export default function ChatBox({ messages, onSend, emptyText, stacked }: ChatBoxProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const [text, setText] = useState("")
  const listRef = useRef<HTMLDivElement>(null)

  // Keeps the newest message in view, also when the space it has changes size
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const toEnd = () => { list.scrollTop = list.scrollHeight }
    toEnd()
    const watcher = new ResizeObserver(toEnd)
    watcher.observe(list)
    return () => watcher.disconnect()
  }, [messages])

  // A click for every key pressed in the box. A key held down counts once, not once per repeat
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!e.repeat && !SILENT_KEYS.includes(e.key)) playSound("key")
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text)
    setText("")
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <div ref={listRef} className={`flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto hide-scrollbar select-text ${theme.textBody}`}>
        {messages.length === 0 && <p className="opacity-70 cursor-default">{emptyText}</p>}
        {messages.map(message => (
          <p key={message.id} className="break-words">
            <span className="text-xs opacity-60 tabular-nums mr-2">
              {new Date(message.sentAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
            <PlayerName playerId={message.playerId} username={message.username} />{" "}
            {message.text}
          </p>
        ))}
      </div>

      <form className={`flex gap-2 ${stacked ? "flex-col" : ""}`} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          placeholder="Say something"
          autoComplete="off"
          maxLength={CHAT_TEXT_MAX}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" className={styles.button}>Send</button>
      </form>
    </div>
  )
}

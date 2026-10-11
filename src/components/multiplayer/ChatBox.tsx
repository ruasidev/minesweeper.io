import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { completeMention, isMentioned, mentionAt, partsOf, suggestionsFor } from "../../lib/mentions"
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
  // Who is here to be mentioned, by name: they are offered first when an @ is typed, ahead of whoever has spoken
  people?: string[]
}

// A chat: what has been said, newest at the bottom, and a box to say something.
// It fills whatever height it is given; the messages scroll inside it.
//
// A player is mentioned by their name with an @ before it. Typing the @ brings up the names it could be, and
// whoever is named sees that message picked out from the rest
export default function ChatBox({ messages, onSend, emptyText, stacked, people }: ChatBoxProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { session, profile } = useAccount()
  const myId = session?.user.id
  const myName = profile?.username ?? session?.user.name
  const [text, setText] = useState("")
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // --- Mentioning somebody: the names offered while one is being typed
  const [caret, setCaret] = useState(0)
  // which of the names offered Enter would take
  const [choice, setChoice] = useState(0)
  // the mention whose names were put away with Escape, by where its @ is
  const [putAway, setPutAway] = useState<number | null>(null)
  const namesId = useId()
  // everyone who could be meant: whoever is here, then whoever spoke last, and never the player themselves
  const known = useMemo(
    () => [...people ?? [], ...messages.map(message => message.username).reverse()].filter(name => name !== myName),
    [people, messages, myName],
  )
  const typing = mentionAt(text, caret)
  const names = typing && typing.start !== putAway ? suggestionsFor(typing.query, known) : []
  const chosen = Math.min(choice, names.length - 1)

  // where the caret belongs once a name has been filled in: the box would otherwise put it at the end
  const caretAfter = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (caretAfter.current === null) return
    inputRef.current?.setSelectionRange(caretAfter.current, caretAfter.current)
    caretAfter.current = null
  }, [text])

  function mention(name: string) {
    const finished = completeMention(text, caret, name)
    const kept = finished.text.slice(0, CHAT_TEXT_MAX)
    caretAfter.current = Math.min(finished.caret, kept.length)
    setText(kept)
    setCaret(caretAfter.current)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // while names are on offer the arrows move through them, Enter and Tab take one, and Escape puts them away
    if (names.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        return setChoice((chosen + (e.key === "ArrowDown" ? 1 : names.length - 1)) % names.length)
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        return mention(names[chosen])
      }
      if (e.key === "Escape" && typing) {
        e.preventDefault()
        return setPutAway(typing.start)
      }
    }
    // A click for every key pressed in the box. A key held down counts once, not once per repeat
    if (!e.repeat && !SILENT_KEYS.includes(e.key)) playSound("key")
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text)
    setText("")
    setCaret(0)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <div ref={listRef} className={`flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto hide-scrollbar select-text ${theme.textBody}`}>
        {messages.length === 0 && <p className="opacity-70 cursor-default">{emptyText}</p>}
        {messages.map((message) => {
          // somebody else saying this player's name: the message is picked out, with a bar down its side
          const forMe = message.playerId !== myId && isMentioned(message.text, myName)
          return (
            <p
              key={message.id}
              title={forMe ? "You were mentioned" : undefined}
              className={`break-words ${forMe ? "px-2 py-1 rounded-md border-l-[3px] border-amber-400 bg-amber-400/15" : ""}`}
            >
              <span className="text-xs opacity-60 tabular-nums mr-2">
                {new Date(message.sentAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </span>
              <PlayerName playerId={message.playerId} username={message.username} />{" "}
              {partsOf(message.text).map((part, at) => (part.mention === undefined ? part.text : (
                <span key={at} className={`font-semibold ${isMentioned(part.text, myName) ? `px-1 rounded bg-amber-400/30 ${theme.textHead}` : ""}`}>{part.text}</span>
              )))}
            </p>
          )
        })}
      </div>

      <form className={`relative flex gap-2 ${stacked ? "flex-col" : ""}`} onSubmit={handleSubmit}>
        {names.length > 0 && (
          <div
            id={namesId}
            role="listbox"
            aria-label="Players to mention"
            className={`absolute bottom-full left-0 z-10 mb-1 min-w-44 max-w-full p-1 flex flex-col rounded-lg border shadow-lg shadow-black/40 ${theme.menuBg} ${theme.menuBorder}`}
          >
            {names.map((name, at) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={at === chosen}
                className={`px-2 py-1.5 rounded-md text-left text-sm font-semibold truncate cursor-pointer ${at === chosen ? theme.itemSelected : `${theme.textBody} ${theme.itemHoverBg}`}`}
                // the box keeps the keyboard: a press here is not a press away from it
                onMouseDown={e => e.preventDefault()}
                onClick={() => mention(name)}
              >
                @{name}
              </button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Say something"
          autoComplete="off"
          maxLength={CHAT_TEXT_MAX}
          value={text}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={names.length > 0}
          aria-controls={names.length > 0 ? namesId : undefined}
          onChange={(e) => {
            setText(e.target.value)
            setCaret(e.target.selectionStart ?? e.target.value.length)
            setChoice(0)
          }}
          // the caret moved without anything being typed: an arrow key, a click
          onSelect={e => setCaret(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" className={styles.button}>Send</button>
      </form>
    </div>
  )
}

import { useState, type FormEvent } from "react"
import { Pencil } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"

type EditableFieldProps = {
  label: string
  value: string
  // shown in front of the value, like the @ of a username
  prefix?: string
  // shown in place of the value when there isn't one
  emptyText?: string
  // several lines of ordinary text (a bio) instead of one short line (a name)
  multiline?: boolean
  maxLength?: number
  // Saves the new value. If it rejects, the error's message is shown and the box stays open
  onSave: (value: string) => Promise<void>
}

// A labelled value with a pencil that turns it into a text box
export default function EditableField({ label, value, prefix = "", emptyText = "", multiline, maxLength, onSave }: EditableFieldProps) {
  const { theme } = useTheme()
  // null while not editing, otherwise the text in the box
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (draft === null) return
    try {
      await onSave(draft.trim())
      setDraft(null)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const buttonClass = `px-3 py-2 rounded-md border pressable font-semibold
    ${theme.itemBg} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.itemBorder} ${theme.textBody}`
  const boxClass = `flex-1 min-w-0 px-3 py-2 rounded-md border select-text outline-none focus:ring-2
    ${theme.itemBg} ${theme.itemBorder} ${theme.textBody} ${theme.itemSelectedBorder}`

  return (
    <div className="flex flex-col gap-1">
      <span className={`text-xs font-semibold uppercase tracking-wide opacity-70 cursor-default ${theme.textBody}`}>{label}</span>
      {draft === null ? (
        <div className={`flex gap-2 ${multiline ? "items-start" : "items-center"}`}>
          <span
            className={`min-w-0 cursor-default
              ${multiline ? `flex-1 whitespace-pre-wrap break-words ${theme.textBody}` : `text-lg font-semibold truncate ${theme.textHead}`}
              ${value ? "" : "opacity-70"}
            `}
          >
            {value ? `${prefix}${value}` : emptyText}
          </span>
          <button
            className={`p-2 rounded cursor-pointer hover:opacity-80 ${theme.textHead} ${theme.itemHoverBg}`}
            title={`Change ${label.toLowerCase()}`}
            onClick={() => setDraft(value)}
          >
            <Pencil className="w-4 h-4 pressable" />
          </button>
        </div>
      ) : (
        <form className={`flex gap-2 ${multiline ? "flex-col" : ""}`} onSubmit={save}>
          {multiline ? (
            <textarea
              className={`${boxClass} resize-none`}
              rows={4}
              maxLength={maxLength}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoFocus
            />
          ) : (
            <input className={boxClass} maxLength={maxLength} value={draft} onChange={e => setDraft(e.target.value)} autoFocus />
          )}
          <div className="flex gap-2">
            <button type="submit" className={buttonClass}>Save</button>
            <button type="button" className={buttonClass} onClick={() => { setDraft(null); setError(null) }}>Cancel</button>
            {multiline && maxLength && (
              <span className={`ml-auto self-center text-xs opacity-70 tabular-nums cursor-default ${theme.textBody}`}>{draft.length}/{maxLength}</span>
            )}
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-red-500 font-semibold">{error}</p>}
    </div>
  )
}

import { useState, type FormEvent } from "react"
import { Pencil } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"

type EditableFieldProps = {
  label: string
  value: string
  // shown in front of the value, like the @ of a username
  prefix?: string
  // Saves the new value. If it rejects, the error's message is shown and the box stays open
  onSave: (value: string) => Promise<void>
}

// A labelled value with a pencil that turns it into a text box
export default function EditableField({ label, value, prefix = "", onSave }: EditableFieldProps) {
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

  return (
    <div className="flex flex-col gap-1">
      <span className={`text-xs font-semibold uppercase tracking-wide opacity-70 cursor-default ${theme.textBody}`}>{label}</span>
      {draft === null ? (
        <div className="flex items-center gap-2">
          <span className={`text-lg font-semibold truncate cursor-default ${theme.textHead}`}>{prefix}{value}</span>
          <button
            className={`p-2 rounded cursor-pointer hover:opacity-80 ${theme.textHead} ${theme.itemHoverBg}`}
            title={`Change ${label.toLowerCase()}`}
            onClick={() => setDraft(value)}
          >
            <Pencil className="w-4 h-4 pressable" />
          </button>
        </div>
      ) : (
        <form className="flex gap-2" onSubmit={save}>
          <input
            className={`flex-1 min-w-0 px-3 py-2 rounded-md border select-text outline-none focus:ring-2
              ${theme.itemBg} ${theme.itemBorder} ${theme.textBody} ${theme.itemSelectedBorder}`}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
          />
          <button type="submit" className={buttonClass}>Save</button>
          <button type="button" className={buttonClass} onClick={() => { setDraft(null); setError(null) }}>Cancel</button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-red-500 font-semibold">{error}</p>}
    </div>
  )
}

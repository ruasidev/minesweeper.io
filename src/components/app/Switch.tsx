import { useId, type ReactNode } from "react"
import { useTheme } from "../../context/ThemeContext"

type SwitchProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  // what being on (or off) means, said underneath
  children?: ReactNode
}

// Something that is either on or off, with its name at one end of a row and a switch at the other, as a setting
// is laid out everywhere. The whole row is there to be pressed, not only the switch.
// For a setting that stands by itself in a window that has a button to finish with: beside that button, something
// filled in when it is on would look like a second thing to finish with
export default function Switch({ label, checked, onChange, children }: SwitchProps) {
  const { theme } = useTheme()
  const describedBy = useId()
  return (
    <div>
      <button
        role="switch"
        aria-checked={checked}
        aria-describedby={children ? describedBy : undefined}
        className={`flex items-center justify-between gap-3 w-full min-h-10 text-left cursor-pointer ${theme.textBody}`}
        onClick={() => onChange(!checked)}
      >
        <span className={`text-sm font-semibold ${theme.textHead}`}>{label}</span>
        <span
          className={`relative shrink-0 w-11 h-6 rounded-full border transition-colors duration-200
            ${checked ? `${theme.itemSelected} border-transparent` : `${theme.itemBg} ${theme.itemBorder}`}`}
        >
          <span
            className={`absolute top-1/2 left-0.5 -translate-y-1/2 w-4.5 h-4.5 rounded-full transition-transform duration-200
              ${checked ? "translate-x-5 bg-white" : "bg-current opacity-60"}`}
          />
        </span>
      </button>
      {children && <p id={describedBy} className={`mt-1 text-sm opacity-70 cursor-default ${theme.textBody}`}>{children}</p>}
    </div>
  )
}

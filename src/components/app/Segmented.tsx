import type { ReactNode } from "react"
import { useTheme } from "../../context/ThemeContext"

type SegmentedProps<T extends string> = {
  // what is being chosen, for anyone who can't see that the buttons belong together
  label: string
  options: { id: T, label: string, icon?: ReactNode }[]
  value: T
  onChange: (value: T) => void
  // a smaller one, for a choice that hangs off another
  small?: boolean
  className?: string
}

// One choice out of a few, as a single control: a track with a segment for each, and the one chosen filled in.
// Being one object, it reads as one question with one answer, which a row of loose buttons doesn't
export default function Segmented<T extends string>({ label, options, value, onChange, small, className = "" }: SegmentedProps<T>) {
  const { theme } = useTheme()
  return (
    <div role="group" aria-label={label} className={`flex gap-1 p-1 rounded-lg ${theme.itemBg} ${className}`}>
      {options.map(option => (
        <button
          key={option.id}
          aria-pressed={option.id === value}
          className={`flex-1 min-w-0 inline-flex items-center justify-center gap-2 rounded-md font-semibold cursor-pointer transition-colors duration-150
            ${small ? "h-8 px-2 text-sm" : "h-10 px-2 text-sm sm:text-base"}
            ${option.id === value ? theme.itemSelected : `${theme.textBody} opacity-70 hover:opacity-100`}`}
          onClick={() => onChange(option.id)}
        >
          {option.icon}
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
  )
}

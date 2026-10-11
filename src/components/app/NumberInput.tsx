import { Minus, Plus } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"

type NumberInputProps = {
  label: string
  value: number
  min?: number
  max?: number
  // how much one notch of the slider moves the figure
  step?: number
  unit?: string
  // for a bar: a small caption with the figure beside it, over a short slider
  compact?: boolean
  // with a button either side of the figure to move it one at a time, for setting it with a finger
  stepper?: boolean
  onChange: (n: number) => void
}

export default function NumberInput({ label, value, min = 1, max = 99, step = 1, unit = "", compact, stepper, onChange }: NumberInputProps) {
  const { theme } = useTheme()
  const focusClass = `focus:${theme.itemSelectedBorder}`
  const stepClass = `flex items-center justify-center w-10 h-10 rounded-md border cursor-pointer disabled:opacity-40
    ${theme.itemBg} ${theme.itemBorder} ${theme.itemHoverBg} ${theme.textBody}`
  return (
    <div className={`flex flex-col ${compact ? "gap-1 w-28" : "gap-2"}`}>
      {/* in a bar the caption line is as tall as any other caption there, so they all sit on one line */}
      <div className={`flex justify-between items-center ${compact ? "h-2.5" : ""}`}>
        {compact ? (
          <>
            <label className={`text-[10px] font-semibold uppercase tracking-wide leading-none opacity-60 ${theme.textBody}`}>{label}</label>
            <span className={`text-sm font-bold leading-none tabular-nums ${theme.textHead}`}>{value}{unit}</span>
          </>
        ) : stepper ? (
          <>
            <label className={`text-sm font-semibold ${theme.textHead}`}>{label}</label>
            {/* a slider is quick but coarse under a finger: these get the figure exactly right */}
            <div className="flex items-center gap-2">
              <button type="button" className={stepClass} aria-label={`One fewer ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
                <Minus className="w-4 h-4" />
              </button>
              <span className={`w-12 text-center text-base font-bold tabular-nums ${theme.textHead}`}>{value}{unit}</span>
              <button type="button" className={stepClass} aria-label={`One more ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <label className={`text-sm font-semibold ${theme.textHead}`}>{label}</label>
            <span className={`text-sm font-semibold ${theme.textBody}`}>{value}{unit}</span>
          </>
        )}
      </div>
      {/* ...and the slider is given the height of a button, so it lines up with the buttons beside it */}
      <div className={compact ? "h-7 flex items-center" : "contents"}>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-2 rounded-lg appearance-none cursor-pointer pressable ${theme.cellHidden}
                   accent-red-500 focus:outline-none focus:ring-2 ${focusClass}`}
      />
      </div>
    </div>
  )
}

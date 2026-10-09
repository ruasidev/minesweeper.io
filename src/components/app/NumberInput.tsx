import { useTheme } from "../../context/ThemeContext";
import type { NumberInputProps } from "../../game/types";

export default function NumberInput({ label, value, min = 1, max = 99, unit = "", compact, onChange }: NumberInputProps) {
  const { theme } = useTheme()
  const focusClass = `focus:${theme.itemSelectedBorder}`
  return (
    <div className={`flex flex-col ${compact ? "gap-1 w-28" : "gap-2"}`}>
      {/* in a bar the caption line is as tall as any other caption there, so they all sit on one line */}
      <div className={`flex justify-between items-center ${compact ? "h-2.5" : ""}`}>
        {compact ? (
          <>
            <label className={`text-[10px] font-semibold uppercase tracking-wide leading-none opacity-60 ${theme.textBody}`}>{label}</label>
            <span className={`text-sm font-bold leading-none tabular-nums ${theme.textHead}`}>{value}{unit}</span>
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
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-2 rounded-lg appearance-none cursor-pointer pressable ${theme.cellHidden}
                   accent-red-500 focus:outline-none focus:ring-2 ${focusClass}`}
      />
      </div>
    </div>
  )
}

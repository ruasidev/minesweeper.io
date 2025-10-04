import { useTheme } from "../../context/ThemeContext";
import type { NumberInputProps } from "../../game/types";

export default function NumberInput({ label, value, onChange }: NumberInputProps) {
  const { theme } = useTheme()
  const focusClass = `focus:${theme.itemSelectedBorder}`
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <label className={`text-sm font-semibold ${theme.textHead}`}>{label}</label>
        <span className={`text-sm font-semibold ${theme.textBody}`}>{value}</span>
      </div>
      <input
        type="range"
        value={value}
        min={1}
        max={99}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-2 rounded-lg appearance-none cursor-pointer pressable ${theme.cellHidden}
                   accent-red-500 focus:outline-none focus:ring-2 ${focusClass}`}
      />
    </div>
  )
}

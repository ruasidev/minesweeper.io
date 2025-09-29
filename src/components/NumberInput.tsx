import type { NumberInputProps } from "../game/types";

export function NumberInput({ label, value, theme, onChange }: NumberInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <label className={`text-sm font-medium ${theme.textHead}`}>{label}</label>
        <span className={`text-sm ${theme.textBody}`}>{value}</span>
      </div>
      <input
        type="range"
        value={value}
        min={1}
        max={99}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none bg-gray-700 cursor-pointer
                   accent-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
      />
    </div>
  )
}

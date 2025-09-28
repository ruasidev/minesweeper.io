import type { NumberInputProps } from "../game/types";

export function NumberInput({ label, value, onChange }: NumberInputProps) {
    return (
        <label className="flex flex-col text-sm">
            {label}
            <input 
                type="number" 
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="border p-1 w-20"
            />
        </label>
    )
} 
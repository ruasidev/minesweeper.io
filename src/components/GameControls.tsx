import type { GameControlsProps } from "../game/types"
import { NumberInput } from "./NumberInput"
import { ResetGameButton } from "./ResetGameButton"

// Holds sliders and buttons for changing the board state
export default function GameControls({
  rows, cols, mines, theme,
  onRowsChange, onColsChange, onMinesChange, onReset
}: GameControlsProps) {
  return (
    <div
      className={`border rounded-md flex gap-4 p-2
        shadow-lg shadow-black/40 ring-1 ring-white/10 cursor-default
        ${theme.menuBg}
        ${theme.menuBorder}
      `}
    >
      <NumberInput label="rows" value={rows} onChange={onRowsChange} theme={theme} />
      <NumberInput label="cols" value={cols} onChange={onColsChange} theme={theme} />
      <NumberInput label="mines" value={mines} onChange={onMinesChange} theme={theme} />
      <ResetGameButton onReset={onReset} theme={theme} />
    </div>
  )
}

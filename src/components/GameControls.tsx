import type { GameControlsProps } from "../game/types"
import { NumberInput } from "./NumberInput"
import { ResetGameButton } from "./ResetGameButton"

// Holds sliders and buttons for changing the board state
export default function GameControls({
    rows, cols, mines,
    onRowsChange, onColsChange, onMinesChange, onReset
}: GameControlsProps) {
    return (
        <div className="border rounded-sm flex gap-4 p-2">
            <NumberInput label="rows" value={rows} onChange={onRowsChange} />
            <NumberInput label="cols" value={cols} onChange={onColsChange} />
            <NumberInput label="mines" value={mines} onChange={onMinesChange} />
            <ResetGameButton onReset={onReset} />
        </div>
    )
}
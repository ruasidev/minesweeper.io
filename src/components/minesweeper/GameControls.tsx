import { useMinesweeperGameContext } from "../../context/MinesweeperGameContext"
import { useTheme } from "../../context/ThemeContext"
import { NumberInput } from "../app/NumberInput"
import { ResetGameButton } from "./infoDisplay/ResetGameButton"

// Holds sliders and buttons for changing the board state
export default function GameControls() {
  const { theme } = useTheme()
  const { rows, cols, mines, setRows, setCols, setMines } = useMinesweeperGameContext()
  return (
    <div
      className={`border rounded-md flex gap-4 p-2
        shadow-lg shadow-black/40 ring-1 ring-white/10 cursor-default
        ${theme.menuBg}
        ${theme.menuBorder}
      `}
    >
      <NumberInput label="rows" value={rows} onChange={setRows} />
      <NumberInput label="cols" value={cols} onChange={setCols} />
      <NumberInput label="mines" value={mines} onChange={setMines} />
      <ResetGameButton />
    </div>
  )
}

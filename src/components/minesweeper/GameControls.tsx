import { useMinesweeperGameContext } from "../../context/MinesweeperGameContext"
import { useTheme } from "../../context/ThemeContext"
import { itemColors } from "../../game/themes"
import { MIN_BOARD_SIZE } from "../../game/board"
import { BOARD_PRESETS } from "../../../shared/protocol"
import { SlidersHorizontal } from "lucide-react"
import NumberInput from "../app/NumberInput"
import GameBar, { BarField } from "./GameBar"

// The board's settings: the classic boards to pick from, and the sliders for making the board any other size.
// It is made of the same bar as the status bar (GameStatusBar), which is the one with only figures to read
export default function GameControls() {
  const { theme } = useTheme()
  const { rows, cols, mines, maxMines, setRows, setCols, setMines } = useMinesweeperGameContext()
  return (
    <GameBar icon={<SlidersHorizontal className="w-4 h-4" />} label="Board">
      <BarField label="Preset">
      <div className="flex gap-2">
        {BOARD_PRESETS.map(({ id, label, settings }) => {
          const chosen = settings.rows === rows && settings.cols === cols && settings.mines === mines
          return (
            <button
              key={id}
              aria-pressed={chosen}
              title={`${settings.rows} × ${settings.cols}, ${settings.mines} mines`}
              className={`px-2 py-1 rounded-md border text-sm font-semibold pressable
                ${itemColors(theme, chosen)} ${theme.itemHoverBorder} ${theme.itemBorder}
                ${chosen ? "" : "opacity-60"}
              `}
              onClick={() => {
                setRows(settings.rows)
                setCols(settings.cols)
                setMines(settings.mines)
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
      </BarField>
      <NumberInput compact label="Rows" value={rows} min={MIN_BOARD_SIZE} onChange={setRows} />
      <NumberInput compact label="Cols" value={cols} min={MIN_BOARD_SIZE} onChange={setCols} />
      <NumberInput compact label="Mines" value={mines} max={Math.min(99, maxMines)} onChange={setMines} />
    </GameBar>
  )
}

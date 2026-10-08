import { useMinesweeperGameContext } from "../../context/MinesweeperGameContext"
import { useTheme } from "../../context/ThemeContext"
import { MIN_BOARD_SIZE } from "../../game/board"
import { BOARD_PRESETS } from "../../../shared/protocol"
import NumberInput from "../app/NumberInput"

// Holds the classic boards to pick from, and the sliders for making the board any other size
export default function GameControls() {
  const { theme } = useTheme()
  const { rows, cols, mines, maxMines, setRows, setCols, setMines } = useMinesweeperGameContext()
  return (
    <div
      className={`border rounded-md flex flex-wrap items-center gap-4 p-2
        shadow-lg shadow-black/40 ring-1 ring-white/10 cursor-default
        ${theme.menuBg}
        ${theme.menuBorder}
      `}
    >
      <div className="flex gap-2">
        {BOARD_PRESETS.map(({ id, label, settings }) => {
          const chosen = settings.rows === rows && settings.cols === cols && settings.mines === mines
          return (
            <button
              key={id}
              aria-pressed={chosen}
              title={`${settings.rows} × ${settings.cols}, ${settings.mines} mines`}
              className={`px-2 py-1 rounded-md border text-sm font-semibold pressable
                ${theme.itemBg} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.itemBorder} ${theme.textBody}
                ${chosen ? `ring-2 ${theme.itemSelectedBorder}` : "opacity-60"}
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
      <NumberInput label="rows" value={rows} min={MIN_BOARD_SIZE} onChange={setRows} />
      <NumberInput label="cols" value={cols} min={MIN_BOARD_SIZE} onChange={setCols} />
      <NumberInput label="mines" value={mines} max={Math.min(99, maxMines)} onChange={setMines} />
    </div>
  )
}

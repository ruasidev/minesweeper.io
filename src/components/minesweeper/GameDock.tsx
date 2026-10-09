import { useState } from "react"
import { RotateCcw, SlidersHorizontal } from "lucide-react"
import { useMinesweeperGameContext } from "../../context/MinesweeperGameContext"
import { MIN_BOARD_SIZE } from "../../game/board"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useLayout } from "../../hooks/useLayout"
import { BOARD_PRESETS } from "../../../shared/protocol"
import FloatingWindow from "../app/FloatingWindow"
import NumberInput from "../app/NumberInput"
import Dock, { DockButton, FlagToggle } from "./Dock"

// Any size of board, set with a finger: opened from the dock, since there is no room on a phone to keep the
// sliders on show the way a desktop does
function CustomBoard({ onClose }: { onClose: () => void }) {
  const styles = useFormStyles()
  const { rows, cols, mines, maxMines, setRows, setCols, setMines } = useMinesweeperGameContext()
  return (
    <FloatingWindow title="Custom board" onClose={onClose} sheet className="w-[min(26rem,94vw)]">
      <div className="flex flex-col gap-5">
        <NumberInput stepper label="Rows" value={rows} min={MIN_BOARD_SIZE} onChange={setRows} />
        <NumberInput stepper label="Columns" value={cols} min={MIN_BOARD_SIZE} onChange={setCols} />
        <NumberInput stepper label="Mines" value={mines} max={Math.min(99, maxMines)} onChange={setMines} />
        <button className={`${styles.primary} mt-1`} onClick={onClose}>Done</button>
      </div>
    </FloatingWindow>
  )
}

// What goes under the singleplayer board, which changes with the game:
// - before the first move, the board to play: the classic ones a press away, and any other size behind the last button
// - while playing, the switch between digging and flagging, on a touch screen
// - once it is over, the way to the next game
// On a phone or a tablet it is as wide as its space and keeps the same height through all three, so the board
// never moves under a finger. On a desktop it floats along the bottom, no wider than it needs to be, and is simply
// away while a game is being played: a mouse has a button for each thing and nothing to switch
export default function GameDock() {
  const { board, rows, cols, mines, setRows, setCols, setMines, resetGame } = useMinesweeperGameContext()
  const { compact, touch } = useLayout()
  const [customOpen, setCustomOpen] = useState(false)
  // where it isn't given the width of its space, the buttons share out a width of its own
  const width = compact ? "" : "w-[26rem] max-w-full"

  if (board.status === "uninitialized") {
    const preset = BOARD_PRESETS.find(({ settings }) => settings.rows === rows && settings.cols === cols && settings.mines === mines)
    return (
      <Dock className={width}>
        {BOARD_PRESETS.map(({ id, label, settings }) => (
          <DockButton
            key={id}
            selected={preset?.id === id}
            title={`${settings.rows} × ${settings.cols}, ${settings.mines} mines`}
            onClick={() => {
              setRows(settings.rows)
              setCols(settings.cols)
              setMines(settings.mines)
            }}
          >
            {label}
          </DockButton>
        ))}
        <DockButton square selected={!preset} title="Custom board" aria-label="Custom board" onClick={() => setCustomOpen(true)}>
          <SlidersHorizontal className="w-4 h-4" />
        </DockButton>
        {customOpen && <CustomBoard onClose={() => setCustomOpen(false)} />}
      </Dock>
    )
  }

  if (board.status === "playing") {
    if (!compact && !touch) return null
    return (
      <Dock className={width}>
        {touch ? <FlagToggle /> : (
          // with a mouse there is nothing to switch: its buttons do one each
          <p className="flex-1 flex items-center justify-center h-11 px-2 text-sm text-center opacity-70 cursor-default">Left click uncovers · right click flags</p>
        )}
      </Dock>
    )
  }

  return (
    <Dock className={compact ? "" : "w-56 max-w-full"}>
      <DockButton primary onClick={resetGame}>
        <RotateCcw className="w-4 h-4" />
        New game
      </DockButton>
    </Dock>
  )
}

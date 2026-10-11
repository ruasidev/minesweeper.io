import { useState } from "react"
import { Dices, RotateCcw, SlidersHorizontal } from "lucide-react"
import { useSoloGameContext } from "../../context/SoloGameContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useLayout } from "../../hooks/useLayout"
import { BOARD_SIZE_MIN } from "../../../shared/engine/generate"
import { BOARD_PRESETS, boardSize, presetOf } from "../../../shared/game/boards"
import { CHANCE_SOLO_MODE, DEFAULT_SOLO_MODE, rulesOf } from "../../../shared/game/modes"
import FloatingWindow from "../app/FloatingWindow"
import NumberInput from "../app/NumberInput"
import Switch from "../app/Switch"
import Dock, { DockButton, FlagToggle } from "./Dock"

// What the board is to be, beyond the three everyone knows: any size, and whether it may need a guess. Opened from
// the dock, where the board is chosen, since these are part of that choice and not something to look for in the
// app's settings; and kept in a window, since there is no room on a phone to have it all on show
function BoardOptions({ onClose }: { onClose: () => void }) {
  const styles = useFormStyles()
  const { settings, maxMines, chooseBoard, mode, chooseMode } = useSoloGameContext()
  const guessFree = rulesOf(mode).guessFree
  return (
    <FloatingWindow title="Board options" onClose={onClose} sheet className="w-[min(26rem,94vw)]">
      <div className="flex flex-col gap-5">
        <NumberInput stepper label="Rows" value={settings.rows} min={BOARD_SIZE_MIN} onChange={rows => chooseBoard({ ...settings, rows })} />
        <NumberInput stepper label="Columns" value={settings.cols} min={BOARD_SIZE_MIN} onChange={cols => chooseBoard({ ...settings, cols })} />
        <NumberInput stepper label="Mines" value={settings.mines} max={maxMines} onChange={mines => chooseBoard({ ...settings, mines })} />
        <Switch label="No guessing" checked={guessFree} onChange={on => chooseMode(on ? DEFAULT_SOLO_MODE : CHANCE_SOLO_MODE)}>
          {/* as long as each other, so that nothing in the window moves when it is switched */}
          {guessFree
            ? "Every board can be cleared by reasoning alone: you will never have to guess."
            : "Classic Minesweeper: the mines fall at random, and some boards will need a guess."}
        </Switch>
        <button className={`${styles.primary} mt-1`} onClick={onClose}>Done</button>
      </div>
    </FloatingWindow>
  )
}

// What goes under the singleplayer board, which changes with the game:
// - before the first move, the board to play: the classic ones a press away, and everything else about it (any
//   other size, whether it may need a guess) behind the last button
// - while playing, the switch between digging and flagging, on a touch screen
// - once it is over, the way to the next game
// On a phone or a tablet it is as wide as its space and keeps the same height through all three, so the board
// never moves under a finger. On a desktop it floats along the bottom, no wider than it needs to be, and is simply
// away while a game is being played: a mouse has a button for each thing and nothing to switch
export default function GameDock() {
  const { view, settings, chooseBoard, mode, reset } = useSoloGameContext()
  const { compact, touch } = useLayout()
  const [optionsOpen, setOptionsOpen] = useState(false)
  // where it isn't given the width of its space, the buttons share out a width of its own
  const width = compact ? "" : "w-[26rem] max-w-full"

  if (view.status === "ready") {
    const chosen = presetOf(settings)
    const guessFree = rulesOf(mode).guessFree
    const options = guessFree ? "Board options" : "Board options (boards may need a guess)"
    return (
      <Dock className={width}>
        {BOARD_PRESETS.map(preset => (
          <DockButton key={preset.id} selected={chosen?.id === preset.id} title={boardSize(preset.settings)} onClick={() => chooseBoard(preset.settings)}>
            {preset.label}
          </DockButton>
        ))}
        {/* Dice on it while boards are laid by chance: the one thing behind this button that can't be seen from
            the board itself, and worth knowing before a game is begun */}
        <DockButton square selected={!chosen} title={options} aria-label={options} onClick={() => setOptionsOpen(true)}>
          {guessFree ? <SlidersHorizontal className="w-4 h-4" /> : <Dices className="w-4 h-4" />}
        </DockButton>
        {optionsOpen && <BoardOptions onClose={() => setOptionsOpen(false)} />}
      </Dock>
    )
  }

  if (view.status === "playing") {
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
      <DockButton primary onClick={reset}>
        <RotateCcw className="w-4 h-4" />
        New game
      </DockButton>
    </Dock>
  )
}

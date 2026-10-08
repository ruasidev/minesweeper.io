import { useState } from "react"
import { Lock } from "lucide-react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import type { Multiplayer } from "../../hooks/useMultiplayer"
import { avatarSrc } from "../../lib/avatar"
import { getMaxMines, MIN_BOARD_SIZE } from "../../../shared/board"
import { BOARD_PRESETS, BOARD_SIZE_MAX, MINES_MAX, type BoardSettings, type RoomDetail } from "../../../shared/protocol"
import PlayerName from "../account/PlayerName"
import NumberInput from "../app/NumberInput"
import SidebarSectionHeader from "../menu/SidebarSectionHeader"

const describe = ({ rows, cols, mines }: BoardSettings) => `${rows} × ${cols} · ${mines} ${mines === 1 ? "mine" : "mines"}`

// The room this player is in, between games: the room itself across the top, then the game being set up
// (the host's to choose, everyone else's to see) beside the list of who is here
export default function RoomView({ room, multiplayer }: { room: RoomDetail, multiplayer: Multiplayer }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { session } = useAccount()
  const isHost = room.hostId === session?.user.id
  const { rows, cols, mines } = room.settings
  const maxMines = Math.min(MINES_MAX, getMaxMines(rows, cols))

  // The mode is whichever classic board the settings match, or Custom.
  // The host can also sit on Custom with the sliders still matching a classic board
  const [customChosen, setCustomChosen] = useState(false)
  const matchingPreset = BOARD_PRESETS.find(preset =>
    preset.settings.rows === rows && preset.settings.cols === cols && preset.settings.mines === mines)
  const mode = isHost && customChosen ? "custom" : matchingPreset?.id ?? "custom"

  function changeSettings(change: Partial<BoardSettings>) {
    const next = { ...room.settings, ...change }
    // a smaller board may not fit as many mines
    next.mines = Math.min(next.mines, MINES_MAX, getMaxMines(next.rows, next.cols))
    multiplayer.setSettings(next)
  }

  // the small buttons the host gets beside each other player
  const hostButtonClass = `px-2 py-1 rounded border text-xs font-semibold pressable
    ${theme.itemBg} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.itemBorder} ${theme.textBody}`

  // One of the modes to pick from. Only the host can pick; everyone else just sees which one is chosen
  const modeButton = (id: string, label: string, detail: string, onPick: () => void) => (
    <button
      key={id}
      aria-pressed={mode === id}
      disabled={!isHost}
      className={`${styles.option(mode === id)} flex flex-col items-center gap-0.5 ${isHost ? "" : "pointer-events-none"}`}
      onClick={onPick}
    >
      <span>{label}</span>
      <span className="text-xs font-normal opacity-80">{detail}</span>
    </button>
  )

  return (
    <>
      <section className={`${styles.card} flex items-center gap-3 p-4`}>
        <h2 className={`min-w-0 text-xl font-semibold truncate cursor-default ${theme.textHead}`}>{room.name}</h2>
        <span className={`${styles.tag} inline-flex items-center gap-1`}>
          {room.visibility === "private" && <Lock className="w-3 h-3" />}
          {room.visibility}
        </span>
        <button className={`${styles.button} ml-auto`} onClick={multiplayer.leaveRoom}>Leave room</button>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <section className={`${styles.card} flex flex-col gap-4 p-4 flex-1 min-w-80 max-w-2xl`}>
          <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Game</h2>

          <div>
            <SidebarSectionHeader text="Mode" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {BOARD_PRESETS.map(preset => modeButton(preset.id, preset.label, describe(preset.settings), () => {
                setCustomChosen(false)
                multiplayer.setSettings(preset.settings)
              }))}
              {modeButton("custom", "Custom", mode === "custom" ? describe(room.settings) : "Your own board", () => setCustomChosen(true))}
            </div>
          </div>

          {isHost && mode === "custom" && (
            <div className="grid grid-cols-3 gap-4">
              <NumberInput label="rows" value={rows} min={MIN_BOARD_SIZE} max={BOARD_SIZE_MAX} onChange={rows => changeSettings({ rows })} />
              <NumberInput label="cols" value={cols} min={MIN_BOARD_SIZE} max={BOARD_SIZE_MAX} onChange={cols => changeSettings({ cols })} />
              <NumberInput label="mines" value={mines} max={maxMines} onChange={mines => changeSettings({ mines })} />
            </div>
          )}

          <div className={`flex items-center gap-4 pt-4 border-t ${theme.menuBorder}`}>
            <span className={`cursor-default ${theme.textBody}`}>
              {isHost ? "Everyone plays the same board." : "Waiting for the host to start the game."}
            </span>
            {isHost && <button className={`${styles.button} ml-auto px-6`} onClick={multiplayer.startGame}>Start game</button>}
          </div>
        </section>

        <section className={`${styles.card} flex flex-col gap-4 p-4 w-full max-w-xs`}>
          <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Players ({room.players.length})</h2>
          <div className="flex flex-col gap-2">
            {room.players.map(player => (
              <div key={player.id} className={`flex items-center gap-3 ${theme.textBody}`}>
                <img
                  src={avatarSrc(player.image)}
                  alt=""
                  referrerPolicy="no-referrer"
                  className={`w-8 h-8 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
                />
                <PlayerName playerId={player.id} username={player.username} className="min-w-0 truncate" />
                {player.id === room.hostId && <span className={styles.tag}>Host</span>}
                {player.id === session?.user.id && <span className={styles.tag}>You</span>}
                {isHost && player.id !== room.hostId && (
                  <div className="ml-auto shrink-0 flex gap-2">
                    <button className={hostButtonClass} onClick={() => multiplayer.makeHost(player.id)}>Make host</button>
                    <button className={hostButtonClass} title="Remove from the room" onClick={() => multiplayer.kick(player.id)}>Kick</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

    </>
  )
}

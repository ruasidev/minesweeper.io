import { useState } from "react"
import { Lock } from "lucide-react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useLayout } from "../../hooks/useLayout"
import type { Multiplayer } from "../../hooks/useMultiplayer"
import { avatarSrc } from "../../lib/avatar"
import { getMaxMines, MIN_BOARD_SIZE } from "../../../shared/board"
import { BOARD_PRESETS, BOARD_SIZE_MAX, MINES_MAX, type BoardSettings, type RoomDetail } from "../../../shared/protocol"
import PlayerName from "../account/PlayerName"
import NumberInput from "../app/NumberInput"
import SidebarSectionHeader from "../menu/SidebarSectionHeader"

const describe = ({ rows, cols, mines }: BoardSettings) => `${rows} × ${cols} · ${mines} ${mines === 1 ? "mine" : "mines"}`

type RoomViewProps = {
  room: RoomDetail
  multiplayer: Multiplayer
  // back to the results of the room's game, for a player who took part in it
  onViewResults?: () => void
}

// The room this player is in: the room itself across the top, then the game being set up (the host's to choose,
// everyone else's to see) beside the list of who is here. A player whose own game is over can come back here
// while the others are still playing; nothing can be set up or started until they are done
export default function RoomView({ room, multiplayer, onViewResults }: RoomViewProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { session } = useAccount()
  const { touch } = useLayout()
  const isHost = room.hostId === session?.user.id
  const game = room.game
  const gameOn = game !== null && !game.over
  const stillPlaying = game ? Object.values(game.progress).filter(progress => progress.outcome === "playing").length : 0
  // the host sets up the next game, once the last one is over
  const canSetUp = isHost && !gameOn
  const { rows, cols, mines } = room.settings
  const maxMines = Math.min(MINES_MAX, getMaxMines(rows, cols))

  // The mode is whichever classic board the settings match, or Custom.
  // The host can also sit on Custom with the sliders still matching a classic board
  const [customChosen, setCustomChosen] = useState(false)
  const matchingPreset = BOARD_PRESETS.find(preset =>
    preset.settings.rows === rows && preset.settings.cols === cols && preset.settings.mines === mines)
  const mode = canSetUp && customChosen ? "custom" : matchingPreset?.id ?? "custom"

  function changeSettings(change: Partial<BoardSettings>) {
    const next = { ...room.settings, ...change }
    // a smaller board may not fit as many mines
    next.mines = Math.min(next.mines, MINES_MAX, getMaxMines(next.rows, next.cols))
    multiplayer.setSettings(next)
  }

  // the small buttons the host gets beside each other player
  const hostButtonClass = styles.ghostSmall

  // One of the modes to pick from. Only the host can pick; everyone else just sees which one is chosen
  const modeButton = (id: string, label: string, detail: string, onPick: () => void) => (
    <button
      key={id}
      aria-pressed={mode === id}
      disabled={!canSetUp}
      className={`${styles.option(mode === id)} flex flex-col items-center gap-0.5 ${canSetUp ? "" : "pointer-events-none"}`}
      onClick={onPick}
    >
      <span>{label}</span>
      <span className="text-xs font-normal opacity-80">{detail}</span>
    </button>
  )

  return (
    <>
      <section className={`${styles.card} flex flex-wrap items-center gap-x-3 gap-y-2 p-4`}>
        <h2 className={`min-w-0 text-xl font-semibold truncate cursor-default ${theme.textHead}`}>{room.name}</h2>
        <span className={`${styles.tag} inline-flex items-center gap-1`}>
          {room.visibility === "private" && <Lock className="w-3 h-3" />}
          {room.visibility}
        </span>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {onViewResults && <button className={styles.ghost} onClick={onViewResults}>{gameOn ? "Results so far" : "Last game's results"}</button>}
          <button className={styles.ghost} onClick={multiplayer.leaveRoom}>Leave room</button>
        </div>
      </section>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_22rem] items-start gap-3 sm:gap-4">
        <section className={`${styles.card} flex flex-col gap-4 p-4 min-w-0`}>
          <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Game</h2>

          <div>
            <SidebarSectionHeader text="Mode" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              {BOARD_PRESETS.map(preset => modeButton(preset.id, preset.label, describe(preset.settings), () => {
                setCustomChosen(false)
                multiplayer.setSettings(preset.settings)
              }))}
              {modeButton("custom", "Custom", mode === "custom" ? describe(room.settings) : "Your own board", () => setCustomChosen(true))}
            </div>
          </div>

          {canSetUp && mode === "custom" && (
            // three side by side where there is a mouse to work them with; one under the other, with buttons to step
            // them exactly, where it is a finger
            <div className={`grid gap-4 ${touch ? "max-w-md" : "grid-cols-3"}`}>
              <NumberInput stepper={touch} label="rows" value={rows} min={MIN_BOARD_SIZE} max={BOARD_SIZE_MAX} onChange={rows => changeSettings({ rows })} />
              <NumberInput stepper={touch} label="cols" value={cols} min={MIN_BOARD_SIZE} max={BOARD_SIZE_MAX} onChange={cols => changeSettings({ cols })} />
              <NumberInput stepper={touch} label="mines" value={mines} max={maxMines} onChange={mines => changeSettings({ mines })} />
            </div>
          )}

          <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 pt-4 border-t ${theme.menuBorder}`}>
            <span className={`flex-1 min-w-48 cursor-default ${theme.textBody}`}>
              {gameOn ? `A game is being played: ${stillPlaying} still playing. The next one can start when they are done.`
                : isHost ? "Everyone plays the same board."
                : "Waiting for the host to start the game."}
            </span>
            {isHost && <button className={`${styles.primary} ml-auto px-6! max-sm:w-full`} disabled={gameOn} onClick={multiplayer.startGame}>Start game</button>}
          </div>
        </section>

        <section className={`${styles.card} flex flex-col gap-4 p-4 min-w-0`}>
          <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Players ({room.players.length})</h2>
          <div className="flex flex-col gap-3">
            {room.players.map(player => (
              // the host's buttons drop onto a line of their own when the name and its labels leave no room for them
              <div key={player.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${theme.textBody}`}>
                <img
                  src={avatarSrc(player.image)}
                  alt=""
                  referrerPolicy="no-referrer"
                  className={`w-8 h-8 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
                />
                <PlayerName playerId={player.id} username={player.username} className="min-w-0 max-w-40 truncate" />
                {player.id === room.hostId && <span className={styles.tag}>Host</span>}
                {player.id === session?.user.id && <span className={styles.tag}>You</span>}
                {gameOn && game.progress[player.id]?.outcome === "playing" && (
                  <span className={`${styles.tag} inline-flex items-center gap-1`} title="Still playing the game">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Playing
                  </span>
                )}
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

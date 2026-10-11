import { useState, type FormEvent } from "react"
import { Lock, Plus } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import type { ServerConnection } from "../../hooks/useServerConnection"
import { plural } from "../../lib/text"

// Every room there is. Private ones are listed too, and ask for their passcode before letting anyone in.
// `onCreate` is given where the form for a new room isn't on the page beside the list: the list then gets a
// button that brings it up
export default function RoomList({ connection, onCreate }: { connection: ServerConnection, onCreate?: () => void }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  // the private room whose passcode is being asked for, and what has been typed
  const [unlockingId, setUnlockingId] = useState<string | null>(null)
  const [passcode, setPasscode] = useState("")
  // the room last asked to join, which is where a refusal is shown
  const [attemptedId, setAttemptedId] = useState<string | null>(null)
  const error = connection.error?.action === "joinRoom" ? connection.error.message : null

  function join(roomId: string, withPasscode?: string) {
    setAttemptedId(roomId)
    connection.joinRoom(roomId, withPasscode)
  }

  function unlock(e: FormEvent) {
    e.preventDefault()
    if (unlockingId) join(unlockingId, passcode)
  }

  return (
    <section className={`${styles.card} flex-1 min-w-0 sm:min-w-80 overflow-hidden`}>
      <div className="flex items-center gap-4 p-4">
        <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Rooms</h2>
        <span className={`text-sm opacity-70 cursor-default ${theme.textBody}`}>
          {connection.rooms.length} open
        </span>
        {onCreate && (
          <button className={`${styles.primary} ml-auto inline-flex items-center gap-1.5 py-2! text-sm`} disabled={connection.status !== "connected"} onClick={onCreate}>
            <Plus className="w-4 h-4" />
            Create
          </button>
        )}
      </div>

      {connection.rooms.length === 0 && (
        <p className={`px-4 pb-4 opacity-70 cursor-default ${theme.textBody}`}>No rooms yet. Create one and it shows up here for everyone.</p>
      )}

      {connection.rooms.map(room => (
        <div key={room.id} className={`flex flex-col gap-2 px-4 py-3 border-t ${theme.itemBorder} ${theme.textBody}`}>
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0 cursor-default">
              <div className="flex items-center gap-2 font-semibold">
                {room.visibility === "private" && <Lock className="w-4 h-4 shrink-0" aria-label="Private" />}
                <span className="truncate">{room.name}</span>
              </div>
              <div className="text-sm opacity-70 truncate">
                Hosted by @{room.hostUsername} · {plural(room.playerCount, "player")}
                {room.inGame && " · game in progress"}
              </div>
            </div>
            {unlockingId !== room.id && !room.inGame && (
              <button
                className={styles.button}
                onClick={() => {
                  if (room.visibility === "public") return join(room.id)
                  setUnlockingId(room.id)
                  setPasscode("")
                }}
              >
                Join
              </button>
            )}
          </div>

          {unlockingId === room.id && (
            <form className="flex flex-wrap gap-2" onSubmit={unlock}>
              <input
                className={`${styles.input} flex-1 min-w-40 w-auto!`}
                placeholder="Passcode"
                autoComplete="off"
                autoFocus
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
              />
              <button type="submit" className={styles.button}>Join</button>
              <button type="button" className={styles.ghost} onClick={() => setUnlockingId(null)}>Cancel</button>
            </form>
          )}
          {error && attemptedId === room.id && <p role="alert" className="text-sm text-red-500 font-semibold">{error}</p>}
        </div>
      ))}
    </section>
  )
}

import { Lock, Plus } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import type { AuthMode } from "../../game/types"
import { useLayout } from "../../hooks/useLayout"
import { useOpenRooms } from "../../hooks/useOpenRooms"
import { rememberRoomToJoin } from "../../lib/roomIntent"
import { plural } from "../../lib/text"
import type { RoomSummary } from "../../../shared/protocol"

// What a visitor who isn't signed in sees on the multiplayer page: the rooms that are open right now, just as a
// player sees them, with the same ways in. Nothing is asked of them until they try one: joining a room or opening
// one brings up the window to sign up in, and the room they were after is remembered, so that they come out of it
// in that room and not back at the list. What multiplayer is, and that it takes an account, is said underneath
export default function SignedOutMultiplayer({ onOpenAuth }: { onOpenAuth: (mode: AuthMode) => void }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { mode } = useLayout()
  const rooms = useOpenRooms()

  function join(room: RoomSummary) {
    // a private room wants its passcode, which is asked for once they are in
    if (room.visibility === "public") rememberRoomToJoin(room.id)
    onOpenAuth("signUp")
  }

  return (
    <div className={`flex flex-col w-full max-w-2xl ${mode === "phone" ? "gap-3" : "gap-4"}`}>
      <section className={`${styles.card} overflow-hidden cursor-default`}>
        {/* headed as the list a player sees is, so that signing in changes what can be done and not what is there */}
        <div className="flex items-center gap-4 p-4">
          <h2 className={`text-xl font-semibold ${theme.textHead}`}>Rooms</h2>
          {rooms && <span className={`text-sm opacity-70 whitespace-nowrap ${theme.textBody}`}>{rooms.length} open</span>}
          <button className={`${styles.primary} ml-auto inline-flex items-center gap-1.5 py-2! text-sm whitespace-nowrap`} onClick={() => onOpenAuth("signUp")}>
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
        {!rooms && <p className={`px-4 pb-4 opacity-70 ${theme.textBody}`}>Looking for rooms…</p>}
        {rooms?.length === 0 && <p className={`px-4 pb-4 opacity-70 ${theme.textBody}`}>No rooms at the moment. Open the first one.</p>}
        {rooms?.map(room => (
          <div key={room.id} className={`flex items-center gap-3 px-4 py-3 border-t ${theme.itemBorder} ${theme.textBody}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 font-semibold">
                {room.visibility === "private" && <Lock className="w-4 h-4 shrink-0" aria-label="Private" />}
                <span className="truncate">{room.name}</span>
              </div>
              <div className="text-sm opacity-70 truncate">
                Hosted by @{room.hostUsername} · {plural(room.playerCount, "player")}
                {room.inGame && " · game in progress"}
              </div>
            </div>
            <button className={styles.button} aria-label={`Join ${room.name}`} onClick={() => join(room)}>Join</button>
          </div>
        ))}
      </section>

      <section className={`${styles.card} flex flex-col gap-3 p-4 cursor-default ${theme.textBody}`}>
        <h2 className={`text-xl font-semibold ${theme.textHead}`}>Race other players on the same board</h2>
        <ul className="flex flex-col gap-1 list-disc pl-5">
          <li>Everyone starts from the same board, with the same first patch already open.</li>
          <li>Watch how far everyone else has got while you play.</li>
          <li>Open a room for anyone, or a private one with a passcode.</li>
        </ul>
        <p className="text-sm opacity-70">Playing with others takes an account, so that everyone in a room is somebody. It is free, and takes a moment.</p>
        <div className="flex flex-wrap gap-2">
          <button className={`${styles.primary} max-sm:flex-1`} onClick={() => onOpenAuth("signUp")}>Sign up</button>
          <button className={`${styles.ghost} max-sm:flex-1`} onClick={() => onOpenAuth("signIn")}>Log in</button>
        </div>
      </section>
    </div>
  )
}

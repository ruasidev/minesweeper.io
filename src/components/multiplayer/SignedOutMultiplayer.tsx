import { useState } from "react"
import { Lock } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import type { AuthMode } from "../../game/types"
import { useOpenRooms } from "../../hooks/useOpenRooms"
import SignInForm from "../account/SignInForm"

// What a visitor who isn't signed in sees on the multiplayer page: what multiplayer is, the rooms open right now,
// and the way in right there beside them, rather than a wall with a log in button on it
export default function SignedOutMultiplayer() {
  const { theme } = useTheme()
  const styles = useFormStyles()
  // most people arriving here don't have an account yet
  const [authMode, setAuthMode] = useState<AuthMode>("signUp")
  const rooms = useOpenRooms()

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex flex-col gap-4 flex-1 min-w-80 max-w-2xl">
        <section className={`${styles.card} flex flex-col gap-3 p-4 cursor-default ${theme.textBody}`}>
          <h2 className={`text-xl font-semibold ${theme.textHead}`}>Race other players on the same board</h2>
          <ul className="flex flex-col gap-1 list-disc pl-5">
            <li>Everyone starts from the same board, with the same first patch already open.</li>
            <li>Watch how far everyone else has got while you play.</li>
            <li>Open a room for anyone, or a private one with a passcode.</li>
          </ul>
        </section>

        {rooms && (
          <section className={`${styles.card} overflow-hidden cursor-default`}>
            <div className="flex items-center gap-4 p-4">
              <h2 className={`text-xl font-semibold ${theme.textHead}`}>Open right now</h2>
              <span className={`text-sm opacity-70 ${theme.textBody}`}>{rooms.length} {rooms.length === 1 ? "room" : "rooms"}</span>
            </div>
            {rooms.length === 0 && (
              <p className={`px-4 pb-4 opacity-70 ${theme.textBody}`}>No rooms at the moment. Sign up and open the first one.</p>
            )}
            {rooms.map(room => (
              <div key={room.id} className={`px-4 py-3 border-t ${theme.itemBorder} ${theme.textBody}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {room.visibility === "private" && <Lock className="w-4 h-4 shrink-0" aria-label="Private" />}
                  <span className="truncate">{room.name}</span>
                </div>
                <div className="text-sm opacity-70 truncate">
                  Hosted by @{room.hostUsername} · {room.playerCount} {room.playerCount === 1 ? "player" : "players"}
                  {room.inGame && " · game in progress"}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      <section className={`${styles.card} p-6 w-full max-w-sm`}>
        {/* signing in changes who is signed in, which swaps this whole page for the rooms */}
        <SignInForm
          mode={authMode}
          onModeChange={setAuthMode}
          onSignedIn={() => {}}
          titles={{ signUp: "Create an account to play", signIn: "Log in to play" }}
        />
      </section>
    </div>
  )
}

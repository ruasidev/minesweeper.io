import { useEffect, useState, type FormEvent } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import type { Multiplayer } from "../../hooks/useMultiplayer"
import { PASSCODE_MAX, PASSCODE_MIN, ROOM_NAME_MAX, type RoomVisibility } from "../../../shared/protocol"
import SidebarSectionHeader from "../menu/SidebarSectionHeader"

export default function CreateRoomForm({ multiplayer }: { multiplayer: Multiplayer }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { profile } = useAccount()
  const [name, setName] = useState("")
  const [visibility, setVisibility] = useState<RoomVisibility>("public")
  const [passcode, setPasscode] = useState("")
  const error = multiplayer.error?.action === "createRoom" ? multiplayer.error.message : null

  // A starting name, once the player's username is known and unless they have typed one already
  useEffect(() => {
    if (profile) setName(current => current || `${profile.username}'s room`)
  }, [profile])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    multiplayer.createRoom(name, visibility, visibility === "private" ? passcode : undefined)
  }

  return (
    <form className={`${styles.card} flex flex-col gap-4 p-4 w-full max-w-sm`} onSubmit={handleSubmit}>
      <h2 className={`text-xl font-semibold cursor-default ${theme.textHead}`}>Create a room</h2>

      <input
        className={styles.input}
        placeholder="Room name"
        maxLength={ROOM_NAME_MAX}
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />

      <div>
        <SidebarSectionHeader text="Who can join" />
        <div className="grid grid-cols-2 gap-4">
          <button type="button" aria-pressed={visibility === "public"} className={styles.option(visibility === "public")} onClick={() => setVisibility("public")}>Public</button>
          <button type="button" aria-pressed={visibility === "private"} className={styles.option(visibility === "private")} onClick={() => setVisibility("private")}>Private</button>
        </div>
        <p className={`mt-2 text-sm opacity-70 cursor-default ${theme.textBody}`}>
          {visibility === "public" ? "Anyone can join from the list of rooms." : "Shown in the list of rooms, but joining needs the passcode."}
        </p>
      </div>

      {visibility === "private" && (
        <input
          className={styles.input}
          placeholder={`Passcode (${PASSCODE_MIN}-${PASSCODE_MAX} characters)`}
          autoComplete="off"
          minLength={PASSCODE_MIN}
          maxLength={PASSCODE_MAX}
          value={passcode}
          onChange={e => setPasscode(e.target.value)}
          required
        />
      )}

      <button type="submit" className={styles.button} disabled={multiplayer.status !== "connected"}>Create room</button>
      {error && <p role="alert" className="text-sm text-red-500 font-semibold">{error}</p>}
    </form>
  )
}

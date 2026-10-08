import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { updateBio, updateUsername, uploadAvatar } from "../../lib/api"
import { authClient } from "../../lib/authClient"
import { avatarSrc, toAvatarImage } from "../../lib/avatar"
import { BIO_MAX } from "../../../shared/profile"
import Badges from "./Badges"
import EditableField from "./EditableField"
import LevelBar from "./LevelBar"
import ProfileStats from "./ProfileStats"

// The signed-in player's profile: who they are on the left, how they've played on the right.
// Stats are fetched again each time it is shown
export default function ProfileView({ onSignedOut }: { onSignedOut: () => void }) {
  const { theme } = useTheme()
  const { session, profile, setProfile, refreshProfile, refreshSession } = useAccount()
  const [error, setError] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    refreshProfile().then(() => setError(null), (e: Error) => setError(e.message))
  }, [refreshProfile])

  if (!session) return null
  const account = session.user

  async function changePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // cleared so picking the same file again is still noticed
    e.target.value = ""
    if (!file) return

    setPhotoBusy(true)
    setPhotoError(null)
    try {
      await uploadAvatar(await toAvatarImage(file))
      await refreshSession()
    } catch (e) {
      setPhotoError((e as Error).message)
    } finally {
      setPhotoBusy(false)
    }
  }

  // The display name is what the account itself is called; it doesn't have to be unique
  async function saveDisplayName(name: string) {
    if (name.length < 1 || name.length > 32) throw new Error("Display names are 1-32 characters")
    const { error } = await authClient.updateUser({ name })
    if (error) throw new Error(error.message || "Couldn't reach the server")
    await refreshSession()
  }

  async function saveUsername(username: string) {
    setProfile(await updateUsername(username))
  }

  async function saveBio(bio: string) {
    setProfile(await updateBio(bio))
  }

  const buttonClass = `px-3 py-2 rounded-md border pressable font-semibold disabled:opacity-50
    ${theme.itemBg} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.itemBorder} ${theme.textBody}`

  const detail = (label: string, value: ReactNode) => (
    <div className="flex flex-col gap-1 cursor-default">
      <span className={`text-xs font-semibold uppercase tracking-wide opacity-70 ${theme.textBody}`}>{label}</span>
      <span className={`truncate ${theme.textBody}`}>{value}</span>
    </div>
  )

  return (
    <div className="flex flex-wrap items-start gap-x-16 gap-y-8">
      <div className="flex flex-col gap-5 w-full max-w-sm">
        <div className="flex items-center gap-4">
          <img
            src={avatarSrc(account.image)}
            alt=""
            referrerPolicy="no-referrer"
            className={`w-20 h-20 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
          />
          <div className="flex flex-col items-start gap-1">
            <button className={buttonClass} disabled={photoBusy} onClick={() => photoInput.current?.click()}>
              {photoBusy ? "Uploading…" : "Change photo"}
            </button>
            {photoError && <p role="alert" className="text-sm text-red-500 font-semibold">{photoError}</p>}
          </div>
          <input ref={photoInput} type="file" accept="image/*" hidden onChange={changePhoto} />
        </div>

        {profile && <LevelBar xp={profile.xp} />}

        {profile && profile.badges.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className={`text-xs font-semibold uppercase tracking-wide opacity-70 cursor-default ${theme.textBody}`}>Badges</span>
            <Badges badges={profile.badges} />
          </div>
        )}

        <EditableField label="Display name" value={account.name} onSave={saveDisplayName} />
        {profile
          ? <EditableField label="Username" value={profile.username} prefix="@" onSave={saveUsername} />
          : detail("Username", "…")}
        {profile && (
          <EditableField label="Bio" value={profile.bio} emptyText="Nothing here yet" multiline maxLength={BIO_MAX} onSave={saveBio} />
        )}
        {detail("Email", account.email)}
        {profile && detail("Joined", new Date(profile.joinedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }))}
        {error && <p role="alert" className="text-sm text-red-500 font-semibold">{error}</p>}

        <button className={`${buttonClass} self-start`} onClick={() => authClient.signOut().then(onSignedOut)}>Sign out</button>
      </div>

      {profile && <ProfileStats {...profile} />}
    </div>
  )
}

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { useAccount } from "../../context/AccountContext"
import { useTheme } from "../../context/ThemeContext"
import { updateUsername, uploadAvatar } from "../../lib/api"
import { authClient } from "../../lib/authClient"
import { avatarSrc, toAvatarImage } from "../../lib/avatar"
import SidebarSectionHeader from "../menu/SidebarSectionHeader"
import EditableField from "./EditableField"

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`

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

  const boxClass = `p-3 rounded border cursor-default ${theme.itemBg} ${theme.itemBorder} ${theme.textBody}`
  const buttonClass = `px-3 py-2 rounded-md border pressable font-semibold disabled:opacity-50
    ${theme.itemBg} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.itemBorder} ${theme.textBody}`

  const detail = (label: string, value: ReactNode) => (
    <div className="flex flex-col gap-1 cursor-default">
      <span className={`text-xs font-semibold uppercase tracking-wide opacity-70 ${theme.textBody}`}>{label}</span>
      <span className={`truncate ${theme.textBody}`}>{value}</span>
    </div>
  )

  const stats = profile?.stats
  const winRate = stats && stats.gamesPlayed > 0 ? Math.round(stats.wins / stats.gamesPlayed * 100) : 0

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

        <EditableField label="Display name" value={account.name} onSave={saveDisplayName} />
        {profile
          ? <EditableField label="Username" value={profile.username} prefix="@" onSave={saveUsername} />
          : detail("Username", "…")}
        {detail("Email", account.email)}
        {profile && detail("Joined", new Date(profile.joinedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }))}
        {error && <p role="alert" className="text-sm text-red-500 font-semibold">{error}</p>}

        <button className={`${buttonClass} self-start`} onClick={() => authClient.signOut().then(onSignedOut)}>Sign out</button>
      </div>

      {stats && (
        <div className="flex flex-col gap-6 w-full max-w-sm">
          <div>
            <SidebarSectionHeader text="Stats" />
            <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
              <div className={boxClass}><div className="text-lg">{stats.gamesPlayed}</div>Games</div>
              <div className={boxClass}><div className="text-lg">{stats.wins}</div>Wins</div>
              <div className={boxClass}><div className="text-lg">{winRate}%</div>Win rate</div>
            </div>
          </div>

          {stats.bestTimes.length > 0 && (
            <div>
              <SidebarSectionHeader text="Best Times" />
              <div className="flex flex-col gap-2 text-sm font-semibold">
                {stats.bestTimes.map(best => (
                  <div key={`${best.rows}x${best.cols}x${best.mines}`} className={`${boxClass} flex justify-between`}>
                    <span>{best.rows} × {best.cols}, {best.mines} {best.mines === 1 ? "mine" : "mines"}</span>
                    <span className="tabular-nums">{formatTime(best.seconds)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

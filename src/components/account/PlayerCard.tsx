import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useSettings } from "../../context/SettingsContext"
import { useTheme } from "../../context/ThemeContext"
import { useLayout } from "../../hooks/useLayout"
import { navigate } from "../../hooks/useRoute"
import { getPlayerProfile, type PlayerProfile } from "../../lib/api"
import { avatarSrc } from "../../lib/avatar"
import AdminBadge from "../admin/AdminBadge"
import FloatingWindow from "../app/FloatingWindow"
import Badges from "./Badges"
import LevelBar from "./LevelBar"
import ProfileStats from "./ProfileStats"
import { useFormStyles } from "../../hooks/useFormStyles"

// keeps the card this far from what it hangs off and from the edges of the screen
const GAP = 8

type PlayerCardProps = {
  playerId: string
  // what was clicked to open the card; the card pops up beside it
  anchor: HTMLElement
  onClose: () => void
}

// Another player's profile on a small card: who they are and how they've played. Nothing on it can be changed.
// It closes on a click anywhere else, or the Escape key.
// It is drawn at the top of the page rather than where it is used, because the left pane and the chats
// cut off whatever is inside them.
// On a phone there is no room beside a name for a card to pop up in, so it comes up from the bottom as a sheet
export default function PlayerCard({ playerId, anchor, onClose }: PlayerCardProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { settings } = useSettings()
  const { mode, short } = useLayout()
  const asSheet = mode === "phone" || short
  const cardRef = useRef<HTMLDivElement>(null)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  // null until the card has been measured
  const [position, setPosition] = useState<{ top: number, left: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    getPlayerProfile(playerId)
      .then(loaded => { if (!cancelled) setProfile(loaded) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [playerId])

  // Just under what was clicked, or above it when there is no room below, and never off the screen.
  // Worked out again once the profile has loaded, because the card is taller then
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    const clicked = anchor.getBoundingClientRect()
    const fitsBelow = clicked.bottom + GAP + card.offsetHeight <= window.innerHeight - GAP
    setPosition({
      top: fitsBelow ? clicked.bottom + GAP : Math.max(GAP, clicked.top - GAP - card.offsetHeight),
      left: Math.max(GAP, Math.min(clicked.left, window.innerWidth - card.offsetWidth - GAP)),
    })
  }, [anchor, profile, error])

  useEffect(() => {
    // the sheet closes itself: by its X, or a press on the dimmed screen around it
    if (asSheet) return
    const handlePress = (e: MouseEvent) => {
      const target = e.target as Node
      // a click on the name itself is left to the name, which closes the card it opened
      if (!cardRef.current?.contains(target) && !anchor.contains(target)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handlePress)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handlePress)
      document.removeEventListener("keydown", handleKey)
    }
  }, [anchor, onClose, asSheet])

  const card = (
    <>
      {error && <p role="alert" className="text-sm text-red-500 font-semibold">{error}</p>}
      {!profile && !error && <span className={`text-sm opacity-70 ${theme.textBody}`}>Loading…</span>}
      {profile && (
        <>
          <div className="flex items-center gap-3">
            <img
              src={avatarSrc(profile.image)}
              alt=""
              referrerPolicy="no-referrer"
              className={`w-14 h-14 shrink-0 rounded-full object-cover border ${theme.itemBg} ${theme.itemBorder}`}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-semibold truncate ${theme.textHead}`}>{profile.name}</span>
                {profile.isAdmin && <AdminBadge />}
              </div>
              <div className={`text-sm truncate ${theme.textBody}`}>@{profile.username}</div>
              <div className={`text-xs opacity-70 ${theme.textBody}`}>
                Joined {new Date(profile.joinedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>
          </div>
          <LevelBar xp={profile.xp} compact />
          <Badges badges={profile.badges} />
          {profile.bio && <p className={`text-sm whitespace-pre-wrap break-words ${theme.textBody}`}>{profile.bio}</p>}
          <ProfileStats {...profile} />
          <button
            className={`${styles.button} self-start text-sm`}
            onClick={() => {
              navigate("history", playerId)
              onClose()
            }}
          >
            Match history
          </button>
        </>
      )}
    </>
  )

  if (asSheet) {
    return createPortal(
      <FloatingWindow title="Player" sheet className="" onClose={onClose}>
        <div className="flex flex-col gap-4 cursor-default">{card}</div>
      </FloatingWindow>,
      document.body,
    )
  }

  return createPortal(
    <div
      ref={cardRef}
      className={`fixed z-50 flex flex-col gap-4 w-80 max-h-[80vh] overflow-y-auto hide-scrollbar p-4 rounded-xl border cursor-default
        shadow-2xl shadow-black/70 ring-1 ring-white/20
        ${position ? (settings.reduceMotion ? "" : "animate-popIn") : "invisible"}
        ${theme.menuBg}
        ${theme.menuBorder}
      `}
      style={position ?? { top: 0, left: 0 }}
    >
      {card}
    </div>,
    document.body,
  )
}

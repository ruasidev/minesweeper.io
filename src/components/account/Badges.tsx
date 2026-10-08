import { Bomb, Crown, Flame, Gem, Heart, Medal, ShieldCheck, Zap, type LucideIcon } from "lucide-react"
import { useBadgeGallery } from "../../context/BadgeGalleryContext"
import { BADGES, type BadgeId } from "../../../shared/badges"

// How each badge looks. The names and what they are for live in shared/badges.ts
const LOOKS: Record<BadgeId, { icon: LucideIcon, color: string }> = {
  // the one badge that is given rather than earned gets the gold treatment: a gradient, a rim and a glow
  "admin": { icon: ShieldCheck, color: "bg-linear-to-br from-amber-200 via-amber-400 to-orange-600 text-amber-950 ring-2 ring-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.75)]" },
  "early-supporter": { icon: Heart, color: "bg-pink-500 text-white" },
  "expert": { icon: Crown, color: "bg-violet-500 text-white" },
  "flawless": { icon: Gem, color: "bg-emerald-500 text-white" },
  "lightning": { icon: Zap, color: "bg-yellow-500 text-white" },
  "daily-devotee": { icon: Flame, color: "bg-orange-500 text-white" },
  "veteran": { icon: Medal, color: "bg-sky-500 text-white" },
  "bomb-magnet": { icon: Bomb, color: "bg-red-500 text-white" },
}

// One badge as a coloured disc. Greyed out when it is shown as something not earned yet
export function BadgeDisc({ id, size = "small", earned = true }: { id: BadgeId, size?: "small" | "large", earned?: boolean }) {
  const { icon: Icon, color } = LOOKS[id]
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full
        ${size === "large" ? "w-10 h-10" : "w-6 h-6"}
        ${earned ? color : "bg-neutral-500/40 text-white/60"}
      `}
    >
      <Icon className={size === "large" ? "w-5 h-5" : "w-3.5 h-3.5"} />
    </span>
  )
}

// A player's badges: small coloured discs that say what they are when the pointer is over them.
// Clicking one opens the list of every badge there is
export default function Badges({ badges }: { badges: BadgeId[] }) {
  const showGallery = useBadgeGallery()
  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {BADGES.filter(badge => badges.includes(badge.id)).map(badge => (
        <button key={badge.id} className="group relative inline-flex cursor-pointer" onClick={() => showGallery(badges)}>
          <BadgeDisc id={badge.id} />
          {/* starts at the badge's left edge rather than centred on it, so it never pokes out of a narrow card */}
          <span className="pointer-events-none absolute left-0 bottom-full z-10 mb-1.5 hidden group-hover:block w-max max-w-52 px-2 py-1 rounded bg-black text-white text-xs text-left shadow-lg">
            <span className="block font-semibold">{badge.name}</span>
            <span className="block opacity-80">{badge.description}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

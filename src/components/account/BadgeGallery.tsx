import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { BADGES, type BadgeId } from "../../../shared/badges"
import FloatingWindow from "../app/FloatingWindow"
import { BadgeDisc } from "./Badges"

// Every badge there is and what it takes to get it, with the ones this player has marked.
// A badge that is given rather than earned is only listed for someone who has it
export default function BadgeGallery({ earned, onClose }: { earned: BadgeId[], onClose: () => void }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const listed = BADGES.filter(badge => earned.includes(badge.id) || !("given" in badge))

  return (
    <FloatingWindow title="Badges" onClose={onClose} className="w-[90vw] max-w-xl max-h-[80vh]">
      <div className="flex flex-col gap-4">
        {listed.map((badge) => {
          const has = earned.includes(badge.id)
          return (
            <div key={badge.id} className={`flex items-center gap-4 cursor-default ${theme.textBody}`}>
              <BadgeDisc id={badge.id} size="large" earned={has} />
              <div className={`flex-1 min-w-0 ${has ? "" : "opacity-60"}`}>
                <div className={`font-semibold ${theme.textHead}`}>{badge.name}</div>
                <div className="text-sm">{badge.description}</div>
              </div>
              {has && <span className={styles.tag}>Earned</span>}
            </div>
          )
        })}
      </div>
    </FloatingWindow>
  )
}

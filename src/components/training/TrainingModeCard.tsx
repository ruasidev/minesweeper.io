import type { ReactNode } from "react"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"

type TrainingModeCardProps = {
  icon: ReactNode
  title: string
  // what it is, in a sentence or two
  blurb: string
  // how far along the player is in it
  progress?: ReactNode
  // what the button that goes into it says, and does
  action: string
  onStart: () => void
  // anything else there is to press, beside that button
  children?: ReactNode
}

// One kind of training, on the page that lists them: what it is, how far along the player is, and the way in.
// There is one so far. Whatever comes next is another of these
export default function TrainingModeCard({ icon, title, blurb, progress, action, onStart, children }: TrainingModeCardProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  return (
    <section className={`${styles.card} flex flex-col gap-4 p-4 sm:p-5 w-full ${theme.textBody}`}>
      <div className="flex items-start gap-4 cursor-default">
        <span className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-xl border ${theme.itemBg} ${theme.itemBorder} ${theme.textHead}`}>{icon}</span>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <h2 className={`text-xl font-semibold ${theme.textHead}`}>{title}</h2>
          <p className="text-sm">{blurb}</p>
        </div>
      </div>
      {progress}
      <div className="flex flex-wrap items-center gap-2">
        <button className={`${styles.primary} px-6! max-sm:w-full`} onClick={onStart}>{action}</button>
        {children}
      </div>
    </section>
  )
}

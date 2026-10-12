import { useFormStyles } from "../../hooks/useFormStyles"
import { useLayout } from "../../hooks/useLayout"
import { waitText, type Grade } from "../../../shared/training/schedule"

type Felt = Exclude<Grade, "again">

const ANSWERS: { grade: Felt, label: string, key: string }[] = [
  { grade: "hard", label: "Hard", key: "1" },
  { grade: "good", label: "Good", key: "2" },
  { grade: "easy", label: "Easy", key: "3" },
]

type GradeBarProps = {
  // how long each answer would put the pattern off for, in milliseconds
  waits: Record<Grade, number>
  // the one that is ready to be pressed: what the round is taken to have felt like, from how long it took
  suggested: Felt
  onGrade: (grade: Felt) => void
}

// How a solved round felt: the three answers, each saying when it would bring the pattern back. Pressing one is
// also what moves on to the next round, so a round costs one press and no more. They are always in the same order
// and the same place, and only which one is filled in changes
export default function GradeBar({ waits, suggested, onGrade }: GradeBarProps) {
  const styles = useFormStyles()
  // a key to press is only worth showing where there are keys
  const { touch } = useLayout()
  return (
    <div role="group" aria-label="How did that feel?" className="grid grid-cols-3 gap-2">
      {ANSWERS.map(({ grade, label, key }) => (
        <button
          key={grade}
          className={`${grade === suggested ? styles.primary : styles.button} relative flex flex-col items-center justify-center gap-0.5 h-13 px-2! py-0!`}
          onClick={() => onGrade(grade)}
        >
          <span className="leading-none">{label}</span>
          <span className="text-[11px] font-semibold leading-none opacity-70">{waitText(waits[grade]) === "tomorrow" ? "tomorrow" : `in ${waitText(waits[grade])}`}</span>
          {!touch && <kbd className="absolute top-1 right-1.5 text-[10px] font-semibold leading-none opacity-50">{key}</kbd>}
        </button>
      ))}
    </div>
  )
}

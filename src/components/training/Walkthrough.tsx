import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { ghostColors } from "../../game/themes"
import type { Shown } from "../../../shared/training/explain"

type WalkthroughProps = {
  steps: Shown[]
  index: number
  // to another step, or out of it altogether: stepping past the last one leaves
  onStep: (index: number) => void
  onClose: () => void
}

// A pattern explained, a step at a time: what the step says, and the way to the next. The step itself is on the
// board (see marksOfStep, in lib/training.ts). Pressing what it says goes on to the next, as do the arrow keys
export default function Walkthrough({ steps, index, onStep, onClose }: WalkthroughProps) {
  const { theme } = useTheme()
  const last = index === steps.length - 1
  const forward = () => (last ? onClose() : onStep(index + 1))
  const arrow = `shrink-0 flex items-center justify-center w-10 h-10 rounded-lg pressable disabled:opacity-30 ${ghostColors(theme)}`
  return (
    <div className={`flex items-center gap-1 ${theme.textBody}`}>
      <button className={arrow} disabled={index === 0} onClick={() => onStep(index - 1)} aria-label="The step before">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button className="flex-1 min-w-0 flex flex-col gap-0.5 px-1 py-1 text-left cursor-pointer" onClick={forward}>
        <span className="text-[10px] font-semibold uppercase tracking-wide leading-none opacity-60">Step {index + 1} of {steps.length}</span>
        {/* said aloud as it changes, for anyone who can't see what is lit up */}
        <span aria-live="polite" className={`text-sm font-semibold leading-snug ${theme.textHead}`}>{steps[index].says}</span>
      </button>
      <button className={arrow} onClick={forward} aria-label={last ? "Done" : "The next step"}>
        {last ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>
    </div>
  )
}

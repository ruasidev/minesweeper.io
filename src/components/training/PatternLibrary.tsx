import { useMemo, useState } from "react"
import { ArrowLeft, ChevronDown, RefreshCw } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { useFormStyles } from "../../hooks/useFormStyles"
import { navigate } from "../../hooks/useRoute"
import type { TrainingDeck } from "../../hooks/useTrainingDeck"
import { marksOfStep } from "../../lib/training"
import { randomSeed } from "../../../shared/engine/seed"
import { walkThrough } from "../../../shared/training/explain"
import { FAMILIES, PATTERNS, type Family, type Pattern, type PatternId } from "../../../shared/training/patterns"
import { randomFrom } from "../../../shared/training/random"
import { isMastered, waitText, type Card } from "../../../shared/training/schedule"
import { makeTrial } from "../../../shared/training/trial"
import Page from "../app/Page"
import MinesLeft from "./MinesLeft"
import TrialBoard from "./TrialBoard"
import Walkthrough from "./Walkthrough"

// How a player stands with a pattern, in a word, and when they will see it next
function standing(card: Card | undefined, now: number): { label: string, known: boolean, due: string | null } {
  if (!card) return { label: "Not met yet", known: false, due: null }
  const label = card.phase === "learning" ? "Learning" : card.phase === "relearning" ? "Learning again" : isMastered(card) ? "Mastered" : "Learned"
  const wait = waitText(card.due - now)
  return { label, known: card.phase === "review", due: card.due <= now ? "due now" : wait === "tomorrow" ? "back tomorrow" : `back in ${wait}` }
}

// A pattern shown at work: a board with the pattern on it, and its explanation stepped through on that board. Any
// number of boards can be asked for, each as different from the last as a round's would be
function PatternExample({ pattern }: { pattern: Pattern }) {
  const styles = useFormStyles()
  const [example, setExample] = useState(() => ({ key: 0, step: 0, trial: makeTrial(pattern, 0, randomFrom(randomSeed())) }))
  const steps = useMemo(() => walkThrough(example.trial), [example.trial])
  const toStep = (step: number) => setExample(now => ({ ...now, step }))
  return (
    <div className="flex flex-col gap-2 px-2 sm:px-4 pb-4">
      {example.trial.counted && <div className="self-center"><MinesLeft board={example.trial.board} /></div>}
      <TrialBoard key={example.key} board={example.trial.board} marks={marksOfStep(steps, example.step)} />
      <Walkthrough steps={steps} index={example.step} onStep={toStep} onClose={() => toStep(0)} />
      <button
        className={`${styles.ghost} self-center inline-flex items-center gap-2 text-sm`}
        onClick={() => setExample(now => ({ key: now.key + 1, step: 0, trial: makeTrial(pattern, 0, randomFrom(randomSeed())) }))}
      >
        <RefreshCw className="w-4 h-4" />
        Another example
      </button>
    </div>
  )
}

// Every pattern there is, a family at a time, in the order they are learned: what each comes to, how the player
// stands with it, and, opened up, the pattern at work on a board. This is where to come to be told. In training
// itself nothing is explained that wasn't asked for
export default function PatternLibrary({ training }: { training: TrainingDeck }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const [open, setOpen] = useState<PatternId | null>(null)
  const now = Date.now()
  const families = (Object.keys(FAMILIES) as Family[]).map(family => ({ family, patterns: PATTERNS.filter(pattern => pattern.family === family) }))

  return (
    <Page
      title="All patterns"
      maxWidth="max-w-2xl"
      aside={(
        <button className={`${styles.ghost} ml-auto inline-flex items-center gap-2 text-sm`} onClick={() => navigate("training", "patterns")}>
          <ArrowLeft className="w-4 h-4" />
          Training
        </button>
      )}
    >
      {families.filter(({ patterns }) => patterns.length > 0).map(({ family, patterns }) => (
        <section key={family} className={`${styles.card} overflow-hidden w-full ${theme.textBody}`}>
          <div className="flex flex-col gap-1 p-4 cursor-default">
            <h2 className={`text-xl font-semibold ${theme.textHead}`}>{FAMILIES[family].label}</h2>
            <p className="text-sm opacity-80">{FAMILIES[family].blurb}</p>
          </div>
          {patterns.map((pattern) => {
            const { label, known, due } = standing(training.deck?.[pattern.id], now)
            const isOpen = open === pattern.id
            return (
              <div key={pattern.id} className={`border-t ${theme.itemBorder}`}>
                <button
                  aria-expanded={isOpen}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-left cursor-pointer transition-colors ${theme.itemHoverBg}`}
                  onClick={() => setOpen(isOpen ? null : pattern.id)}
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className={`font-bold ${theme.textHead}`}>{pattern.name}</span>
                    <span className="text-sm opacity-80">{pattern.rule}</span>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-0.5 text-xs">
                    <span className={`font-semibold ${known ? "text-green-500" : "opacity-70"}`}>{label}</span>
                    {due && <span className="opacity-60">{due}</span>}
                  </div>
                  <ChevronDown className={`shrink-0 w-4 h-4 opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && <PatternExample pattern={pattern} />}
              </div>
            )
          })}
        </section>
      ))}
    </Page>
  )
}

import { ScanSearch } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import type { AuthMode } from "../../game/types"
import { useFormStyles } from "../../hooks/useFormStyles"
import { navigate } from "../../hooks/useRoute"
import { useTrainingDeck, type TrainingDeck } from "../../hooks/useTrainingDeck"
import { tally } from "../../../shared/training/queue"
import Page from "../app/Page"
import ViewTransition from "../app/ViewTransition"
import PatternLibrary from "./PatternLibrary"
import PatternTraining from "./PatternTraining"
import TrainingModeCard from "./TrainingModeCard"
import TrainingProgress from "./TrainingProgress"

// What the training page can be showing, in the order one leads to the next
const VIEWS = ["modes", "patterns", "library"] as const

type TrainingScreenProps = {
  // what follows the page's address: nothing for the list of what there is, "patterns" for pattern training, and
  // "patterns/library" for the list of every pattern
  view: string[]
  onOpenAuth: (mode: AuthMode) => void
}

// The kinds of training there are, each with how far along the player is and the way into it
function TrainingModes({ training, onOpenAuth }: { training: TrainingDeck, onOpenAuth: (mode: AuthMode) => void }) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const counts = training.deck ? tally(training.deck, Date.now()) : null
  return (
    <Page title="Training" maxWidth="max-w-2xl">
      <p className={`cursor-default ${theme.textBody}`}>
        Practice for the parts of the game that practice improves. Nothing here is against anyone, and none of it counts towards a rating.
      </p>
      <TrainingModeCard
        icon={<ScanSearch className="w-6 h-6" />}
        title="Pattern training"
        blurb="Learn to see the patterns at a glance. Each round is a small board built around one of them, never the same board twice, and the ones you find hard come back sooner."
        progress={counts && <TrainingProgress tally={counts} />}
        action={!counts || counts.fresh === counts.total ? "Start" : counts.due > 0 ? `Review ${counts.due}` : "Continue"}
        onStart={() => navigate("training", "patterns")}
      >
        <button className={styles.ghost} onClick={() => navigate("training", "patterns", "library")}>All patterns</button>
      </TrainingModeCard>
      {training.local && (
        <section className={`${styles.card} flex flex-wrap items-center gap-x-4 gap-y-3 p-4 w-full ${theme.textBody}`}>
          <p className="flex-1 min-w-56 text-sm cursor-default">Your progress is kept in this browser and nowhere else. With an account it goes wherever you do.</p>
          <div className="flex gap-2">
            <button className={styles.ghost} onClick={() => onOpenAuth("signIn")}>Log in</button>
            <button className={styles.button} onClick={() => onOpenAuth("signUp")}>Sign up</button>
          </div>
        </section>
      )}
    </Page>
  )
}

// Training: the list of what there is to practise, and whichever of them is open. One deck of cards is fetched for
// the page as a whole, so the list, the training and the library all show the same progress
export default function TrainingScreen({ view, onOpenAuth }: TrainingScreenProps) {
  const training = useTrainingDeck()
  const showing = view[0] !== "patterns" ? "modes" : view[1] === "library" ? "library" : "patterns"
  return (
    <ViewTransition view={showing} order={VIEWS} className="h-full">
      {showing === "patterns" ? <PatternTraining training={training} />
        : showing === "library" ? <PatternLibrary training={training} />
        : <TrainingModes training={training} onOpenAuth={onOpenAuth} />}
    </ViewTransition>
  )
}

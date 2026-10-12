import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { BookOpen, Check, CircleHelp, CirclePlay, GraduationCap, X } from "lucide-react"
import { useSettings } from "../../context/SettingsContext"
import { useTheme } from "../../context/ThemeContext"
import { ghostColors } from "../../game/themes"
import { useFormStyles } from "../../hooks/useFormStyles"
import { useLayout } from "../../hooks/useLayout"
import { useLocalStorage } from "../../hooks/useLocalStorage"
import { usePatternSession, type Playing } from "../../hooks/usePatternSession"
import { navigate } from "../../hooks/useRoute"
import type { TrainingDeck } from "../../hooks/useTrainingDeck"
import { boardSpan } from "../../lib/boardFit"
import { formatSeconds, marksOfStep, type Mark } from "../../lib/training"
import { FLAGGED, UNCOVERED } from "../../../shared/engine/board"
import { walkThrough } from "../../../shared/training/explain"
import { patternOf } from "../../../shared/training/patterns"
import { nextDue, tally, type Next } from "../../../shared/training/queue"
import { isMissed, type RoundOutcome } from "../../../shared/training/round"
import { waitText, waits } from "../../../shared/training/schedule"
import Page from "../app/Page"
import BoardStage from "../minesweeper/BoardStage"
import { FlagToggle } from "../minesweeper/Dock"
import GameBar, { BarField } from "../minesweeper/GameBar"
import GradeBar from "./GradeBar"
import MinesLeft from "./MinesLeft"
import TrainingProgress from "./TrainingProgress"
import TrialBoard from "./TrialBoard"
import Walkthrough from "./Walkthrough"

// the biggest board a round has, in cells: room is kept for one that size, so that nothing under the board moves
// from one round to the next
const BOARD_SIDE_MAX = 8

// why a round came up, in a word or two
const KINDS: Record<Next["why"], string> = { new: "New", learning: "Learning", review: "Review", ahead: "Extra" }

// what is said of a round that was missed, by how
const MISSES: Partial<Record<RoundOutcome, string>> = {
  mine: "That was a mine.",
  notMine: "That one is safe.",
  guess: "A guess: nothing proves it.",
  gaveUp: "This was there to find.",
}

// What a player new to this is told, a line at a time, beside the thing it is about. Each is gone once the thing
// has been done, and the "?" brings them back
type Coached = { marking: boolean, grading: boolean }

// The pattern's name, which is also the way to its explanation: nothing is explained that wasn't asked for, so
// the asking has to be easy to see. It draws the eye, once, when the explanation is most likely to be wanted
function PatternChip({ playing, onOpen }: { playing: Playing, onOpen: () => void }) {
  const { theme } = useTheme()
  return (
    <button
      className={`inline-flex items-center gap-1.5 pl-3 pr-2.5 py-1 rounded-full border text-sm font-bold pressable
        ${theme.itemBg} ${theme.itemBorder} ${theme.itemHoverBg} ${theme.textHead}
        ${playing.nudge ? "border-amber-400! animate-nudge" : ""}`}
      onClick={onOpen}
    >
      {patternOf(playing.next.pattern).name}
      <CirclePlay className="w-4 h-4 opacity-80" />
      <span className="font-semibold opacity-70">see why</span>
    </button>
  )
}

// A line of the strip under the board: something small at its head, and what there is to say
function StripLine({ mark, children }: { mark?: ReactNode, children: ReactNode }) {
  return (
    <div className="flex items-center justify-center flex-wrap gap-x-2.5 gap-y-1.5 min-h-8 text-sm text-center">
      {mark}
      {children}
    </div>
  )
}

type PatternTrainingProps = {
  training: TrainingDeck
}

// Pattern training: one small board after another, each made around a pattern the player is learning. A round is
// over in a few seconds and the next is a single press away, so everything that isn't the board is kept to one
// strip under it, which is always in the same place: what to do, then how it went and how it felt
export default function PatternTraining({ training }: PatternTrainingProps) {
  const { theme } = useTheme()
  const styles = useFormStyles()
  const { settings } = useSettings()
  const { compact, short, touch } = useLayout()
  const session = usePatternSession(training)
  const { playing, suggested } = session
  const { deck } = training
  const [coached, setCoached] = useLocalStorage<Coached>("trainingCoached", { marking: false, grading: false })

  // The explanation of the round on the board, and which step of it is showing: none, until it is asked for.
  // It belongs to its round, and is gone with it
  const [walk, setWalk] = useState<{ round: number, step: number } | null>(null)
  const walking = playing && walk?.round === playing.key ? walk.step : null
  const trial = playing?.round.trial
  const steps = useMemo(() => (trial ? walkThrough(trial) : []), [trial])
  const openWalk = () => playing && setWalk({ round: playing.key, step: 0 })

  const outcome = playing?.round.outcome
  const over = outcome !== undefined && outcome !== "playing"
  // a player who has finished a round has been shown how marking works
  useEffect(() => {
    if (over) setCoached(now => (now.marking ? now : { ...now, marking: true }))
  }, [over, setCoached])

  const grade: typeof session.grade = (felt) => {
    setCoached(now => (now.grading ? now : { ...now, grading: true }))
    session.grade(felt)
  }

  // The keys: 1 to 3 answer a solved round and the space bar gives the answer that is ready; the space bar moves on
  // from a missed one; the arrows step through an explanation. Latest handlers, one listener
  const keys = { walking, steps, outcome, suggested, grade, next: session.next, round: playing?.key ?? 0 }
  const latest = useRef(keys)
  useEffect(() => {
    latest.current = keys
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { walking, steps, outcome, suggested, grade, next, round } = latest.current
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
      // a key pressed on something outside the page (the navigation, a window open over it) is that thing's own
      const elsewhere = e.target instanceof HTMLElement && e.target !== document.body && !e.target.closest("main")
      if (typing || elsewhere || e.metaKey || e.ctrlKey || e.altKey || outcome === undefined || outcome === "playing") return
      const go = e.key === " " || e.key === "Enter"
      let handled = true
      if (walking !== null) {
        if (e.key === "Escape") setWalk(null)
        else if (e.key === "ArrowLeft") setWalk({ round, step: Math.max(0, walking - 1) })
        else if (e.key === "ArrowRight" || go) setWalk(walking === steps.length - 1 ? null : { round, step: walking + 1 })
        else handled = false
      } else if (outcome === "solved") {
        if (e.key === "1") grade("hard")
        else if (e.key === "2") grade("good")
        else if (e.key === "3") grade("easy")
        else if (go && suggested) grade(suggested)
        else handled = false
      } else if (go) next()
      else handled = false
      // a key that did something here does nothing else: the space bar would also press whatever button has the focus
      if (handled) e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // What is pointed out on the board: a step of the explanation; or, once the round is over, whatever there was to
  // find that the player didn't mark themselves. After a solve that is the other kind of cell, filled in for them
  const marks = useMemo((): Mark[] => {
    if (!playing || !over) return []
    if (walking !== null) return marksOfStep(steps, walking)
    const { board, trial, wrong } = playing.round
    const found: Mark[] = [
      ...trial.find.safe.filter(cell => board.cells[cell] !== UNCOVERED).map(cell => ({ cell, as: "safe" as const })),
      ...trial.find.mines.filter(cell => board.cells[cell] !== FLAGGED && cell !== wrong).map(cell => ({ cell, as: "mine" as const })),
    ]
    return wrong !== null && !found.some(mark => mark.cell === wrong) ? [...found, { cell: wrong, as: "wrong" }] : found
  }, [playing, over, walking, steps])

  const now = Date.now()
  const counts = deck ? tally(deck, now) : null
  const iconButton = `shrink-0 flex items-center justify-center w-9 h-9 rounded-lg pressable ${ghostColors(theme)}`
  const figure = `text-sm font-bold leading-5 tabular-nums ${theme.textHead}`
  const tools = (
    <div className="flex items-center gap-0.5">
      <button className={iconButton} title="All patterns" aria-label="All patterns" onClick={() => navigate("training", "patterns", "library")}>
        <BookOpen className="w-5 h-5" />
      </button>
      <button className={iconButton} title="How this works" aria-label="How this works" onClick={() => setCoached({ marking: false, grading: false })}>
        <CircleHelp className="w-5 h-5" />
      </button>
    </div>
  )
  const status = counts && (
    <GameBar icon={<GraduationCap className="w-4 h-4" />} label="Patterns" vertical={compact && short} columns={compact ? 3 : undefined} action={tools}>
      <BarField label="Learned" vertical={compact && short}>
        <span className={figure}>{counts.learned} / {counts.total}</span>
      </BarField>
      <BarField label="Due" vertical={compact && short}>
        <span className={`${figure} ${counts.due > 0 ? "text-green-500!" : ""}`}>{counts.due}</span>
      </BarField>
      <BarField label="This round" vertical={compact && short}>
        <span className={figure}>{playing ? KINDS[playing.next.why] : "—"}</span>
      </BarField>
      {!compact && tools}
    </GameBar>
  )

  // The strip under the board
  const caption = "text-xs leading-snug text-center opacity-70"
  let strip: ReactNode = null
  if (playing && walking !== null) {
    strip = <Walkthrough steps={steps} index={walking} onStep={step => setWalk({ round: playing.key, step })} onClose={() => setWalk(null)} />
  } else if (playing && outcome === "playing") {
    strip = (
      <>
        <StripLine mark={playing.round.trial.counted && <MinesLeft board={playing.round.board} />}>
          <span className={`font-semibold ${theme.textHead}`}>Open what must be safe, or flag what must be a mine.</span>
        </StripLine>
        {!coached.marking && <p className={caption}>Mark only what the numbers prove: a lucky guess is a miss. Flags already on the board are right. All of either kind solves it.</p>}
        <div className="flex items-stretch gap-2">
          {touch && <FlagToggle />}
          <button className={`${styles.ghost} ${touch ? "" : "mx-auto"}`} onClick={session.giveUp}>Show me</button>
        </div>
      </>
    )
  } else if (playing && outcome === "solved" && suggested) {
    strip = (
      <>
        <StripLine mark={<span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white"><Check className="w-4 h-4" /></span>}>
          <PatternChip playing={playing} onOpen={openWalk} />
          {playing.tookMs !== null && <span className="font-semibold tabular-nums opacity-70">{formatSeconds(playing.tookMs)}</span>}
        </StripLine>
        {!coached.grading && <p className={caption}>How did that feel? Your answer decides when this pattern comes back, and takes you to the next.</p>}
        <GradeBar waits={waits(deck?.[playing.next.pattern] ?? null, now)} suggested={suggested} onGrade={grade} />
      </>
    )
  } else if (playing && isMissed(playing.round)) {
    const back = deck?.[playing.next.pattern]
    strip = (
      <>
        <StripLine mark={<span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white"><X className="w-4 h-4" /></span>}>
          <span className={`font-semibold ${theme.textHead}`}>{MISSES[playing.round.outcome]}</span>
          <PatternChip playing={playing} onOpen={openWalk} />
        </StripLine>
        <button className={`${styles.primary} flex flex-col items-center justify-center gap-0.5 h-13 py-0!`} onClick={session.next}>
          <span className="leading-none">Next</span>
          {back && <span className="text-[11px] font-semibold leading-none opacity-70">this one is back in {waitText(Math.max(0, back.due - now))}</span>}
        </button>
      </>
    )
  }

  const board = playing && (
    <TrialBoard
      // a new board for every round: nothing of the last one carries over, its sounds least of all
      key={playing.key}
      board={playing.round.board}
      marks={marks}
      why={over && walking === null && playing.round.wrong !== null ? { cell: playing.round.wrong, onAsk: openWalk } : null}
      onOpen={outcome === "playing" ? session.open : undefined}
      onFlag={outcome === "playing" ? session.flag : undefined}
    />
  )

  // Nothing to play: the cards are on their way, or couldn't be had, or there is nothing due
  let instead: ReactNode = null
  if (training.error) {
    instead = (
      <>
        <p role="alert" className="font-semibold text-red-500">{training.error}</p>
        <button className={styles.primary} onClick={training.reload}>Try again</button>
      </>
    )
  } else if (session.failed) {
    instead = (
      <>
        <p role="alert" className="font-semibold text-red-500">That round couldn't be made.</p>
        <button className={styles.primary} onClick={session.next}>Try another</button>
      </>
    )
  } else if (!deck) {
    instead = <p className="opacity-70">Fetching your progress…</p>
  } else if (session.caughtUp) {
    const due = nextDue(deck)
    instead = (
      <>
        <span className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500 text-white ring-8 ring-green-500/20">
          <Check className="w-6 h-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-extrabold text-green-500">All caught up</h2>
          <p>{due !== null && due > now ? `Your next review is ${waitText(due - now) === "tomorrow" ? "tomorrow" : `in ${waitText(due - now)}`}.` : "There is nothing waiting for you."}</p>
        </div>
        {counts && <div className="w-full max-w-xs"><TrainingProgress tally={counts} /></div>}
        <div className="flex flex-wrap justify-center gap-2">
          <button className={styles.primary} onClick={session.keepGoing}>Keep practising</button>
          <button className={styles.ghost} onClick={() => navigate("training", "patterns", "library")}>All patterns</button>
        </div>
      </>
    )
  }

  const unsaved = training.unsaved && <p role="alert" className="text-xs font-semibold text-center text-amber-500">Your last answer hasn't been saved: the server can't be reached.</p>
  const onBoard = board !== null && instead === null

  return (
    <Page title="Pattern training" maxWidth="max-w-2xl" fill={compact && onBoard}>
      {!onBoard ? (
        <section className={`${styles.card} flex flex-col items-center gap-4 p-6 w-full text-center cursor-default ${theme.textBody}`}>{instead}</section>
      ) : compact ? (
        // the strip keeps the height of its tallest self, with whatever is in it at the bottom: the board above it
        // stays exactly where it is from one round to the next, and the buttons stay under the thumb
        <BoardStage status={status} dock={<div className={`flex flex-col justify-end gap-2 ${short ? "" : "min-h-36"} ${theme.textBody}`}>{unsaved}{strip}</div>}>{board}</BoardStage>
      ) : (
        <div className={`flex flex-col items-center gap-3 ${theme.textBody}`}>
          {status}
          <div className="flex flex-col justify-center w-full" style={{ minHeight: boardSpan(BOARD_SIDE_MAX, settings.cellSize, settings.cellGap) + 40 }}>
            {board}
          </div>
          <div className="flex flex-col gap-2 w-full max-w-lg min-h-28">{unsaved}{strip}</div>
        </div>
      )}
    </Page>
  )
}

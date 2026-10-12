// When a pattern comes back.
//
// Each pattern a player has met has a card, as in a box of flashcards, and how they answer it decides when they
// see it next: soon if it was missed, later if it was easy, and later still every time. That is spaced repetition,
// and this is the schedule Anki made the standard one for it (SuperMemo's SM-2, with a few short steps for a card
// that is new):
//
// - A new pattern is "learning". It comes back in a minute, then in ten, and then it is known, and comes back the
//   next day.
// - A known pattern is in "review". Each time it is answered its interval (the days until it is seen again) is
//   multiplied: by a little for Hard, by the card's ease for Good, by more than that for Easy. The ease is the
//   card's own, and drifts down with every Hard and Again and up with every Easy.
// - A known pattern that is missed is "relearning": it comes back in ten minutes, and then at half its old interval.
//
// It is all in `review`, which takes a card and an answer and gives the card back as it now is. The site runs it
// to show what each button will do, and the server runs it, by its own clock, on what it keeps.

export const GRADES = ["again", "hard", "good", "easy"] as const

// How a round went: missed, or solved and how it felt
export type Grade = (typeof GRADES)[number]

export const isGrade = (value: unknown): value is Grade => (GRADES as readonly unknown[]).includes(value)

export type Phase = "learning" | "review" | "relearning"

export type Card = {
  phase: Phase
  // which of its phase's steps it is on, while learning or relearning
  step: number
  // when it is next due, and when it was last answered: milliseconds, as Date.now() gives them
  due: number
  last: number
  // the days from one review to the next, once it is known (0 until then)
  interval: number
  // what a good answer multiplies that by
  ease: number
  // how many times it has been answered, and how many of those were misses of a pattern that was known
  reviews: number
  lapses: number
}

export const MINUTE_MS = 60_000
export const DAY_MS = 86_400_000

// how long until a pattern comes back, at each step of learning it and of learning it again
const LEARNING_STEPS = [MINUTE_MS, 10 * MINUTE_MS]
const RELEARNING_STEPS = [10 * MINUTE_MS]
// the first interval of a pattern that has been learned, in days: by way of its steps, or straight off with Easy
const GRADUATING_DAYS = 1
const EASY_DAYS = 4
const EASE_START = 2.5
const EASE_MIN = 1.3
// what each answer does to the ease, and what Hard and Easy multiply the interval by besides
const EASE_AGAIN = -0.2
const EASE_HARD = -0.15
const EASE_EASY = 0.15
const HARD_TIMES = 1.2
const EASY_BONUS = 1.3
// what is left of the interval of a pattern that was known and has been missed
const LAPSE_TIMES = 0.5
// However well it is known, a pattern is seen again within this many days: it is a skill, and goes if it isn't used
export const INTERVAL_MAX_DAYS = 90
// a pattern with at least this long between reviews is mastered
export const MASTERED_DAYS = 21

const stepsOf = (phase: Phase): number[] => (phase === "relearning" ? RELEARNING_STEPS : LEARNING_STEPS)

const days = (count: number): number => Math.min(INTERVAL_MAX_DAYS, Math.max(1, Math.round(count)))

// A card one answer later. `card` is null for a pattern that has never been answered
export function review(card: Card | null, grade: Grade, now: number): Card {
  const from: Card = card ?? { phase: "learning", step: 0, due: now, last: now, interval: 0, ease: EASE_START, reviews: 0, lapses: 0 }
  const answered = { ...from, last: now, reviews: from.reviews + 1 }

  if (from.phase !== "review") {
    const steps = stepsOf(from.phase)
    // known (or known again): out of its steps and into review
    const graduate = (interval: number): Card => ({ ...answered, phase: "review", step: 0, interval, due: now + interval * DAY_MS })
    if (grade === "easy") return graduate(from.phase === "learning" ? EASY_DAYS : days(from.interval + 1))
    if (grade === "good") {
      const step = from.step + 1
      if (step >= steps.length) return graduate(from.phase === "learning" ? GRADUATING_DAYS : from.interval)
      return { ...answered, step, due: now + steps[step] }
    }
    // Again starts the steps over. Hard has the step over again: a little longer than it was, for the first of several
    if (grade === "again") return { ...answered, step: 0, due: now + steps[0] }
    const wait = from.step === 0 && steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[Math.min(from.step, steps.length - 1)]
    return { ...answered, due: now + wait }
  }

  if (grade === "again") {
    return {
      ...answered,
      phase: "relearning",
      step: 0,
      lapses: from.lapses + 1,
      ease: Math.max(EASE_MIN, from.ease + EASE_AGAIN),
      interval: days(from.interval * LAPSE_TIMES),
      due: now + RELEARNING_STEPS[0],
    }
  }

  // How long it has been remembered for, in days: its interval, and whatever it was late by on top. Answered
  // ahead of time, only as long as it has actually been: practising early earns no more than the time that has passed
  const elapsed = Math.max(0, now - from.last) / DAY_MS
  const held = Math.min(elapsed, from.interval)
  const late = Math.max(0, elapsed - from.interval)
  const early = elapsed < from.interval
  const [counted, times, ease] = grade === "hard" ? [held + late / 4, HARD_TIMES, EASE_HARD]
    : grade === "good" ? [held + late / 2, from.ease, 0]
    : [held + late, from.ease * EASY_BONUS, EASE_EASY]
  // it never comes back sooner for having been got right, and on time it always comes back later
  const interval = days(Math.max(counted * times, from.interval + (early ? 0 : 1)))
  return { ...answered, interval, ease: Math.max(EASE_MIN, from.ease + ease), due: now + interval * DAY_MS }
}

// How long each answer would put a card off for, in milliseconds: what the buttons say
export function waits(card: Card | null, now: number): Record<Grade, number> {
  const wait = (grade: Grade) => review(card, grade, now).due - now
  return { again: wait("again"), hard: wait("hard"), good: wait("good"), easy: wait("easy") }
}

// known: through its steps at least once, whether or not it has been missed since
export const isLearned = (card: Card | null | undefined): boolean => card != null && card.phase !== "learning"

export const isMastered = (card: Card | null | undefined): boolean => card != null && card.phase === "review" && card.interval >= MASTERED_DAYS

const isCount = (value: unknown, most: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= most
const isBetween = (value: unknown, low: number, high: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= low && value <= high

// Whether something is a card, and one this schedule could have made. For a card that comes from outside: a
// visitor's progress, kept in their browser, taken into their account when they sign up
export function isCard(value: unknown): value is Card {
  if (typeof value !== "object" || value === null) return false
  const card = value as Record<string, unknown>
  const phase = card.phase
  if (phase !== "learning" && phase !== "review" && phase !== "relearning") return false
  return isCount(card.step, stepsOf(phase).length - 1)
    && isBetween(card.due, 0, 1e14) && isBetween(card.last, 0, 1e14)
    && isCount(card.interval, INTERVAL_MAX_DAYS) && (phase === "learning" ? card.interval === 0 : card.interval >= 1)
    && isBetween(card.ease, EASE_MIN, 10)
    && isCount(card.reviews, 1e6) && isCount(card.lapses, 1e6)
}

// How long a wait is, in the fewest words: "1 min", "10 min", "tomorrow", "4 days"
export function waitText(ms: number): string {
  if (ms < 45 * MINUTE_MS) return `${Math.max(1, Math.round(ms / MINUTE_MS))} min`
  if (ms < 20 * 3_600_000) return `${Math.round(ms / 3_600_000)} h`
  const count = Math.round(ms / DAY_MS)
  return count <= 1 ? "tomorrow" : `${count} days`
}

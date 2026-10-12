import type { Shown } from "../../shared/training/explain"
import { isPatternId } from "../../shared/training/patterns"
import type { Deck } from "../../shared/training/queue"
import { isCard, type Grade } from "../../shared/training/schedule"

// Pattern training on the site's side: where a visitor's progress is kept, and what a solved round is taken to
// have felt like before the player says

const DECK_KEY = "trainingPatterns"

// A visitor's cards, kept in their browser. Whatever is there is checked before it is believed: it has been in
// reach of anything that can write to the browser's storage, and an old copy of the site may have put it there
export function loadLocalDeck(): Deck {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(DECK_KEY) ?? "{}")
    if (typeof kept !== "object" || kept === null) return {}
    return Object.fromEntries(Object.entries(kept).filter(([pattern, card]) => isPatternId(pattern) && isCard(card)))
  } catch {
    return {}
  }
}

export const saveLocalDeck = (deck: Deck): void => localStorage.setItem(DECK_KEY, JSON.stringify(deck))

export const clearLocalDeck = (): void => localStorage.removeItem(DECK_KEY)

// How long a round may take and still have been easy, and how long before it was hard, in milliseconds: so much
// to see the pattern, and so much for each cell there was to mark
const EASY_WITHIN = { seeing: 1800, perCell: 700 }
const HARD_FROM = { seeing: 6500, perCell: 1500 }

// What a solved round is taken to have felt like, from how long it took: the answer that is ready to be pressed.
// A player who only ever presses that one is being marked on speed, which is the thing being trained
export function suggestedGrade(tookMs: number, cells: number): Exclude<Grade, "again"> {
  if (tookMs <= EASY_WITHIN.seeing + EASY_WITHIN.perCell * cells) return "easy"
  return tookMs >= HARD_FROM.seeing + HARD_FROM.perCell * cells ? "hard" : "good"
}

// 2430 → "2.4 s"
export const formatSeconds = (ms: number): string => `${(Math.floor(ms / 100) / 10).toFixed(1)} s`

// Something pointed out on a board in training: a cell, and what it is pointed out as
export type Mark = {
  cell: number
  // a cell that is being talked about; one that has been proved a mine, or safe; the number doing the talking; or
  // the cell a round was missed on
  as: "group" | "mine" | "safe" | "number" | "wrong"
}

// What a step of an explanation points out on the board: the number it is about and the cells it is about, with
// whatever the steps before it proved still showing, so that the board fills in as the explanation goes
export function marksOfStep(steps: Shown[], index: number): Mark[] {
  const step = steps[index]
  const marks: Mark[] = steps.slice(0, index).filter(earlier => earlier.as !== "group").flatMap(earlier => earlier.cells.map(cell => ({ cell, as: earlier.as })))
  // (a cell said the same of twice is marked once)
  const marked = new Set(marks.map(mark => mark.cell))
  for (const cell of step.cells) {
    if (!marked.has(cell)) marks.push({ cell, as: step.as })
  }
  if (step.number !== null) marks.push({ cell: step.number, as: "number" })
  return marks
}

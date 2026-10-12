// What comes next in pattern training, and how far along a player is.
//
// A player's deck is their cards: one for every pattern they have met (schedule.ts). The next round is picked from
// it in the order a box of flashcards is gone through:
//
// 1. a pattern being learned whose step is due;
// 2. a known pattern that is due for review, the longest overdue first;
// 3. a new pattern, the next in the catalogue, but only while few enough are still being learned;
// 4. a pattern being learned whose step isn't due quite yet, rather than have the player wait a minute for it.
//
// The third is what sets the pace. Someone who finds the patterns easy has them known as fast as they are shown
// and is through the catalogue in a sitting; someone who is struggling is given nothing new until what they have
// has stuck. Nobody is asked how many new patterns a day they want.

import { PATTERN_IDS, type PatternId } from "./patterns.js"
import { isLearned, isMastered, type Card } from "./schedule.js"
import type { Stage } from "./trial.js"

export type Deck = Partial<Record<PatternId, Card>>

// a new pattern is brought in only while fewer than this many are being learned for the first time
export const LEARNING_MAX = 3

export type Next = {
  pattern: PatternId
  // its card, or null for a pattern that is new
  card: Card | null
  // "ahead" is a known pattern brought forward before it is due, for a player who wants to go on
  why: "learning" | "review" | "new" | "ahead"
}

// The next round, or null when there is nothing to do for now: nothing due, and nothing new that there is room
// for. `avoid` is the pattern of the round just played, which doesn't come straight back while there is anything
// else; `ahead` is for a player who has asked to keep going anyway
export function nextUp(deck: Deck, now: number, { avoid = null, ahead = false }: { avoid?: PatternId | null, ahead?: boolean } = {}): Next | null {
  const cards = PATTERN_IDS.flatMap((pattern) => {
    const card = deck[pattern]
    return card ? [{ pattern, card }] : []
  })
  const byDue = (a: { card: Card }, b: { card: Card }) => a.card.due - b.card.due
  const inSteps = cards.filter(({ card }) => card.phase !== "review").sort(byDue)
  const known = cards.filter(({ card }) => card.phase === "review").sort(byDue)
  const fresh = PATTERN_IDS.find(pattern => !deck[pattern])
  const room = cards.filter(({ card }) => card.phase === "learning").length < LEARNING_MAX

  const line: Next[] = [
    ...inSteps.filter(({ card }) => card.due <= now).map(entry => ({ ...entry, why: "learning" as const })),
    ...known.filter(({ card }) => card.due <= now).map(entry => ({ ...entry, why: "review" as const })),
    ...(fresh && room ? [{ pattern: fresh, card: null, why: "new" as const }] : []),
    ...inSteps.filter(({ card }) => card.due > now).map(entry => ({ ...entry, why: "learning" as const })),
    ...(ahead ? known.filter(({ card }) => card.due > now).map(entry => ({ ...entry, why: "ahead" as const })) : []),
  ]
  return line.find(next => next.pattern !== avoid) ?? line[0] ?? null
}

export type Tally = {
  // every pattern there is
  total: number
  // known, and of those, the ones known well
  learned: number
  mastered: number
  // met, and not known yet
  learning: number
  // not met yet
  fresh: number
  // waiting to be answered right now
  due: number
}

export function tally(deck: Deck, now: number): Tally {
  const cards = PATTERN_IDS.flatMap(pattern => deck[pattern] ?? [])
  const learned = cards.filter(isLearned).length
  return {
    total: PATTERN_IDS.length,
    learned,
    mastered: cards.filter(isMastered).length,
    learning: cards.length - learned,
    fresh: PATTERN_IDS.length - cards.length,
    due: cards.filter(card => card.due <= now).length,
  }
}

// when the next card comes due, or null for a deck with no cards
export function nextDue(deck: Deck): number | null {
  const dues = PATTERN_IDS.flatMap(pattern => deck[pattern]?.due ?? [])
  return dues.length > 0 ? Math.min(...dues) : null
}

// How much there is around a pattern to see past in its next round (see trial.ts): the longer it has been known
// for, the more
export function stageOf(card: Card | null): Stage {
  if (!card || card.phase === "learning" || card.interval < 3) return 0
  return card.interval < 10 ? 1 : 2
}

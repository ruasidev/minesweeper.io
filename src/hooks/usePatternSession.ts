import { useCallback, useEffect, useRef, useState } from "react"
import { playSound } from "../lib/sounds"
import { suggestedGrade } from "../lib/training"
import { randomSeed } from "../../shared/engine/seed"
import { FLAGGED } from "../../shared/engine/board"
import { patternOf, type PatternId } from "../../shared/training/patterns"
import { nextUp, stageOf, type Deck, type Next } from "../../shared/training/queue"
import { randomFrom } from "../../shared/training/random"
import { flag, giveUp, isMissed, open, startRound, type Round } from "../../shared/training/round"
import type { Grade } from "../../shared/training/schedule"
import { makeTrial, makeTrialWithin, type Stage, type Trial } from "../../shared/training/trial"
import type { TrainingDeck } from "./useTrainingDeck"

// The next round is got ready while the one on the board is being played: so long after it appears, so many boards
// at a go, with the page given a turn in between. Making a round usually takes a few boards and now and then a
// few thousand, and none of that should be felt under a finger
const PREPARE_AFTER_MS = 150
const PREPARE_SLICE = 80
// after this many goes at the stage that was wanted, an easier round is made instead
const PREPARE_SLICES_MAX = 60

// One round of a session
export type Playing = {
  // different for every round, for whatever has to start afresh with each
  key: number
  // which pattern, and why it came up now
  next: Next
  round: Round
  startedAt: number
  // how long it took, once it is over
  tookMs: number | null
  // The explanation is worth pointing out, once the round is over: the pattern is new to the player, or they have
  // missed it twice running
  nudge: boolean
}

export type PatternSession = {
  // the round on the board. Null while the deck is being fetched, and when there is nothing to do for now
  playing: Playing | null
  // nothing is due and there is nothing new there is room for: the player can stop here, or keep going
  caughtUp: boolean
  // a round couldn't be made (which the tests find never happens)
  failed: boolean
  // what a solved round is taken to have felt like, until the player says: the answer ready to be pressed
  suggested: Exclude<Grade, "again"> | null
  open: (at: number) => void
  flag: (at: number) => void
  giveUp: () => void
  // answers a solved round and moves on
  grade: (grade: Exclude<Grade, "again">) => void
  // moves on from a missed one, which was answered for the player the moment it was missed
  next: () => void
  // goes on with patterns that aren't due yet
  keepGoing: () => void
}

type Prepared = { pattern: PatternId, stage: Stage, trial: Trial }

// A session of pattern training: one round after another, each picked from the player's deck as it stands
export function usePatternSession({ deck, record }: TrainingDeck): PatternSession {
  const [playing, setPlaying] = useState<Playing | null>(null)
  const [caughtUp, setCaughtUp] = useState(false)
  const [failed, setFailed] = useState(false)
  // the session as it is this instant, for the handlers: a click is judged against the round as it now stands,
  // not as it stood when the page was last drawn
  const now = useRef<{ playing: Playing | null, ahead: boolean, rounds: number }>({ playing: null, ahead: false, rounds: 0 })
  const prepared = useRef<Prepared | null>(null)
  // the patterns whose last round, this session, was a miss
  const missedLast = useRef(new Set<PatternId>())

  // Starts the next round from a deck, or finds there is none to start
  const begin = useCallback((cards: Deck) => {
    const next = nextUp(cards, Date.now(), { avoid: now.current.playing?.next.pattern, ahead: now.current.ahead })
    let started: Playing | null = null
    try {
      if (next) {
        const stage = stageOf(next.card)
        const ready = prepared.current
        prepared.current = null
        const trial = ready && ready.pattern === next.pattern && ready.stage === stage ? ready.trial
          : makeTrial(patternOf(next.pattern), stage, randomFrom(randomSeed()))
        started = { key: ++now.current.rounds, next, round: startRound(trial), startedAt: Date.now(), tookMs: null, nudge: false }
      }
      setFailed(false)
    } catch (e) {
      console.error(e)
      setFailed(true)
    }
    now.current.playing = started
    setPlaying(started)
    setCaughtUp(next === null)
  }, [])

  // the first round, once there is a deck to pick it from; and a fresh start if the deck is someone else's
  const hasDeck = deck !== null
  const latestDeck = useRef(deck)
  useEffect(() => {
    latestDeck.current = deck
  })
  useEffect(() => {
    if (hasDeck && latestDeck.current) begin(latestDeck.current)
    else {
      now.current.playing = null
      setPlaying(null)
    }
  }, [hasDeck, begin])

  // While a round is being played, the one most likely to follow it is made: the pattern that would come next
  // as things stand. If the answer changes what comes next, the round that does is made on the spot instead
  const roundKey = playing?.key
  useEffect(() => {
    const cards = latestDeck.current
    const current = now.current.playing
    if (roundKey === undefined || !cards || !current) return
    const guess = nextUp(cards, Date.now(), { avoid: current.next.pattern, ahead: now.current.ahead })
    if (!guess) return
    const pattern = patternOf(guess.pattern)
    const wanted = stageOf(guess.card)
    const random = randomFrom(randomSeed())
    let slices = 0
    let timer = setTimeout(function slice() {
      const stage = slices++ < PREPARE_SLICES_MAX ? wanted : 0
      const { trial } = makeTrialWithin(pattern, stage, random, PREPARE_SLICE)
      // kept under the stage that was asked for, whichever it came out as: it is that round's stand-in
      if (trial) prepared.current = { pattern: guess.pattern, stage: wanted, trial }
      else if (slices < PREPARE_SLICES_MAX * 2) timer = setTimeout(slice, 0)
    }, PREPARE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [roundKey])

  // What a move came to: the round as it now stands, and if that ended it, how long it took and what follows
  const played = useCallback((before: Playing, round: Round) => {
    if (round === before.round) return
    const pattern = before.next.pattern
    const after: Playing = { ...before, round }
    if (round.outcome !== "playing") {
      after.tookMs = Date.now() - before.startedAt
      const missedBefore = missedLast.current.has(pattern)
      after.nudge = before.next.why === "new" || (isMissed(round) && missedBefore)
      if (isMissed(round)) {
        missedLast.current.add(pattern)
        // a miss is answered for the player, there and then: it is in the deck whether or not they stay to see it
        record(pattern, "again")
        // (a mine makes its own noise as it is uncovered)
        if (round.outcome !== "mine") playSound("error")
      } else {
        missedLast.current.delete(pattern)
        playSound("roundSolved")
      }
    }
    now.current.playing = after
    setPlaying(after)
  }, [record])

  const act = useCallback((move: (round: Round) => Round) => {
    const current = now.current.playing
    if (current && current.round.outcome === "playing") played(current, move(current.round))
  }, [played])

  const current = playing?.round
  const suggested = playing && current?.outcome === "solved" && playing.tookMs !== null
    // as many cells as were marked to solve it: the mines, if those are what got flagged, or else the safe ones
    ? suggestedGrade(playing.tookMs, current.trial.find.mines.length > 0 && current.trial.find.mines.every(cell => current.board.cells[cell] === FLAGGED)
      ? current.trial.find.mines.length : current.trial.find.safe.length)
    : null

  return {
    playing,
    caughtUp,
    failed,
    suggested,
    open: useCallback((at: number) => act(round => open(round, at)), [act]),
    flag: useCallback((at: number) => act(round => flag(round, at)), [act]),
    giveUp: useCallback(() => act(giveUp), [act]),
    grade: useCallback((grade) => {
      const current = now.current.playing
      if (current?.round.outcome === "solved") begin(record(current.next.pattern, grade))
    }, [begin, record]),
    next: useCallback(() => {
      const current = now.current.playing
      if (latestDeck.current && (!current || isMissed(current.round))) begin(latestDeck.current)
    }, [begin]),
    keepGoing: useCallback(() => {
      now.current.ahead = true
      if (latestDeck.current) begin(latestDeck.current)
    }, [begin]),
  }
}

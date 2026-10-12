// A round of training being played: what each thing the player does to its board comes to.
//
// Everything the player does is an answer. Uncovering a cell says it is safe and flagging one says it is a mine,
// and either is right only if the board proves it: a cell that turns out safe but could not have been known to be
// is a guess, and a guess is a miss the same as a mine is. That is the difference between this and a game, where
// a lucky guess is as good as a deduction.
//
// A round is solved by finding all of one kind: every cell there is to find that is safe, uncovered, or every one
// that is a mine, flagged (see `find` in trial.ts). Whichever comes first: someone who never flags plays it one
// way, and someone who always does plays it the other.

import { COVERED, FLAGGED, UNCOVERED, knownMinesAround, press, toggleFlag, type Board } from "../engine/board.js"
import { forEachNeighbour } from "../engine/field.js"
import { MINE, SAFE, proves } from "./logic.js"
import { positionOf, type Trial } from "./trial.js"

// How a round stands. The last four are the ways it is missed: a mine uncovered; a safe cell flagged; a cell
// uncovered or flagged rightly, as it turned out, when nothing on the board said so; and giving up
export type RoundOutcome = "playing" | "solved" | "mine" | "notMine" | "guess" | "gaveUp"

export type Round = {
  trial: Trial
  // the board as it now stands
  board: Board
  outcome: RoundOutcome
  // the cell it was missed on, if it was missed on one
  wrong: number | null
}

export const startRound = (trial: Trial): Round => ({ trial, board: trial.board, outcome: "playing", wrong: null })

export const isMissed = (round: Round): boolean => round.outcome !== "playing" && round.outcome !== "solved"

const missed = (round: Round, outcome: RoundOutcome, wrong: number): Round => ({ ...round, outcome, wrong })

// a round with all of either kind found is solved
function settled(round: Round, board: Board): Round {
  const { safe, mines } = round.trial.find
  const found = (cells: number[], as: number) => cells.length > 0 && cells.every(cell => board.cells[cell] === as)
  return { ...round, board, outcome: found(safe, UNCOVERED) || found(mines, FLAGGED) ? "solved" : "playing" }
}

// A click on a cell: it uncovers a covered one, and on a number with all its mines flagged, the rest around it
export function open(round: Round, at: number): Round {
  const { board } = round
  if (round.outcome !== "playing" || board.cells[at] === FLAGGED) return round
  const targets: number[] = []
  if (board.cells[at] === COVERED) targets.push(at)
  else if (knownMinesAround(board, at) === board.field.counts[at]) {
    forEachNeighbour(board.field.rows, board.field.cols, at, (neighbour) => {
      if (board.cells[neighbour] === COVERED) targets.push(neighbour)
    })
  }
  if (targets.length === 0) return round

  const mine = targets.find(cell => board.field.mines[cell])
  // the mine is left lying uncovered, for the player to see what they did
  if (mine !== undefined) return missed({ ...round, board: press(board, mine, { kind: "ends" }).board }, "mine", mine)
  const known = proves(positionOf(board, round.trial.counted), "everything")
  const guessed = targets.find(cell => known[cell] !== SAFE)
  if (guessed !== undefined) return missed(round, "guess", guessed)
  return settled(round, press(board, at, { kind: "ends" }).board)
}

// A flag on a covered cell. It stays where it is put: it is an answer, and not a note to come back to
export function flag(round: Round, at: number): Round {
  const { board } = round
  if (round.outcome !== "playing" || board.cells[at] !== COVERED) return round
  if (!board.field.mines[at]) return missed(round, "notMine", at)
  if (proves(positionOf(board, round.trial.counted), "everything")[at] !== MINE) return missed(round, "guess", at)
  return settled(round, toggleFlag(board, at))
}

export const giveUp = (round: Round): Round => (round.outcome === "playing" ? { ...round, outcome: "gaveUp" } : round)

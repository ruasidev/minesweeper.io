// A pattern explained on the very board it was met on.
//
// A pattern's explanation is a few steps (patterns.ts), each a thing to look at and a line about it: one of the
// pattern's numbers and the covered cells around it, or some of its cells and what follows for them. Here those
// steps are put onto a round's board. What is said of a number is worked out from that board, where the number
// may show more than the pattern needs of it because of the flags around it

import { COVERED, FLAGGED, UNCOVERED } from "../engine/board.js"
import { forEachNeighbour } from "../engine/field.js"
import { patternOf, type Step } from "./patterns.js"
import { coveredAround } from "./template.js"
import { minesLeft, type Trial } from "./trial.js"

export type Shown = {
  // the number being looked at, if the step is about one
  number: number | null
  // the cells lit up, and what as: a group of cells that is being talked about, or what they have been proved to be
  cells: number[]
  as: "group" | "mine" | "safe"
  says: string
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"]

const inWords = (count: number): string => WORDS[count] ?? String(count)
const mines = (count: number): string => `${inWords(count)} ${count === 1 ? "mine" : "mines"}`
const theseCells = (count: number): string => (count === 1 ? "this cell" : `these ${inWords(count)} cells`)

// What a number says of the covered cells around it, in a line
function sayNumber(shows: number, flags: number, needs: number, cells: number): string {
  if (needs === 0) return `This ${shows} already has ${flags === 1 ? "its mine" : `all ${WORDS[flags]} of its mines`} flagged.`
  if (flags === 0) return `This ${shows} has ${mines(needs)} in ${theseCells(cells)}.`
  return `This ${shows} has ${flags === 1 ? "a flag" : `${WORDS[flags]} flags`} beside it already, which leaves ${mines(needs)} in ${theseCells(cells)}.`
}

// A round that is about the count of mines has no shape to step through. What there is to say of it is the count,
// what the numbers make of it, and what that leaves: read off the board itself
function countThrough(trial: Trial): Shown[] {
  const { board } = trial
  const { rows, cols } = board.field
  const covered = Array.from(board.cells.keys()).filter(at => board.cells[at] === COVERED)
  // the covered cells a number touches
  const touched = covered.filter((at) => {
    let besideNumber = false
    forEachNeighbour(rows, cols, at, (neighbour) => { besideNumber ||= board.cells[neighbour] === UNCOVERED })
    return besideNumber
  })
  const left = minesLeft(board)
  const steps: Shown[] = [{
    number: null,
    cells: covered,
    as: "group",
    says: `The counter says ${mines(left)} ${left === 1 ? "is" : "are"} left on the board, somewhere in ${theseCells(covered.length)}.`,
  }]
  const proved = (cells: number[], as: "mine" | "safe", says: string) => {
    if (cells.length > 0) steps.push({ number: null, cells, as, says })
  }
  if (patternOf(trial.pattern).counted === "untouched") {
    // every mine there is, is among the cells the numbers touch; or as few of them as the numbers can do with
    const none = trial.safe.length > 0
    steps.push({
      number: null,
      cells: touched,
      as: "group",
      says: none ? `The numbers can't be met with fewer than ${inWords(left)} of them among the cells they touch.` : "The numbers have room for only some of them among the cells they touch.",
    })
    proved(trial.safe, "safe", "So there is no mine left over for the cells no number touches.")
    proved(trial.mines, "mine", "So the rest are in the cells no number touches: all of them.")
  } else {
    proved(trial.safe, "safe", "Put a mine here, and the numbers can no longer be met with the mines that are left.")
    proved(trial.mines, "mine", "Leave this without a mine, and the numbers can no longer be met with the mines that are left.")
  }
  return steps
}

// The steps of a round's pattern, on the round's board
export function walkThrough(trial: Trial): Shown[] {
  if (trial.counted) return countThrough(trial)
  const { board } = trial
  const { template, steps } = patternOf(trial.pattern).shapes[trial.shape]
  const cellsOf = (pick: (index: number) => boolean) => trial.covered.filter((_, index) => pick(index))

  return steps.map((step: Step): Shown => {
    if ("number" in step) {
      const index = step.number.charCodeAt(0) - 65
      const number = trial.numbers[index]
      const around = coveredAround(template, template.numbers[index])
      let flags = 0
      forEachNeighbour(board.field.rows, board.field.cols, number, (neighbour) => { flags += board.cells[neighbour] === FLAGGED ? 1 : 0 })
      return {
        number,
        cells: around.map(at => trial.covered[at]),
        as: "group",
        says: sayNumber(board.field.counts[number], flags, template.numbers[index].needs, around.length),
      }
    }
    if (step.cells === "*") return { number: null, cells: trial.mines, as: "mine", says: step.says }
    if (step.cells === "s") return { number: null, cells: trial.safe, as: "safe", says: step.says }
    const cells = step.cells === "?" ? cellsOf(index => template.covered[index].proven === "nothing")
      : cellsOf(index => step.cells.includes(template.covered[index].group ?? " "))
    return { number: null, cells, as: "group", says: step.says }
  })
}

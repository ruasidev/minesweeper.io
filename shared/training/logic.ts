// What a position proves.
//
// Given a board as its player sees it, and nothing else, this says which covered cells must be mines and which
// cannot be. It is what makes a round of training fair to set and possible to mark: a round is only set if its
// pattern is the way in, and a click only counts if the cell could be known to be safe.
//
// There are three ways of reasoning, each including the one before, and a position can be asked what it proves by
// any of them:
//
// - "counting": one number at a time. It has all its mines already, or exactly as many covered cells as it needs.
// - "pairs": two numbers that share cells. What one says of the cells they share limits the other's own.
// - "everything": every way the mines could lie that agrees with all the numbers at once. A cell that is a mine
//   in every one of them is a mine; one that is a mine in none is safe. Nothing more can be known than this.
//
// The board generator has a solver of its own, in Rust, built to race through a full board. This one is asked
// different questions (what follows by which reasoning, from what is on show) about boards a few cells across,
// and is written to be read.

import { forEachNeighbour } from "../engine/field.js"
import { CELL_FLAGGED, CELL_HIDDEN, CELL_MINE, numberOn } from "../engine/view.js"

// what is known of a cell: one byte each, row after row, as everything about a board is kept
export const UNKNOWN = 0
export const SAFE = 1
export const MINE = 2

export type Reach = "counting" | "pairs" | "everything"

export type Position = {
  rows: number
  cols: number
  // as the player sees it, one character per cell (see shared/engine/view.ts). A flag is taken at its word
  cells: string
  // How many mines are still covered and unflagged, where the player is told: the counter of a board with every
  // mine accounted for. Only "everything" makes anything of it. Left out, nothing is known of how many there are
  minesLeft?: number
  // Numbers that are not to be listened to: what they say is left out. It is how to ask whether a position
  // proves the same without them
  silent?: readonly number[]
}

// A cell of a position that says nothing and has nothing under it, for a position that is only a piece of a
// board: a pattern by itself, with no board around it
export const NOTHING_THERE = " "

// "everything" tries every arrangement of the cells the numbers touch, which doubles with each cell: this many
// is far more than a round of training ever has, and few enough to be tried in an instant
export const TRIED_CELLS_MAX = 24

// What one number says: this many mines among these covered cells
type Clue = {
  at: number
  cells: number[]
  mines: number
}

// What the numbers say about the cells nothing is known of yet
function cluesOf({ rows, cols, cells, silent }: Position, known: Uint8Array): Clue[] {
  const clues: Clue[] = []
  for (let at = 0; at < cells.length; at++) {
    const number = numberOn(cells[at])
    if (number === null || silent?.includes(at)) continue
    const clue: Clue = { at, cells: [], mines: number }
    forEachNeighbour(rows, cols, at, (neighbour) => {
      const cell = cells[neighbour]
      if (cell === CELL_FLAGGED || cell === CELL_MINE || known[neighbour] === MINE) clue.mines--
      else if (cell === CELL_HIDDEN && known[neighbour] === UNKNOWN) clue.cells.push(neighbour)
    })
    if (clue.cells.length > 0) clues.push(clue)
  }
  return clues
}

// Marks cells as what they have been proved to be. Says whether that was news
function settle(known: Uint8Array, cells: number[], as: number): boolean {
  for (const cell of cells) known[cell] = as
  return cells.length > 0
}

// One number at a time: it needs no more mines, or it needs every cell it has left
function countingSettles(clues: Clue[], known: Uint8Array): boolean {
  let news = false
  for (const clue of clues) {
    if (clue.mines === 0) news = settle(known, clue.cells, SAFE) || news
    else if (clue.mines === clue.cells.length) news = settle(known, clue.cells, MINE) || news
  }
  return news
}

// the cells of one list that are not in another
const without = (cells: number[], other: number[]): number[] => cells.filter(cell => !other.includes(cell))

// Two numbers at a time. Take away the cells they share, and what is left is each one's own. The mines among the
// second's own, less the mines among the first's own, is the difference between what the two need. So where
// that difference is as big as it can possibly be (every one of the second's own a mine, none of the first's),
// that is how things are. Every pattern with two numbers in it is this, in one shape or another
function pairsSettle(clues: Clue[], known: Uint8Array, cols: number): boolean {
  let news = false
  for (let first = 0; first < clues.length; first++) {
    for (let second = first + 1; second < clues.length; second++) {
      const a = clues[first]
      const b = clues[second]
      // numbers further apart than this have no cell in common
      if (Math.abs(a.at % cols - b.at % cols) > 2 || Math.abs(Math.floor(a.at / cols) - Math.floor(b.at / cols)) > 2) continue
      const ownA = without(a.cells, b.cells)
      if (ownA.length === a.cells.length) continue
      const ownB = without(b.cells, a.cells)
      // a cell settled earlier in this same pass makes the clues it was in out of date: they are read again next pass
      if ([...a.cells, ...b.cells].some(cell => known[cell] !== UNKNOWN)) continue
      const more = b.mines - a.mines
      // (both halves are settled before either is asked whether it was news)
      if (more === ownB.length) news = [settle(known, ownB, MINE), settle(known, ownA, SAFE)].includes(true) || news
      else if (-more === ownA.length) news = [settle(known, ownA, MINE), settle(known, ownB, SAFE)].includes(true) || news
    }
  }
  return news
}

// Every way the mines could lie. The cells the numbers touch are given a mine or not, one after another, and a
// way is dropped the moment a number can no longer come out right. Of the cells no number touches, all that can
// be said is how many mines are left over for them, and that only where the count of mines is known
function tryingSettles(position: Position, clues: Clue[], known: Uint8Array): void {
  // in the order the numbers come to them, so that a number is finished, and can rule a way out, as early as possible
  const frontier: number[] = []
  const placeOf = new Map<number, number>()
  for (const clue of clues) {
    for (const cell of clue.cells) {
      if (placeOf.has(cell)) continue
      placeOf.set(cell, frontier.length)
      frontier.push(cell)
    }
  }
  if (frontier.length > TRIED_CELLS_MAX) throw new RangeError(`${frontier.length} cells are too many to try every way of`)

  // the covered cells no number says anything about, and the mines there are for them and the frontier between them
  const beyond: number[] = []
  let minesLeft = position.minesLeft ?? null
  for (let at = 0; at < position.cells.length; at++) {
    if (position.cells[at] !== CELL_HIDDEN) continue
    if (known[at] === MINE && minesLeft !== null) minesLeft--
    if (known[at] === UNKNOWN && !placeOf.has(at)) beyond.push(at)
  }

  const cluesAt: number[][] = frontier.map(() => [])
  clues.forEach((clue, index) => clue.cells.forEach(cell => cluesAt[placeOf.get(cell)!].push(index)))
  const needs = clues.map(clue => clue.mines)
  const open = clues.map(clue => clue.cells.length)

  // over every way that works: the cells that were ever a mine, and ever not, a bit each; and the fewest and the
  // most mines ever left over for the cells beyond
  let everMine = 0
  let everSafe = 0
  let leftOverMin = Infinity
  let leftOverMax = -Infinity
  let mines = 0
  let placed = 0

  const place = (index: number): void => {
    if (index === frontier.length) {
      const leftOver = minesLeft === null ? 0 : minesLeft - placed
      if (minesLeft !== null && (leftOver < 0 || leftOver > beyond.length)) return
      everMine |= mines
      everSafe |= ~mines
      leftOverMin = Math.min(leftOverMin, leftOver)
      leftOverMax = Math.max(leftOverMax, leftOver)
      return
    }
    for (let mine = 0; mine <= 1; mine++) {
      let works = true
      for (const clue of cluesAt[index]) {
        open[clue]--
        needs[clue] -= mine
        if (needs[clue] < 0 || needs[clue] > open[clue]) works = false
      }
      if (works) {
        mines |= mine << index
        placed += mine
        place(index + 1)
        mines &= ~(1 << index)
        placed -= mine
      }
      for (const clue of cluesAt[index]) {
        open[clue]++
        needs[clue] += mine
      }
    }
  }
  place(0)

  // no way works at all: the position contradicts itself (a flag in the wrong place), and proves nothing
  if (leftOverMin === Infinity) return
  frontier.forEach((cell, index) => {
    const bit = 1 << index
    if (!(everSafe & bit)) known[cell] = MINE
    else if (!(everMine & bit)) known[cell] = SAFE
  })
  if (minesLeft === null) return
  if (leftOverMax === 0) settle(known, beyond, SAFE)
  else if (leftOverMin === beyond.length) settle(known, beyond, MINE)
}

// What a position proves of each of its cells (UNKNOWN, SAFE or MINE), reasoning as far as `reach`. Anything
// `given` is taken as known already, and is in the answer: this is how to ask what follows from a pattern
export function proves(position: Position, reach: Reach, given?: Uint8Array): Uint8Array {
  const known = given ? given.slice() : new Uint8Array(position.cells.length)
  for (;;) {
    const clues = cluesOf(position, known)
    if (countingSettles(clues, known)) continue
    if (reach === "counting") break
    if (pairsSettle(clues, known, position.cols)) continue
    if (reach === "pairs") break
    // trying every way is the last word: there is nothing for the quicker rules to add to it
    tryingSettles(position, clues, known)
    break
  }
  return known
}

// What the numbers of a position prove one at a time, each from what is on show alone and none from what another
// has just proved: the first things counting finds, before anything is built on them
export function countingFirst(position: Position): Uint8Array {
  const known = new Uint8Array(position.cells.length)
  countingSettles(cluesOf(position, known), known)
  return known
}

export const provesAnything = (known: Uint8Array): boolean => known.some(verdict => verdict !== UNKNOWN)

// the cells proved to be one thing or the other, in order
export function cellsProved(known: Uint8Array, as: number): number[] {
  const cells: number[] = []
  known.forEach((verdict, at) => {
    if (verdict === as) cells.push(at)
  })
  return cells
}

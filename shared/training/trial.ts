// A round of training: a small board, part of it uncovered, made around one pattern.
//
// No two rounds of a pattern are the same board. The pattern's shape is laid down one of eight ways up, somewhere
// on a board of some size, against an edge or out in the open; more of the board is covered over around it, with
// mines of its own; and flags are scattered over what is uncovered, which changes the numbers on show. What
// stays the same is the shape, which is the thing to be learned.
//
// Most boards made that way are no use: some other number gives the answer away, or there is something else to
// work out besides. So each one is put to the solver (logic.ts), and kept only if the pattern is all there is to
// find on it, and there is no finding it without the pattern. Boards are small and the solver is quick, so a
// round is made in a thousandth of a second or so for all that most of what is tried is thrown away.

import { COVERED, FLAGGED, UNCOVERED, type Board } from "../engine/board.js"
import { fieldOf, forEachNeighbour } from "../engine/field.js"
import { CELL_HIDDEN, viewOf } from "../engine/view.js"
import { MINE, NOTHING_THERE, SAFE, UNKNOWN, cellsProved, countingFirst, proves, provesAnything, type Position } from "./logic.js"
import { patternOf, type Pattern, type PatternId } from "./patterns.js"
import type { Random } from "./random.js"
import { TURNS, coveredAround, touching, turned, type Template } from "./template.js"

export type Trial = {
  pattern: PatternId
  // which of the pattern's shapes it was made around
  shape: number
  // The count of the mines that are left is part of the round: the player is shown it, and what the board proves
  // is what it proves with it. There is no shape on such a board, and so none of the shape's cells below
  counted: boolean
  // the board as the round starts. Every flag on it is on a mine: they are part of what the player is shown
  board: Board
  // where the shape's numbers and its covered cells are on the board, in the order the shape has them
  numbers: number[]
  covered: number[]
  // the cells the pattern proves safe, and the ones it proves are mines
  safe: number[]
  mines: number[]
  // What there is to find, of each kind: finding all of either solves the round. They are the pattern's own, as
  // above. But where the pattern proves none of a kind, whatever cells of that kind follow from it stand in: the
  // cells left safe by a mine it has found are as good an answer to it as the mine
  find: { safe: number[], mines: number[] }
}

// How well a pattern is known, 0 to 2. The better it is known, the more there is around it to see past
export type Stage = 0 | 1 | 2

type Staging = {
  // how many cells of board there may be on each side of the shape, fewest and most
  margin: [number, number]
  // how many more times the covered part of the board spreads outwards, and how readily
  spreads: number
  spreading: number
  // how much of what is uncovered is a flagged mine
  flags: number
  // How often a pattern that isn't about flags has them beside its numbers all the same, so that what a number
  // shows is more than it needs. In a real game that is how a pattern is met more often than not, and it is the
  // last thing to learn to see through
  reduced: number
  // how much of the board may be covered, at most: a board that is mostly covered is hardly a board being played
  covered: number
}

const STAGES: Record<Stage, Staging> = {
  0: { margin: [0, 3], spreads: 0, spreading: 0, flags: 0.05, reduced: 0, covered: 0.6 },
  1: { margin: [0, 3], spreads: 1, spreading: 0.3, flags: 0.08, reduced: 0, covered: 0.65 },
  2: { margin: [0, 3], spreads: 2, spreading: 0.5, flags: 0.12, reduced: 0.5, covered: 0.7 },
}

// A shape lies on the edge of what is still unknown: the cells behind its covered ones are covered too, nearly
// always. (A strip of covered cells one cell deep, with numbers on both sides of it, is all but solved already.)
const BEHIND = 0.9

// how few and how many cells a board is across, either way
const SIDE_MIN = 4
const SIDE_MAX = 8
// how thickly the mines lie in the part of the board that is covered over around the shape: somewhere between these
const DENSITY_MIN = 0.2
const DENSITY_MAX = 0.45
// a round's numbers touch at most this many covered cells: past that it is a puzzle, and not a pattern to be seen at a glance
const FRONTIER_MAX = 20
// ...and it has at most this many cells of a kind to find
const FIND_MAX = 5
// how often a number that gives the game away is replaced by a flag, rather than covered over
const CAPPED = 0.5
// how many times a board is gone over for numbers that give the game away, before it is given up on
const SETTLING_MAX = 40
// how many boards are tried before giving up on making a round at all
const ATTEMPTS = 5000

// Every way the cells a shape proves nothing about can hold mines so that its numbers come out right: a bit for
// each such cell, in the order the shape has them
const waysKept = new WeakMap<Template, number[]>()
function waysOf(template: Template): number[] {
  const kept = waysKept.get(template)
  if (kept) return kept
  const open = template.covered.flatMap((cell, index) => (cell.proven === "nothing" ? [index] : []))
  const ways: number[] = []
  for (let way = 0; way < 1 << open.length; way++) {
    const mineAt = (index: number) => template.covered[index].proven === "mine" || (open.includes(index) && (way >> open.indexOf(index) & 1) === 1)
    if (template.numbers.every(number => coveredAround(template, number).filter(mineAt).length === number.needs)) ways.push(way)
  }
  waysKept.set(template, ways)
  return ways
}

// A shape with no board around it, as a position for the solver: its numbers showing what they need, its covered
// cells covered, and nothing else there at all. `numbers` and `covered` are where its cells are in that position
export function bare(template: Template): { position: Position, numbers: number[], covered: number[] } {
  const rows = template.rows + 2
  const cols = template.cols + 2
  const cellOf = (cell: { row: number, col: number }) => (cell.row + 1) * cols + cell.col + 1
  const cells = new Array<string>(rows * cols).fill(NOTHING_THERE)
  for (const number of template.numbers) cells[cellOf(number)] = String(number.needs)
  for (const cell of template.covered) cells[cellOf(cell)] = CELL_HIDDEN
  return { position: { rows, cols, cells: cells.join("") }, numbers: template.numbers.map(cellOf), covered: template.covered.map(cellOf) }
}

// The numbers of a shape it proves nothing at all without, by their place among its numbers. A 1-2 is nothing
// without either of its two; a 1-2-1 is still half of itself without one of its 1s
const essentialKept = new WeakMap<Template, number[]>()
function essentialOf(template: Template): number[] {
  const kept = essentialKept.get(template)
  if (kept) return kept
  const { position, numbers } = bare(template)
  const essential = numbers.flatMap((number, index) => (provesAnything(proves({ ...position, silent: [number] }, "everything")) ? [] : [index]))
  essentialKept.set(template, essential)
  return essential
}

// A side of a shape that is covered cells and no numbers lies along the edge of the board this often, with
// nothing behind it: a pocket left at the border of a board that is otherwise opened up, which is where most of
// these patterns are met
const FLUSH = 0.7

// What a side of a shape wants of the board beyond it. "covered": it is the shape's covered side, and is best
// against the edge. "room": a number of the board's own will lie along it, touching the shape's covered cells,
// and that number wants covered cells of its own to touch, so there has to be board there. "either": anything
type Side = "covered" | "room" | "either"

// How much board there is before a shape and in all, along one way across it. `least` and `most` are how many
// cells there may be on each side, where the side has no wants of its own
function span(inner: number, sides: [Side, Side], [least, most]: [number, number], random: Random): { before: number, size: number } {
  const margin = (side: Side) => (side === "covered" && random.chance(FLUSH) ? 0 : random.between(side === "room" ? Math.max(1, least) : least, most))
  const floor = (side: Side) => (side === "room" ? 1 : 0)
  let before = margin(sides[0])
  let after = margin(sides[1])
  while (inner + before + after > SIDE_MAX && before + after > floor(sides[0]) + floor(sides[1])) {
    if (before - floor(sides[0]) >= after - floor(sides[1])) before--
    else after--
  }
  const flush = [sides[0] === "covered", sides[1] === "covered"]
  // room is made on a side that has numbers along it, where there is one: the board grows on its opened side
  while (inner + before + after < SIDE_MIN) {
    if (flush[0] !== flush[1] ? flush[0] : random.chance(0.5)) after++
    else before++
  }
  return { before, size: inner + before + after }
}

// A number that, with the number next to it, proves something the way a pattern does (see `pairsSettle` in
// logic.ts): the one of the two that isn't the shape's own, or either if neither is. None if no two numbers do,
// but for the shape's own (`ofShape`), which are meant to. `withShape` is whether one of the shape's numbers and
// one that isn't count as two that shouldn't
function pairedTeller<Clue extends { at: number, needs: number, around: number[] }>(clues: Clue[], ofShape: Uint8Array, cols: number, random: Random, withShape: boolean): Clue | null {
  for (let first = 0; first < clues.length; first++) {
    for (let second = first + 1; second < clues.length; second++) {
      const a = clues[first]
      const b = clues[second]
      // (where the shape is one number speaking alone, what it makes of the number next to it is only what follows)
      if (withShape ? ofShape[a.at] && ofShape[b.at] : ofShape[a.at] || ofShape[b.at]) continue
      if (Math.abs(a.at % cols - b.at % cols) > 2 || Math.abs(Math.floor(a.at / cols) - Math.floor(b.at / cols)) > 2) continue
      const ownA = a.around.filter(cell => !b.around.includes(cell))
      if (ownA.length === a.around.length) continue
      const ownB = b.around.filter(cell => !a.around.includes(cell))
      if (ownA.length + ownB.length === 0) continue
      const more = b.needs - a.needs
      if (more !== ownB.length && -more !== ownA.length) continue
      return ofShape[a.at] ? b : ofShape[b.at] ? a : random.pick([a, b])
    }
  }
  return null
}

// a round before it has been found to be one: its board, and nothing yet of what there is to find on it
type Draft = Omit<Trial, "find">

const across = (along: "row" | "col"): "row" | "col" => (along === "row" ? "col" : "row")

// Whether a number of a shape has, on a line of the shape, a cell beside it that isn't one of the shape's covered
// cells: itself, if it is on that line, or a cell of the line next to it that the shape leaves open
function neighboursOnLine(template: Template, number: { row: number, col: number }, along: "row" | "col", line: number): boolean {
  if (number[along] === line) return true
  if (Math.abs(number[along] - line) !== 1) return false
  const other = across(along)
  const length = other === "row" ? template.rows : template.cols
  for (let at = Math.max(0, number[other] - 1); at <= Math.min(length - 1, number[other] + 1); at++) {
    if (!template.covered.some(cell => cell[along] === line && cell[other] === at)) return true
  }
  return false
}

// A board made around a shape, whether or not it is any use as a round. Null if it couldn't be finished
function draft(pattern: Pattern, shapeIndex: number, stage: Stage, random: Random): Draft | null {
  const drawn = pattern.shapes[shapeIndex].template
  const template = turned(drawn, random.below(TURNS))
  const staging = STAGES[stage]
  // Whether a line of the shape (a row or a column of it) is its covered side: covered cells, and nothing else
  // that matters. Not a number, and not a cell beside one either, which is a number of the board's own and wants
  // board beyond it
  const coveredLine = (along: "row" | "col", line: number) =>
    template.covered.some(cell => cell[along] === line) && !template.numbers.some(number => neighboursOnLine(template, number, along, line))
  // ...or has on it a cell the shape leaves open that is beside one of the shape's numbers and touches one of its
  // covered cells: a number of the board's own, which wants board beyond it
  const openLine = (along: "row" | "col", line: number) => {
    const other = across(along)
    for (let at = 0; at < (other === "row" ? template.rows : template.cols); at++) {
      const here = { [along]: line, [other]: at } as { row: number, col: number }
      const isCell = (cell: { row: number, col: number }) => cell.row === here.row && cell.col === here.col
      if (template.covered.some(isCell) || template.numbers.some(isCell)) continue
      if (template.numbers.some(number => touching(number, here)) && template.covered.some(cell => touching(cell, here))) return true
    }
    return false
  }
  const sideOf = (along: "row" | "col", line: number): Side => (coveredLine(along, line) ? "covered" : openLine(along, line) ? "room" : "either")
  const down = span(template.rows, [sideOf("row", 0), sideOf("row", template.rows - 1)], staging.margin, random)
  const wide = span(template.cols, [sideOf("col", 0), sideOf("col", template.cols - 1)], staging.margin, random)
  const rows = down.size
  const cols = wide.size
  const cellOf = (cell: { row: number, col: number }) => (cell.row + down.before) * cols + cell.col + wide.before
  const numbers = template.numbers.map(cellOf)
  const covered = template.covered.map(cellOf)

  // Everything starts out uncovered but the shape's own covered cells
  const cells = new Uint8Array(rows * cols).fill(UNCOVERED)
  // the shape's own cells, which stay as the shape has them
  const fixed = new Uint8Array(rows * cols)
  // the cells beside one of its numbers, which stay uncovered: its numbers touch the covered cells it is drawn
  // with and no others
  const beside = new Uint8Array(rows * cols)
  for (const cell of covered) {
    cells[cell] = COVERED
    fixed[cell] = 1
  }
  for (const number of numbers) {
    fixed[number] = 1
    forEachNeighbour(rows, cols, number, (neighbour) => { beside[neighbour] = 1 })
  }
  const touches = (at: number, what: number): boolean => {
    let found = false
    forEachNeighbour(rows, cols, at, (neighbour) => { found ||= cells[neighbour] === what })
    return found
  }
  // A number of the board's own that touches exactly the covered cells one of the shape's numbers does is that
  // number's twin: it says the same thing, no more and no less, and is left to say it
  const coveredAt = (at: number): number[] => {
    const around: number[] = []
    forEachNeighbour(rows, cols, at, (neighbour) => {
      if (cells[neighbour] === COVERED) around.push(neighbour)
    })
    return around
  }
  const said = new Set(template.numbers.map(number => String(coveredAround(template, number).map(index => covered[index]).sort((a, b) => a - b))))
  const isTwin = (around: number[]) => said.has(String(around))

  // The covered part of the board spreads out from there, a ring of cells at a time: the cells behind the shape's
  // own first, and then as far again as the stage has it
  for (let spread = 0; spread <= staging.spreads; spread++) {
    const readily = spread === 0 ? BEHIND : staging.spreading
    const next: number[] = []
    for (let at = 0; at < cells.length; at++) {
      if (cells[at] === UNCOVERED && !fixed[at] && !beside[at] && touches(at, COVERED) && random.chance(readily)) next.push(at)
    }
    for (const at of next) cells[at] = COVERED
  }

  // A number beside the shape that touches the shape's covered cells and no others can say nothing about them
  // but the truth, and there would be nothing about it to change. It is given one covered cell of its own to
  // touch, where there is one to give: the covered part of the board goes on a little past the end of the shape
  for (let at = 0; at < cells.length; at++) {
    if (cells[at] !== UNCOVERED || fixed[at] || !beside[at]) continue
    let touchesShape = false
    let touchesMore = false
    const spare: number[] = []
    forEachNeighbour(rows, cols, at, (neighbour) => {
      if (cells[neighbour] === COVERED) {
        if (fixed[neighbour]) touchesShape = true
        else touchesMore = true
      } else if (!fixed[neighbour] && !beside[neighbour]) spare.push(neighbour)
    })
    if (touchesShape && !touchesMore && spare.length > 0 && !isTwin(coveredAt(at))) cells[random.pick(spare)] = COVERED
  }

  // Flags, on mines that have been found already. Beside the shape's own numbers only where the pattern is one
  // about flags, or is known well enough by now to be met the way it mostly is in a game: behind them
  const reduced = pattern.flags === "always" || random.chance(staging.reduced)
  const mayFlag = (at: number) => cells[at] === UNCOVERED && !fixed[at] && (reduced || !beside[at])
  for (let at = 0; at < cells.length; at++) {
    if (mayFlag(at) && random.chance(staging.flags)) cells[at] = FLAGGED
  }
  if (reduced) {
    // ...and there, every number that needs no more mines has at least one flag to show for it (a number is never
    // 0 beside a covered cell), and at least one number of the shape has a flag whatever it needs
    const flagless = (number: number) => !touches(number, FLAGGED)
    const wanting = numbers.filter((number, index) => template.numbers[index].needs === 0 && flagless(number))
    if (wanting.length === 0 && numbers.every(flagless)) wanting.push(random.pick(numbers))
    for (const number of wanting) {
      const room: number[] = []
      forEachNeighbour(rows, cols, number, (neighbour) => {
        if (mayFlag(neighbour)) room.push(neighbour)
      })
      if (room.length === 0) return null
      cells[random.pick(room)] = FLAGGED
    }
  }

  // The mines: under every flag; in the shape's covered cells, as the shape says and one of the ways it leaves
  // open; and by chance in the rest of what is covered
  const mines = new Uint8Array(rows * cols)
  const way = random.pick(waysOf(drawn))
  let undecided = 0
  template.covered.forEach((cell, index) => {
    mines[covered[index]] = cell.proven === "mine" || (cell.proven === "nothing" && (way >> undecided++ & 1) === 1) ? 1 : 0
  })
  const density = DENSITY_MIN + (DENSITY_MAX - DENSITY_MIN) * random.below(1000) / 1000
  const byChance = () => (random.chance(density) ? 1 : 0)
  for (let at = 0; at < cells.length; at++) {
    if (cells[at] === FLAGGED) mines[at] = 1
    else if (cells[at] === COVERED && !fixed[at]) mines[at] = byChance()
  }

  // Where the pattern is itself one number speaking alone, another that says the very same of the very same cells
  // gives nothing more away: two numbers at the tip of one covered cell both say it is a mine
  const provenAs = (as: string) => (cell: number) => template.covered[covered.indexOf(cell)]?.proven === as
  const echoes = (clue: Clue) => pattern.needs === "counting" && clue.around.every(provenAs(clue.needs === 0 ? "safe" : "mine"))
  const making: Making = { rows, cols, cells, mines, fixed, beside }
  if (!quieten(making, random, byChance, { isTwin, echoes, pairsWithShape: pattern.needs !== "counting" })) return null

  const board = boardOf(making)
  if (cells.length - board.uncovered - board.flagged > staging.covered * cells.length) return null
  const proven = (as: string) => covered.filter((_, index) => template.covered[index].proven === as)
  return { pattern: pattern.id, shape: shapeIndex, counted: false, board, numbers, covered, safe: proven("safe"), mines: proven("mine") }
}

// How many cells across a board is, and how many it has covered, where the count of mines is what the round is
// about: small, with little left on it, as a board is when the count starts to matter
const COUNTED_SIDE: Record<Stage, [number, number]> = { 0: [4, 5], 1: [4, 6], 2: [5, 6] }
const COUNTED_COVERED: [number, number] = [4, 9]
// ...and never this much of the board
const COUNTED_COVERED_SHARE = 0.45
const COUNTED_POCKETS_MAX = 3

// A board near its end, with what is still covered in a pocket or two and nothing drawn on it: for the patterns
// that are about how many mines are left. Whether the count says anything on it is found out afterwards
function draftCounted(pattern: Pattern, stage: Stage, random: Random): Draft | null {
  const rows = random.between(...COUNTED_SIDE[stage])
  const cols = random.between(...COUNTED_SIDE[stage])
  const cells = new Uint8Array(rows * cols).fill(UNCOVERED)
  const mines = new Uint8Array(rows * cols)

  // the pockets: each starts somewhere and takes in cells next to it until it is as big as it is going to be
  let left = random.between(...COUNTED_COVERED)
  for (let pocket = random.between(1, COUNTED_POCKETS_MAX); pocket > 0 && left > 0; pocket--) {
    const size = pocket === 1 ? left : random.between(1, left)
    left -= size
    const grown = [random.below(cells.length)]
    cells[grown[0]] = COVERED
    while (grown.length < size) {
      const next: number[] = []
      for (const cell of grown) {
        forEachNeighbour(rows, cols, cell, (neighbour) => {
          if (cells[neighbour] === UNCOVERED) next.push(neighbour)
        })
      }
      if (next.length === 0) break
      const taken = random.pick(next)
      cells[taken] = COVERED
      grown.push(taken)
    }
  }
  const density = DENSITY_MIN + (DENSITY_MAX - DENSITY_MIN) * random.below(1000) / 1000
  const byChance = () => (random.chance(density) ? 1 : 0)
  for (let at = 0; at < cells.length; at++) {
    if (cells[at] === COVERED) mines[at] = byChance()
    else if (random.chance(STAGES[stage].flags * 2)) {
      // a board near its end has most of its mines found
      cells[at] = FLAGGED
      mines[at] = 1
    }
  }

  const none = new Uint8Array(cells.length)
  const making: Making = { rows, cols, cells, mines, fixed: none, beside: none }
  if (!quieten(making, random, byChance, { isTwin: () => false, echoes: () => false, pairsWithShape: true, staysOpen: true })) return null
  const board = boardOf(making)
  if (cells.length - board.uncovered - board.flagged > COUNTED_COVERED_SHARE * cells.length) return null
  return { pattern: pattern.id, shape: 0, counted: true, board, numbers: [], covered: [], safe: [], mines: [] }
}

// A board being made: what each of its cells is, where its mines are, and which of its cells are not to be changed
type Making = {
  rows: number
  cols: number
  // COVERED, UNCOVERED or FLAGGED, a byte a cell, as a board has them
  cells: Uint8Array
  mines: Uint8Array
  // a shape's own cells, which stay as the shape has them, and the cells beside its numbers, which stay uncovered.
  // None of either, on a board with no shape on it
  fixed: Uint8Array
  beside: Uint8Array
}

// What a number of a board being made says: what it shows, what that leaves it needing once its flags are taken
// off, the covered cells it touches, and the uncovered ones beside it that could be covered over
type Clue = { at: number, shows: number, needs: number, around: number[], spare: number[] }

type Shaped = {
  // whether a number touching exactly these covered cells is the twin of one of the shape's own
  isTwin: (around: number[]) => boolean
  // whether a number speaking alone only says what the shape itself says alone
  echoes: (clue: Clue) => boolean
  // whether one of the shape's numbers and one that isn't count as two that shouldn't speak together
  pairsWithShape: boolean
  // Nothing more of the board is to be covered over than is already: a number that has to go becomes a flag. For
  // a board near its end, which is mostly open and stays so
  staysOpen?: boolean
}

// Makes a board say nothing it shouldn't. As a board is first laid out, a number somewhere will as likely as not
// give the game away: by itself (it has nothing left to find, or exactly as many covered cells as it needs), or
// between it and the number next to it, the very way a pattern's own numbers do. The first one found is made to
// say less, in the way that changes the board least, and the board is looked over again, until nothing on it
// speaks but what is meant to. False if that can't be done
function quieten(making: Making, random: Random, byChance: () => number, shaped: Shaped): boolean {
  const { rows, cols, cells, mines, fixed, beside } = making
  const speaksAlone = (clue: Clue) => clue.needs === 0 || clue.needs === clue.around.length
  for (let pass = 0; pass < SETTLING_MAX; pass++) {
    const counts = fieldOf(rows, cols, mines).counts
    const clues: Clue[] = []
    for (let at = 0; at < cells.length; at++) {
      if (cells[at] !== UNCOVERED) continue
      const clue: Clue = { at, shows: counts[at], needs: counts[at], around: [], spare: [] }
      forEachNeighbour(rows, cols, at, (neighbour) => {
        if (cells[neighbour] === COVERED) clue.around.push(neighbour)
        else if (cells[neighbour] === FLAGGED) clue.needs--
        else if (!fixed[neighbour] && !beside[neighbour]) clue.spare.push(neighbour)
      })
      if (clue.around.length > 0) clues.push(clue)
    }

    // the shape's own numbers and their twins, which are meant to speak
    const ofShape = new Uint8Array(cells.length)
    for (const clue of clues) ofShape[clue.at] = fixed[clue.at] || shaped.isTwin(clue.around) ? 1 : 0
    // (a number with nothing around it at all is never left beside a covered cell, whoever's it is: no board has one)
    const alone = clues.find(clue => clue.shows === 0 || (!ofShape[clue.at] && speaksAlone(clue) && !shaped.echoes(clue)))
    const teller = alone ?? pairedTeller(clues, ofShape, cols, random, shaped.pairsWithShape)
    if (!teller) return true
    // of the covered cells it touches, the ones that aren't the shape's: whether they are mines is open to change
    const loose = teller.around.filter(cell => !fixed[cell])
    const ways: (() => void)[] = []
    if (teller.around.length >= 2 && loose.length > 0) {
      ways.push(() => {
        const cell = random.pick(loose)
        // a mine, where the number had none to find; not one, where every cell was; and otherwise the other of the two
        mines[cell] = teller.needs === 0 ? 1 : teller.needs === teller.around.length ? 0 : 1 - mines[cell]
      })
    }
    // a number that speaks by itself is put right the first way there is, which changes the board least
    if (ways.length === 0 || !alone) {
      if (!beside[teller.at]) {
        // it goes itself: covered over, or turned into a mine that has been found, which says nothing at all
        ways.push(() => {
          cells[teller.at] = shaped.staysOpen || random.chance(CAPPED) ? FLAGGED : COVERED
          mines[teller.at] = cells[teller.at] === FLAGGED ? 1 : byChance()
        })
      }
      if (teller.spare.length > 0 && !shaped.staysOpen) {
        // it gets one more covered cell to be unsure about
        ways.push(() => {
          const extra = random.pick(teller.spare)
          cells[extra] = COVERED
          mines[extra] = teller.needs === 0 ? 1 : teller.needs === teller.around.length ? 0 : byChance()
        })
      }
    }
    if (ways.length === 0) return false
    random.pick(ways)()
  }
  return false
}

// What has been made, as a board to play on
function boardOf({ rows, cols, cells, mines }: Making): Board {
  // a flag out in the covered part of the board, touching nothing uncovered, is a flag nobody could have placed
  for (let at = 0; at < cells.length; at++) {
    if (cells[at] !== FLAGGED) continue
    let touchesUncovered = false
    forEachNeighbour(rows, cols, at, (neighbour) => { touchesUncovered ||= cells[neighbour] === UNCOVERED })
    if (!touchesUncovered) cells[at] = COVERED
  }
  let uncovered = 0
  let flagged = 0
  for (let at = 0; at < cells.length; at++) {
    if (cells[at] === FLAGGED) flagged++
    else if (cells[at] === UNCOVERED) uncovered++
  }
  return { field: fieldOf(rows, cols, mines), cells, uncovered, flagged, status: "playing" }
}

// A board as its player sees it, for the solver. `counted` is whether they are told how many mines are left
export function positionOf(board: Board, counted = false): Position {
  const position = { rows: board.field.rows, cols: board.field.cols, cells: viewOf(board) }
  return counted ? { ...position, minesLeft: minesLeft(board) } : position
}

// how many mines of a board are neither flagged nor uncovered: what its counter shows
export const minesLeft = (board: Board): number => board.field.mineCount - board.flagged

const same = (a: Uint8Array, b: Uint8Array): boolean => a.every((verdict, at) => verdict === b[at])

// A round as it comes out of the weighing: what the pattern proves on it, where that isn't drawn, and what there is to find
type Weighed = Pick<Trial, "safe" | "mines" | "find">

// Whether a board is any use as a round of its pattern: what there is to find on it, or what is wrong with it
function weigh(trial: Draft): Weighed | { flaw: string } {
  const pattern = patternOf(trial.pattern)
  const { board, numbers } = trial
  const position = positionOf(board)
  const { rows, cols } = board.field
  // the covered cells a number touches
  const touched = new Uint8Array(board.cells.length)
  let frontier = 0
  for (let at = 0; at < board.cells.length; at++) {
    if (board.cells[at] !== COVERED) continue
    forEachNeighbour(rows, cols, at, (neighbour) => { touched[at] ||= board.cells[neighbour] === UNCOVERED ? 1 : 0 })
    frontier += touched[at]
  }
  if (frontier > FRONTIER_MAX) return { flaw: "there is too much of it to take in" }

  if (trial.counted) {
    // Nothing is to be had without the count of mines, and something with it. Which of the two patterns it is a
    // round of goes by where: cells that no number touches at all (the mines are all accounted for elsewhere), or
    // cells the numbers do touch (a mine there, or none, and the numbers could not be met with what is left)
    const left = minesLeft(board)
    const coveredCells = board.cells.length - board.uncovered - board.flagged
    if (left === 0 || left === coveredCells) return { flaw: "the count says it all" }
    if (provesAnything(proves(position, "everything"))) return { flaw: "it can be done without the count" }
    const known = proves(positionOf(board, true), "everything")
    const safe = cellsProved(known, SAFE)
    const mines = cellsProved(known, MINE)
    if (safe.length + mines.length === 0) return { flaw: "the count proves nothing" }
    if (Math.max(safe.length, mines.length) > FIND_MAX) return { flaw: "there is too much to find" }
    const untouched = [...safe, ...mines].every(cell => !touched[cell])
    if (untouched !== (pattern.counted === "untouched")) return { flaw: "it is the other pattern about the count" }
    return { safe, mines, find: { safe, mines } }
  }

  // what the pattern proves, cell by cell of the board
  const told = new Uint8Array(board.cells.length)
  for (const cell of trial.safe) told[cell] = SAFE
  for (const cell of trial.mines) told[cell] = MINE

  if (pattern.needs === "counting") {
    // the first thing counting finds is the pattern, and not something else beside it
    if (!countingFirst(position).every((verdict, at) => verdict === UNKNOWN || verdict === told[at])) return { flaw: "counting finds something else first" }
  } else {
    if (provesAnything(proves(position, "counting"))) return { flaw: "counting is enough to start on it" }
    if (pattern.needs === "everything" && provesAnything(proves(position, "pairs"))) return { flaw: "a pair of numbers is enough to start on it" }
  }

  // The pattern is all there is to work out: whatever else the board proves follows from it by plain counting
  // (a number that has its mines, now that one of them is known)...
  const everything = proves(position, "everything")
  if (!same(everything, proves(position, "counting", told))) return { flaw: "there is more to work out than the pattern" }
  // ...and there is no starting any other way: not with the rest of the board alone, and not with the pattern
  // short of a number it cannot do without
  // (A number of the board's own that touches the very cells one of the pattern's does is that number's twin, and
  // counts as it: it is the same number in another place.)
  const template = pattern.shapes[trial.shape].template
  const coveredAt = (at: number): string => {
    const around: number[] = []
    forEachNeighbour(rows, cols, at, (neighbour) => {
      if (board.cells[neighbour] === COVERED) around.push(neighbour)
    })
    return String(around)
  }
  const speakers = Array.from(board.cells.keys()).filter(at => board.cells[at] === UNCOVERED)
  const withTwins = (number: number): number[] => speakers.filter(at => coveredAt(at) === coveredAt(number))
  const without = (silent: number[]) => provesAnything(proves({ ...position, silent }, "everything"))
  if (without(numbers.flatMap(withTwins))) return { flaw: "it can be done without the pattern" }
  if (essentialOf(template).some(index => without(withTwins(numbers[index])))) return { flaw: "it can be done without all of the pattern" }

  const find = {
    safe: trial.safe.length > 0 ? trial.safe : cellsProved(everything, SAFE),
    mines: trial.mines.length > 0 ? trial.mines : cellsProved(everything, MINE),
  }
  if (Math.max(find.safe.length, find.mines.length) > FIND_MAX) return { flaw: "there is too much to find" }
  return { safe: trial.safe, mines: trial.mines, find }
}

// What is wrong with a round, if anything is: null for one that is sound. (Every round `makeTrial` gives is. The
// tests say so of each of them, from the outside.)
export function flawOf(trial: Trial): string | null {
  const weighed = weigh(trial)
  if ("flaw" in weighed) return weighed.flaw
  const agree = (a: number[], b: number[]) => a.length === b.length && a.every((cell, index) => cell === b[index])
  return agree(weighed.find.safe, trial.find.safe) && agree(weighed.find.mines, trial.find.mines) ? null : "what there is to find on it is not what it proves"
}

// Makes a round of a pattern. At a stage where none can be made, which the tests find never happens, an easier
// one is made in its place
export function makeTrial(pattern: Pattern, stage: Stage, random: Random): Trial {
  for (const at of stage === 0 ? [stage] : [stage, 0 as Stage]) {
    const made = makeTrialWithin(pattern, at, random, ATTEMPTS).trial
    if (made) return made
  }
  throw new Error(`No round of ${pattern.name} could be made`)
}

// Makes a round within so many boards, or doesn't. Says how many it took, and what was wrong with each of the rest,
// which is how the making of rounds is tuned
export function makeTrialWithin(pattern: Pattern, stage: Stage, random: Random, attempts: number): { trial: Trial | null, tried: number, flaws: Record<string, number> } {
  const flaws: Record<string, number> = {}
  for (let tried = 1; tried <= attempts; tried++) {
    const drafted = pattern.counted ? draftCounted(pattern, stage, random) : draft(pattern, random.below(pattern.shapes.length), stage, random)
    const weighed = drafted ? weigh(drafted) : { flaw: "it couldn't be laid out" }
    if (drafted && "find" in weighed) return { trial: { ...drafted, ...weighed }, tried, flaws }
    if ("flaw" in weighed) flaws[weighed.flaw] = (flaws[weighed.flaw] ?? 0) + 1
  }
  return { trial: null, tried: attempts, flaws }
}

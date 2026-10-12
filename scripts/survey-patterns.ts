// How much of real play the patterns that are taught explain.
//
//   npm run survey:patterns                  200 Expert boards
//   npm run survey:patterns -- 500 intermediate 20
//                                            that many boards, of that size, and that many positions printed
//
// It plays boards the game would deal (ones that need no guess) the way a player who knew nothing but counting
// would, and every time counting runs out it asks what the way on is: one of the patterns in the catalogue
// (shared/training/patterns.ts), or two numbers in a shape the catalogue doesn't have, or something that takes
// more than two numbers. It says how often each of those it is, how often each pattern turned up, and prints
// some of the positions that two numbers settle and no pattern covers: those are the shapes worth adding.

import { COVERED, UNCOVERED, coveredBoard, toggleFlag, uncover, type Board } from "../shared/engine/board"
import { forEachNeighbour } from "../shared/engine/field"
import { generateField } from "../shared/engine/generate"
import { BOARD_PRESETS, boardSize } from "../shared/game/boards"
import { MINE, SAFE, UNKNOWN, proves, provesAnything } from "../shared/training/logic"
import { patternsIn } from "../shared/training/match"
import { PATTERNS, patternOf } from "../shared/training/patterns"
import { positionOf } from "../shared/training/trial"

const [boardsAsked = "200", presetAsked = "expert", samplesAsked = "12"] = process.argv.slice(2)
const preset = BOARD_PRESETS.find(candidate => candidate.id === presetAsked) ?? BOARD_PRESETS[2]
const BOARDS = Number(boardsAsked)
const SAMPLES = Number(samplesAsked)
// What a player works out without being taught anything is not what the survey is about. Nor are the patterns
// that are other patterns behind flags (every pattern is looked for behind flags as well as without), nor the
// ones about the count of mines, which have no shape to look for
const taught = PATTERNS.filter(pattern => pattern.needs !== "counting" && pattern.family !== "reduction" && !pattern.counted)

// The same boards every time it is run, and every one of them a different board: the bytes of a seed are stirred
// out of the board's number, a step of a simple generator apiece
function seedOf(board: number): Uint8Array {
  let state = (board + 1) * 0x9e3779b1
  return Uint8Array.from({ length: 16 }, () => {
    state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x297a2d39
    return (state >>> 24) & 0xff
  })
}

// A board with what has been proved of it done: the safe cells uncovered, the mines flagged
function done(board: Board, known: Uint8Array): Board {
  let next = board
  known.forEach((verdict, at) => {
    if (next.cells[at] !== COVERED) return
    if (verdict === SAFE) next = uncover(next, at).board
    else if (verdict === MINE) next = toggleFlag(next, at)
  })
  return next
}

// a few cells around one, as the player sees them, with what was proved marked: "s" safe, "*" a mine
function drawn(board: Board, known: Uint8Array, around: number): string {
  const { rows, cols, counts } = board.field
  const row = Math.floor(around / cols)
  const col = around % cols
  const lines: string[] = []
  for (let r = Math.max(0, row - 3); r <= Math.min(rows - 1, row + 3); r++) {
    let line = ""
    for (let c = Math.max(0, col - 4); c <= Math.min(cols - 1, col + 4); c++) {
      const at = r * cols + c
      line += known[at] === SAFE ? "s" : known[at] === MINE ? "*" : board.cells[at] === COVERED ? "#" : board.cells[at] !== UNCOVERED ? "F" : counts[at] === 0 ? "." : String(counts[at])
    }
    lines.push(`    ${line}`)
  }
  return lines.join("\n")
}

let stuck = 0
let byPattern = 0
let byPair = 0
let byMore = 0
// how many times each pattern was there, and how many of those it had flags beside its numbers
const seen = new Map<string, { times: number, flagged: number }>()
const unnamed: string[] = []

for (let index = 0; index < BOARDS; index++) {
  const { field, opening } = generateField(preset.settings, seedOf(index))
  let board = uncover(coveredBoard(field), opening).board
  while (board.status === "playing") {
    const position = positionOf(board)
    const counted = proves(position, "counting")
    if (provesAnything(counted)) {
      board = done(board, counted)
      continue
    }
    stuck++

    const found = patternsIn(position, taught)
    if (found.length > 0) {
      byPattern++
      for (const pattern of new Set(found.map(match => match.pattern))) {
        const name = patternOf(pattern).name
        const count = seen.get(name) ?? { times: 0, flagged: 0 }
        count.times++
        if (found.some(match => match.pattern === pattern && match.flagged)) count.flagged++
        seen.set(name, count)
      }
      const told = new Uint8Array(board.cells.length)
      for (const match of found) {
        patternOf(match.pattern).shapes[match.shape].template.covered.forEach((cell, at) => {
          if (cell.proven !== "nothing") told[match.covered[at]] = cell.proven === "mine" ? MINE : SAFE
        })
      }
      board = done(board, told)
      continue
    }

    // (only what two numbers say of the position as it stands: nothing built on that yet)
    const paired = proves(position, "pairs")
    if (provesAnything(paired)) {
      byPair++
      if (unnamed.length < SAMPLES) unnamed.push(drawn(board, paired, paired.findIndex(verdict => verdict !== UNKNOWN)))
      board = done(board, paired)
      continue
    }

    // More than two numbers at once, or the count of mines. The player is told one safe cell beside a number,
    // and goes on from there
    byMore++
    const safe = Array.from(board.cells.keys()).find((at) => {
      if (board.cells[at] !== COVERED || field.mines[at]) return false
      let besideNumber = false
      forEachNeighbour(field.rows, field.cols, at, (neighbour) => { besideNumber ||= board.cells[neighbour] === UNCOVERED })
      return besideNumber
    })
    if (safe === undefined) break
    board = uncover(board, safe).board
  }
}

const share = (count: number) => `${count.toString().padStart(6)}  ${(100 * count / Math.max(1, stuck)).toFixed(1).padStart(5)}%`
console.log(`${BOARDS} boards, ${preset.label} (${boardSize(preset.settings)}), none needing a guess`)
console.log(`Counting ran out ${stuck} times, ${(stuck / BOARDS).toFixed(1)} a board. The way on was:`)
console.log(`  a pattern that is taught        ${share(byPattern)}`)
console.log(`  two numbers, in no taught shape ${share(byPair)}`)
console.log(`  more than two numbers           ${share(byMore)}`)
console.log("\nHow often each pattern was there to be used, and how much of that was behind flags:")
for (const [name, { times, flagged }] of [...seen].sort((a, b) => b[1].times - a[1].times)) {
  console.log(`  ${name.padEnd(18)} ${share(times)}   ${Math.round(100 * flagged / times).toString().padStart(3)}% behind flags`)
}
const never = taught.filter(pattern => !seen.has(pattern.name)).map(pattern => pattern.name)
if (never.length > 0) console.log(`  never: ${never.join(", ")}`)
if (unnamed.length > 0) {
  console.log("\nSome of what two numbers settled that no taught pattern covers (\"s\" safe, \"*\" a mine):")
  console.log(unnamed.join("\n\n"))
}

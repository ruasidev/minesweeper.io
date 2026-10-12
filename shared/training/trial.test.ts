import { describe, expect, it } from "vitest"
import { COVERED, FLAGGED, UNCOVERED } from "../engine/board.js"
import { forEachNeighbour } from "../engine/field.js"
import { draw, seedFrom } from "../engine/testing.js"
import { walkThrough } from "./explain.js"
import { MINE, SAFE, cellsProved, proves, provesAnything } from "./logic.js"
import { PATTERNS, patternOf } from "./patterns.js"
import { randomFrom } from "./random.js"
import { flag, giveUp, isMissed, open, startRound } from "./round.js"
import { flawOf, makeTrial, makeTrialWithin, minesLeft, positionOf, type Stage, type Trial } from "./trial.js"

const STAGES: Stage[] = [0, 1, 2]
// how many rounds of each pattern are made at each stage
const ROUNDS = 10

const roundOf = (id: Parameters<typeof patternOf>[0], seed: number, stage: Stage = 0): Trial => makeTrial(patternOf(id), stage, randomFrom(seedFrom(seed)))

describe.each(PATTERNS.map(pattern => ({ pattern, name: pattern.name })))("rounds of $name", ({ pattern }) => {
  const made = STAGES.map(stage => Array.from({ length: ROUNDS }, (_, seed) => makeTrialWithin(pattern, stage, randomFrom(seedFrom(seed * 11 + stage)), 5000)))

  it("can always be made, at every stage", () => {
    for (const rounds of made) expect(rounds.filter(round => round.trial === null)).toEqual([])
  })

  it("are sound: the pattern is all there is to work out, and there is no doing without it", () => {
    for (const { trial } of made.flat()) expect(flawOf(trial!), draw(trial!.board).join("\n")).toBeNull()
  })

  it("are boards that could be met in a game", () => {
    for (const { trial } of made.flat()) {
      const { board, find } = trial!
      const safe = [...trial!.safe, ...find.safe]
      const mines = [...trial!.mines, ...find.mines]
      const { rows, cols, counts } = board.field
      const drawn = draw(board).join("\n")
      // there is something to find, and whatever the pattern itself proves of a kind is what there is of that kind
      expect(find.safe.length + find.mines.length, drawn).toBeGreaterThan(0)
      if (trial!.safe.length > 0) expect(find.safe).toEqual(trial!.safe)
      if (trial!.mines.length > 0) expect(find.mines).toEqual(trial!.mines)
      let uncovered = 0
      let flagged = 0
      board.cells.forEach((cell, at) => {
        if (cell === FLAGGED) {
          flagged++
          expect(board.field.mines[at], drawn).toBe(1)
        }
        if (cell !== UNCOVERED) return
        uncovered++
        expect(board.field.mines[at], drawn).toBe(0)
        // a cell with nothing around it would have opened up everything it touches
        if (counts[at] === 0) forEachNeighbour(rows, cols, at, neighbour => expect(board.cells[neighbour], drawn).not.toBe(COVERED))
      })
      expect(board).toMatchObject({ uncovered, flagged, status: "playing" })
      for (const cell of [...safe, ...mines]) expect(board.cells[cell], drawn).toBe(COVERED)
      for (const cell of safe) expect(board.field.mines[cell], drawn).toBe(0)
      for (const cell of mines) expect(board.field.mines[cell], drawn).toBe(1)
    }
  })

  it("are a different board nearly every time", () => {
    for (const rounds of made) expect(new Set(rounds.map(({ trial }) => draw(trial!.board).join("/"))).size).toBeGreaterThan(ROUNDS * 0.7)
  })

  it("have flags beside the pattern's numbers where the pattern is one about flags, and otherwise only once it is well known", () => {
    made.forEach((rounds, stage) => {
      for (const { trial } of rounds) {
        const { board, numbers } = trial!
        const flagsBeside = numbers.map((number) => {
          let flags = 0
          forEachNeighbour(board.field.rows, board.field.cols, number, (neighbour) => { flags += board.cells[neighbour] === FLAGGED ? 1 : 0 })
          return flags
        })
        if (pattern.flags === "always") expect(flagsBeside.some(flags => flags > 0)).toBe(true)
        else if (stage < 2) expect(flagsBeside.every(flags => flags === 0)).toBe(true)
      }
    })
  })

  it("can be explained on the board they are", () => {
    for (const { trial } of made.flat()) {
      const steps = walkThrough(trial!)
      for (const step of steps) {
        expect(step.cells.length).toBeGreaterThan(0)
        expect(step.says).not.toMatch(/undefined|NaN/)
        if (step.number !== null) expect(trial!.numbers).toContain(step.number)
      }
      const proved = (as: string) => steps.filter(step => step.as === as).flatMap(step => step.cells).sort()
      expect(proved("mine")).toEqual([...trial!.mines].sort())
      expect(proved("safe")).toEqual([...trial!.safe].sort())
    }
  })
})

describe("rounds about the count of mines", () => {
  const rounds = (id: "mineCounting" | "combinations") => Array.from({ length: 30 }, (_, seed) => roundOf(id, seed, (seed % 3) as Stage))
  const touchesNumber = ({ board }: Trial, at: number) => {
    let touches = false
    forEachNeighbour(board.field.rows, board.field.cols, at, (neighbour) => { touches ||= board.cells[neighbour] === UNCOVERED })
    return touches
  }

  it("prove nothing until the count is known, and then what there is to find", () => {
    for (const trial of [...rounds("mineCounting"), ...rounds("combinations")]) {
      expect(trial).toMatchObject({ counted: true, numbers: [], covered: [] })
      expect(provesAnything(proves(positionOf(trial.board), "everything"))).toBe(false)
      const known = proves(positionOf(trial.board, true), "everything")
      expect(cellsProved(known, SAFE)).toEqual(trial.find.safe)
      expect(cellsProved(known, MINE)).toEqual(trial.find.mines)
      expect(trial.find.safe.length + trial.find.mines.length).toBeGreaterThan(0)
      // a count of none, or of every cell there is, would be no round at all
      const covered = trial.board.cells.filter(cell => cell === COVERED).length
      expect(minesLeft(trial.board)).toBeGreaterThan(0)
      expect(minesLeft(trial.board)).toBeLessThan(covered)
    }
  })

  it("are of one pattern or the other by whether a number touches what the count settles", () => {
    for (const trial of rounds("mineCounting")) expect([...trial.find.safe, ...trial.find.mines].some(cell => touchesNumber(trial, cell))).toBe(false)
    for (const trial of rounds("combinations")) expect([...trial.find.safe, ...trial.find.mines].some(cell => touchesNumber(trial, cell))).toBe(true)
  })

  it("are boards near their end: more of them open than not", () => {
    for (const trial of [...rounds("mineCounting"), ...rounds("combinations")]) {
      expect(trial.board.cells.filter(cell => cell === COVERED).length).toBeLessThan(trial.board.cells.length / 2)
    }
  })

  it("are marked with the count known, and with every flag the player places taken off it", () => {
    const trial = rounds("mineCounting").find(round => round.find.safe.length > 0)!
    expect(trial.find.safe.reduce(open, startRound(trial)).outcome).toBe("solved")
    const withMines = [...rounds("combinations"), ...rounds("mineCounting")].find(round => round.find.mines.length > 0)!
    const flagged = flag(startRound(withMines), withMines.find.mines[0])
    expect(isMissed(flagged)).toBe(false)
    expect(minesLeft(flagged.board)).toBe(minesLeft(withMines.board) - 1)
    expect(positionOf(flagged.board, true).minesLeft).toBe(minesLeft(withMines.board) - 1)
  })

  it("are explained by the count, what the numbers make of it, and what that leaves", () => {
    const trial = rounds("mineCounting").find(round => round.find.safe.length > 0)!
    const steps = walkThrough(trial)
    expect(steps[0].says).toMatch(/^The counter says \w+ mines? (is|are) left on the board, somewhere in these \w+ cells\.$/)
    expect(steps.at(-1)).toMatchObject({ as: "safe", cells: trial.find.safe })
    expect(walkThrough(rounds("combinations")[0]).at(-1)!.says).toMatch(/the numbers can no longer be met/)
  })
})

describe("makeTrial", () => {
  it("makes the same round from the same seed", () => {
    expect(draw(roundOf("oneTwoOne", 5).board)).toEqual(draw(roundOf("oneTwoOne", 5).board))
    expect(roundOf("oneTwoOne", 5)).toEqual(roundOf("oneTwoOne", 5))
  })

  it("says what a number shows and what that leaves it, where it has flags beside it", () => {
    const trial = roundOf("allSafe", 1)
    const [number] = walkThrough(trial)
    expect(number.says).toMatch(/^This \d already has (its mine|all \w+ of its mines) flagged\.$/)
    expect(walkThrough(roundOf("oneTwo", 1))[0].says).toBe("This 1 has one mine in these two cells.")
  })
})

describe("a round being played", () => {
  // a 1-2C proves a mine and a safe cell: it can be solved either way
  const trial = roundOf("oneTwoC", 2)
  const [safe] = trial.safe
  const [mine] = trial.mines
  // the two cells the 1 and the 2 share: one of them is a mine, and nothing says which
  const shared = trial.covered.filter(cell => cell !== safe && cell !== mine)
  const sharedMine = shared.find(cell => trial.board.field.mines[cell])!
  const sharedSafe = shared.find(cell => !trial.board.field.mines[cell])!

  it("starts out as its board, with nothing done", () => {
    expect(startRound(trial)).toMatchObject({ board: trial.board, outcome: "playing", wrong: null })
  })

  it("is solved by uncovering every cell the pattern proves safe", () => {
    const round = open(startRound(trial), safe)
    expect(round.outcome).toBe("solved")
    expect(round.board.cells[safe]).toBe(UNCOVERED)
    expect(isMissed(round)).toBe(false)
  })

  it("is solved by flagging every cell the pattern proves is a mine", () => {
    const round = flag(startRound(trial), mine)
    expect(round.outcome).toBe("solved")
    expect(round.board.cells[mine]).toBe(FLAGGED)
  })

  it("is missed by uncovering a mine, which is left lying there", () => {
    const round = open(startRound(trial), mine)
    expect(round).toMatchObject({ outcome: "mine", wrong: mine })
    expect(round.board.cells[mine]).toBe(UNCOVERED)
    expect(isMissed(round)).toBe(true)
  })

  it("is missed by flagging a cell that isn't a mine", () => {
    expect(flag(startRound(trial), safe)).toMatchObject({ outcome: "notMine", wrong: safe })
  })

  it("is missed by a guess that happens to be right, either way", () => {
    expect(open(startRound(trial), sharedSafe)).toMatchObject({ outcome: "guess", wrong: sharedSafe, board: trial.board })
    expect(flag(startRound(trial), sharedMine)).toMatchObject({ outcome: "guess", wrong: sharedMine, board: trial.board })
  })

  it("is missed by giving up", () => {
    expect(giveUp(startRound(trial)).outcome).toBe("gaveUp")
  })

  it("is over once it is over", () => {
    const solved = open(startRound(trial), safe)
    expect(open(solved, mine)).toBe(solved)
    expect(flag(solved, mine)).toBe(solved)
    expect(giveUp(solved)).toBe(solved)
    const missed = giveUp(startRound(trial))
    expect(open(missed, safe)).toBe(missed)
  })

  it("is solved by what follows from a pattern, where the pattern proves nothing of that kind itself", () => {
    // "all mines" proves only mines: the cells those mines leave safe, if there are any, answer it as well
    const rounds = Array.from({ length: 40 }, (_, seed) => roundOf("allMines", seed))
    expect(rounds.every(round => round.safe.length === 0 && round.find.mines.length > 0)).toBe(true)
    const withSafe = rounds.find(round => round.find.safe.length > 0)!
    expect(withSafe.find.safe.reduce(open, startRound(withSafe)).outcome).toBe("solved")
    expect(withSafe.find.mines.reduce(flag, startRound(withSafe)).outcome).toBe("solved")
    // ...and where nothing follows, there is only the one way
    const without = rounds.find(round => round.find.safe.length === 0)!
    expect(without.find.mines.reduce(flag, startRound(without)).outcome).toBe("solved")
  })

  it("does nothing for a click that does nothing", () => {
    const round = startRound(trial)
    // a number that hasn't its mines flagged, and a flag
    expect(open(round, trial.numbers[0])).toBe(round)
    expect(flag(round, trial.numbers[0])).toBe(round)
    const flagged = trial.board.cells.indexOf(FLAGGED)
    if (flagged !== -1) expect(open(round, flagged)).toBe(round)
  })

  it("takes more than one cell where the pattern proves more than one", () => {
    const line = roundOf("oneTwoOne", 3)
    expect(line.mines.length).toBe(2)
    const first = flag(startRound(line), line.mines[0])
    expect(first.outcome).toBe("playing")
    expect(flag(first, line.mines[1]).outcome).toBe("solved")
    // ...or the safe ones, instead
    expect(line.safe.reduce(open, startRound(line)).outcome).toBe("solved")
  })

  it("uncovers the rest around a number once its mines are flagged, as a click on a number does", () => {
    const line = roundOf("oneTwoOne", 3)
    // (a round in which flagging the mines isn't the end of it)
    const flagged = line.mines.reduce(flag, { ...startRound(line), trial: { ...line, find: { ...line.find, mines: [] } } })
    expect(flagged.outcome).toBe("playing")
    // the 2 in the middle has both its mines: a click on it uncovers what else it touches
    const chorded = open(flagged, line.numbers[1])
    expect(chorded.board.uncovered).toBeGreaterThan(flagged.board.uncovered)
    expect(isMissed(chorded)).toBe(false)
  })
})

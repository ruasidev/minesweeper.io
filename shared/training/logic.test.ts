import { describe, expect, it } from "vitest"
import { fieldOf, forEachNeighbour } from "../engine/field.js"
import { seedFrom } from "../engine/testing.js"
import { CELL_FLAGGED, CELL_HIDDEN, numberOn } from "../engine/view.js"
import { MINE, SAFE, UNKNOWN, countingFirst, proves, provesAnything, type Position } from "./logic.js"
import { randomFrom, type Random } from "./random.js"
import { drawProved, positionDrawn } from "./testing.js"

const proved = (position: Position, ...args: Parameters<typeof proves> extends [Position, ...infer Rest] ? Rest : never) =>
  drawProved(position, proves(position, ...args))

describe("counting", () => {
  it("makes mines of the cells around a number that needs every one of them", () => {
    // the 3 has two flags, three covered cells and one mine still to find: nothing follows
    const open = positionDrawn(
      "###",
      "F3F",
    )
    expect(proved(open, "counting")).toEqual(["...", "..."])
    const corner = positionDrawn(
      "#1",
      "11",
    )
    expect(proved(corner, "counting")).toEqual(["*.", ".."])
  })

  it("makes the rest around a number safe once it has its mines", () => {
    const position = positionDrawn(
      "F##",
      "121",
      "...",
    )
    // the first 1 has its flag: the cell above it is safe, which leaves the 2 one cell for its second mine
    expect(proved(position, "counting")).toEqual([".s*", "...", "..."])
  })

  it("can be asked for only what each number says by itself", () => {
    const position = positionDrawn(
      "F##",
      "121",
      "...",
    )
    expect(drawProved(position, countingFirst(position))).toEqual([".s.", "...", "..."])
  })

  it("takes what it is given as known, and builds on it", () => {
    const position = positionDrawn(
      "###",
      "121",
      "...",
    )
    expect(proved(position, "counting")).toEqual(["...", "...", "..."])
    const given = new Uint8Array(9)
    given[1] = SAFE
    expect(proved(position, "counting", given)).toEqual(["*s*", "...", "..."])
  })
})

describe("pairs", () => {
  it("sees that a second 1 with the same two cells and one more has no mine in the one more", () => {
    const position = positionDrawn(
      "####",
      "112#",
      "..1#",
    )
    expect(proves(position, "counting")[2]).toBe(UNKNOWN)
    expect(proves(position, "pairs")[2]).toBe(SAFE)
  })

  it("sees that a 2 beside a 1 has its second mine in the cell the 1 doesn't touch", () => {
    const position = positionDrawn(
      "####",
      "12##",
      "..##",
    )
    expect(proves(position, "pairs")[2]).toBe(MINE)
  })

  it("works a 1-2-1 out from both ends", () => {
    const position = positionDrawn(
      "#####",
      "#121#",
      "#...#",
      "#####",
    )
    expect(proved(position, "pairs")[0]).toBe("s*s*s")
  })
})

describe("everything", () => {
  it("proves what takes three numbers together", () => {
    // each 1 has one mine in its two cells, which leaves the 3 one short: the corner cell
    const position = positionDrawn(
      "###",
      "#31",
      "#1.",
    )
    expect(provesAnything(proves(position, "pairs"))).toBe(false)
    expect(proved(position, "everything")).toEqual(["*..", "...", "..."])
  })

  it("makes nothing of the count of mines unless it is told it, and no more of it than there is", () => {
    // one mine a side: which of the two cells, nobody can say, however many mines there are known to be
    const apart = positionDrawn(
      "#1.1#",
      "#1.1#",
    )
    expect(provesAnything(proves(apart, "everything"))).toBe(false)
    expect(provesAnything(proves({ ...apart, minesLeft: 2 }, "everything"))).toBe(false)
  })

  it("knows what the count leaves for the cells no number touches", () => {
    const position = positionDrawn(
      "1##",
      "###",
      "###",
    )
    expect(provesAnything(proves(position, "everything"))).toBe(false)
    // the only mine is one of the three around the 1: there is none for anywhere else
    expect(proved({ ...position, minesLeft: 1 }, "everything")).toEqual(["..s", "..s", "sss"])
    // one of the three around the 1, and five more: a mine for every cell that is left
    expect(proved({ ...position, minesLeft: 6 }, "everything")).toEqual(["..*", "..*", "***"])
    expect(provesAnything(proves({ ...position, minesLeft: 3 }, "everything"))).toBe(false)
  })

  it("proves nothing of a position that contradicts itself", () => {
    const position = positionDrawn(
      "F#",
      "0.",
    )
    expect(provesAnything(proves(position, "everything"))).toBe(false)
  })
})

// A board with its mines laid by chance and some of what isn't a mine uncovered, as its player would see it, and
// where its mines really are. Some of the mines are flagged, as a player's would be
function randomPosition(random: Random): { position: Position, mines: Uint8Array } {
  const rows = random.between(3, 5)
  const cols = random.between(3, 5)
  const mines = Uint8Array.from({ length: rows * cols }, () => (random.chance(0.25) ? 1 : 0))
  const field = fieldOf(rows, cols, mines)
  const cells = Array.from(mines, (mine, at) => (mine ? (random.chance(0.3) ? CELL_FLAGGED : CELL_HIDDEN)
    : random.chance(0.55) ? String(field.counts[at]) : CELL_HIDDEN))
  return { position: { rows, cols, cells: cells.join("") }, mines }
}

// The slow, sure way: every way at all of putting mines under the covered cells, kept if every number comes out
// right. What is a mine in all of them, and what in none
function bruteForce(position: Position): Uint8Array {
  const { rows, cols, cells } = position
  const covered = Array.from(cells, (_, at) => at).filter(at => cells[at] === CELL_HIDDEN)
  const flagged = Array.from(cells, cell => (cell === CELL_FLAGGED ? 1 : 0))
  const ever = covered.map(() => ({ mine: false, safe: false }))
  for (let way = 0; way < 1 << covered.length; way++) {
    const mines = Uint8Array.from(flagged)
    let placed = 0
    covered.forEach((at, index) => {
      mines[at] = (way >> index) & 1
      placed += mines[at]
    })
    if (position.minesLeft !== undefined && placed !== position.minesLeft) continue
    let agrees = true
    for (let at = 0; at < cells.length && agrees; at++) {
      const number = numberOn(cells[at])
      if (number === null) continue
      let around = 0
      forEachNeighbour(rows, cols, at, (neighbour) => { around += mines[neighbour] })
      agrees = around === number
    }
    if (agrees) covered.forEach((_, index) => { ever[index][(way >> index) & 1 ? "mine" : "safe"] = true })
  }
  const known = new Uint8Array(cells.length)
  covered.forEach((at, index) => {
    if (ever[index].mine !== ever[index].safe) known[at] = ever[index].mine ? MINE : SAFE
  })
  return known
}

describe("held to trying every way there is", () => {
  const random = randomFrom(seedFrom(7))
  const positions = Array.from({ length: 400 }, () => randomPosition(random))
    .filter(({ position }) => position.cells.split(CELL_HIDDEN).length - 1 <= 14)

  it("proves exactly what is so, no more and no less", () => {
    expect(positions.length).toBeGreaterThan(300)
    for (const { position } of positions) {
      expect(drawProved(position, proves(position, "everything")), position.cells).toEqual(drawProved(position, bruteForce(position)))
    }
  })

  it("does so when the count of mines is known too", () => {
    for (const { position, mines } of positions) {
      const minesLeft = Array.from(position.cells).filter((cell, at) => cell === CELL_HIDDEN && mines[at]).length
      const counted = { ...position, minesLeft }
      expect(drawProved(counted, proves(counted, "everything")), position.cells).toEqual(drawProved(counted, bruteForce(counted)))
    }
  })

  it("never says by a quicker rule what isn't so, and never knows less by a stronger one", () => {
    for (const { position, mines } of positions) {
      const counting = proves(position, "counting")
      const pairs = proves(position, "pairs")
      const everything = proves(position, "everything")
      for (let at = 0; at < mines.length; at++) {
        for (const known of [counting, pairs, everything]) {
          if (known[at] !== UNKNOWN) expect(known[at], position.cells).toBe(mines[at] ? MINE : SAFE)
        }
        if (counting[at] !== UNKNOWN) expect(pairs[at]).toBe(counting[at])
        if (pairs[at] !== UNKNOWN) expect(everything[at]).toBe(pairs[at])
      }
    }
  })
})

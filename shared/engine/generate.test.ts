import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { forEachNeighbour, layoutText } from "./field.js"
import { BOARD_SIZE_MAX, BOARD_SIZE_MIN, MINES_MAX, boardSettingsFrom, generateBoard, generateField, maxMines } from "./generate.js"
import { fromHex, seedFrom } from "./testing.js"

// The boards the generator is on record as making. Its own tests (in Rust) hold its source to them; these hold the
// build of it that the game runs to the very same ones
type Asked = { rows: number, cols: number, mines: number, seed: string, opening: number | null, guessFree: boolean, openedOn: number }
type Vector = Asked & { layout: string }
// ...and many more boards, each on record by a digest of its layout
type Digest = Asked & { promised: boolean, layoutDigest: string }
const vectors: { cases: Vector[], digests: Digest[] } = JSON.parse(readFileSync(new URL("../../crates/boardgen/tests/vectors.json", import.meta.url), "utf8"))

// FNV-1a, 32 bits, in hex: what the layouts on record by digest are digested with
function fnv1a(bytes: Uint8Array): string {
  let hash = 0x811c9dc5
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, "0")
}

const count = (mines: Uint8Array): number => mines.reduce((sum, mine) => sum + mine, 0)

describe("maxMines", () => {
  it("leaves the opening and the cells around it clear", () => {
    expect(maxMines(9, 9)).toBe(72)
    expect(maxMines(16, 30)).toBe(471)
    expect(maxMines(4, 4)).toBe(7)
  })

  it("allows for a board too narrow to have nine clear cells", () => {
    expect(maxMines(2, 10)).toBe(14)
    expect(maxMines(1, 5)).toBe(2)
  })
})

describe("boardSettingsFrom", () => {
  it("takes a board that can be made, and nothing else that came with it", () => {
    expect(boardSettingsFrom({ rows: 9, cols: 9, mines: 10, extra: true })).toEqual({ rows: 9, cols: 9, mines: 10 })
    expect(boardSettingsFrom({ rows: BOARD_SIZE_MAX, cols: BOARD_SIZE_MAX, mines: MINES_MAX })).not.toBeNull()
    expect(boardSettingsFrom({ rows: BOARD_SIZE_MIN, cols: BOARD_SIZE_MIN, mines: 7 })).not.toBeNull()
  })

  it("turns down a board that is too small, too big, or has more mines than it can hold", () => {
    expect(boardSettingsFrom({ rows: 3, cols: 9, mines: 5 })).toBeNull()
    expect(boardSettingsFrom({ rows: 100, cols: 9, mines: 5 })).toBeNull()
    expect(boardSettingsFrom({ rows: 4, cols: 4, mines: 8 })).toBeNull()
    expect(boardSettingsFrom({ rows: 30, cols: 30, mines: MINES_MAX + 1 })).toBeNull()
    expect(boardSettingsFrom({ rows: 9, cols: 9, mines: 0 })).toBeNull()
  })

  it("turns down anything that isn't whole numbers", () => {
    for (const value of [null, undefined, "9x9", 9, [], { rows: "9", cols: 9, mines: 10 }, { rows: 9.5, cols: 9, mines: 10 }, { rows: 9, cols: 9 }]) {
      expect(boardSettingsFrom(value)).toBeNull()
    }
  })
})

describe("generateBoard", () => {
  const EXPERT = { rows: 16, cols: 30, mines: 99 }
  const BEGINNER = { rows: 9, cols: 9, mines: 10 }

  it("makes the same board from the same seed", () => {
    const first = generateBoard(EXPERT, seedFrom(9))
    expect(generateBoard(EXPERT, seedFrom(9))).toEqual(first)
    expect(layoutText(generateBoard(EXPERT, seedFrom(10)).mines)).not.toBe(layoutText(first.mines))
  })

  it("opens where it is asked to, and picks somewhere on the board when it isn't", () => {
    expect(generateBoard(BEGINNER, seedFrom(1), { opening: 17 }).opening).toBe(17)
    const picked = new Set<number>()
    for (let seed = 0; seed < 50; seed++) {
      const { opening } = generateBoard(BEGINNER, seedFrom(seed))
      expect(opening >= 0 && opening < 81).toBe(true)
      picked.add(opening)
    }
    // (seeds that count up one after another are a poor spread, but still a spread)
    expect(picked.size).toBeGreaterThan(10)
  })

  it("lays exactly as many mines as asked for", () => {
    for (const guessFree of [true, false]) {
      for (const mines of [1, 10, 40, 72]) {
        expect(count(generateBoard({ rows: 9, cols: 9, mines }, seedFrom(mines), { opening: 40, guessFree }).mines)).toBe(mines)
      }
    }
  })

  it("never puts a mine on the opening or beside it, wherever the opening is", () => {
    for (const guessFree of [true, false]) {
      for (let opening = 0; opening < 6 * 7; opening++) {
        // as many mines as fit: every cell that may hold one does
        let clear = 1
        forEachNeighbour(6, 7, opening, () => { clear++ })
        const { mines } = generateBoard({ rows: 6, cols: 7, mines: 6 * 7 - clear }, seedFrom(opening), { opening, guessFree })
        expect(mines[opening]).toBe(0)
        forEachNeighbour(6, 7, opening, neighbour => expect(mines[neighbour]).toBe(0))
        expect(count(mines)).toBe(6 * 7 - clear)
      }
    }
  })

  it("makes a board that needs no guess, unless it is told chance alone will do", () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(generateBoard(EXPERT, seedFrom(seed)).guessFree).toBe(true)
      expect(generateBoard(EXPERT, seedFrom(seed), { guessFree: true }).guessFree).toBe(true)
      // nothing is promised of a board nobody checked
      expect(generateBoard(EXPERT, seedFrom(seed), { guessFree: false }).guessFree).toBe(false)
    }
  })

  it("lays the board chance gives first, and keeps it if it already needs no guess", () => {
    // most beginner boards need no guess as they fall, and most expert ones need one
    const kept = (settings: typeof EXPERT) => Array.from({ length: 40 }, (_, seed) => {
      const byChance = generateBoard(settings, seedFrom(seed), { opening: 40, guessFree: false })
      const guessFree = generateBoard(settings, seedFrom(seed), { opening: 40 })
      return layoutText(byChance.mines) === layoutText(guessFree.mines)
    }).filter(Boolean).length
    expect(kept(BEGINNER)).toBeGreaterThan(30)
    expect(kept(EXPERT)).toBeLessThan(20)
  })

  it("finds one that needs no guess even where a third of the board is mines", () => {
    const made = generateBoard({ rows: 16, cols: 16, mines: 99 }, seedFrom(7))
    expect(made.guessFree).toBe(true)
    expect(count(made.mines)).toBe(99)
  })

  it("can be asked over and over, for boards of any size", () => {
    for (let round = 0; round < 30; round++) {
      for (const settings of [{ rows: 99, cols: 99, mines: 99 }, { rows: 4, cols: 4, mines: 3 }, EXPERT]) {
        const made = generateBoard(settings, seedFrom(round))
        expect(made.mines).toHaveLength(settings.rows * settings.cols)
        expect(count(made.mines)).toBe(settings.mines)
      }
    }
  })

  it("hands over mines that are the caller's own to keep", () => {
    const first = generateBoard(BEGINNER, seedFrom(3))
    const layout = layoutText(first.mines)
    // making another board doesn't write over the last one
    generateBoard(BEGINNER, seedFrom(4))
    expect(layoutText(first.mines)).toBe(layout)
  })

  it("turns down a board that can't be made", () => {
    expect(() => generateBoard({ rows: 4, cols: 4, mines: 8 }, seedFrom(3), { opening: 5 })).toThrow(RangeError)
    expect(() => generateBoard(BEGINNER, seedFrom(3), { opening: 81 })).toThrow(RangeError)
    expect(() => generateBoard(BEGINNER, seedFrom(3), { opening: -2 })).toThrow(RangeError)
    expect(() => generateBoard(BEGINNER, seedFrom(3), { opening: 1.5 })).toThrow(RangeError)
    expect(() => generateBoard({ rows: 0, cols: 9, mines: 1 }, seedFrom(3))).toThrow(RangeError)
    expect(() => generateBoard({ rows: 9, cols: 5000, mines: 1 }, seedFrom(3))).toThrow(RangeError)
    expect(() => generateBoard({ rows: 9.5, cols: 9, mines: 1 }, seedFrom(3))).toThrow(RangeError)
    expect(() => generateBoard({ rows: 9, cols: 9, mines: -1 }, seedFrom(3))).toThrow(RangeError)
    // a corner keeps fewer cells clear, so more mines fit around it
    expect(count(generateBoard({ rows: 4, cols: 4, mines: 12 }, seedFrom(3), { opening: 0 }).mines)).toBe(12)
  })

  it("turns down a seed that isn't sixteen bytes, or is all zeroes", () => {
    expect(() => generateBoard(BEGINNER, new Uint8Array(8))).toThrow(RangeError)
    expect(() => generateBoard(BEGINNER, new Uint8Array(32).fill(1))).toThrow(RangeError)
    expect(() => generateBoard(BEGINNER, new Uint8Array(16))).toThrow(RangeError)
  })

  it("still works after turning a board down", () => {
    expect(() => generateBoard({ rows: 4, cols: 4, mines: 8 }, seedFrom(3), { opening: 5 })).toThrow(RangeError)
    expect(count(generateBoard(BEGINNER, seedFrom(3)).mines)).toBe(10)
  })

  it.each(vectors.cases)("still makes the $rows x $cols board with $mines mines it is on record as making (seed $seed, guess free: $guessFree)", (vector) => {
    const made = generateBoard(vector, fromHex(vector.seed), { opening: vector.opening ?? undefined, guessFree: vector.guessFree })
    expect(made.opening).toBe(vector.openedOn)
    expect(layoutText(made.mines)).toBe(vector.layout)
    expect(made.guessFree).toBe(vector.guessFree)
  })
})

describe("the build of the generator that the game runs", () => {
  // Boards of every shape, with and without the promise. If these match, what is kept in boardgen.wasm.ts was
  // built from the generator as it now is: a change to the Rust that wasn't followed by `npm run build:boardgen`
  // shows up here
  it("makes every one of the boards the generator is on record as making", () => {
    expect(vectors.digests.length).toBeGreaterThanOrEqual(400)
    expect(fnv1a(Uint8Array.of(1, 0, 1))).toBe("0cca45ff")
    for (const vector of vectors.digests) {
      const made = generateBoard(vector, fromHex(vector.seed), { opening: vector.opening ?? undefined, guessFree: vector.guessFree })
      const name = `${vector.rows} x ${vector.cols} with ${vector.mines} mines, seed ${vector.seed}`
      expect(made.opening, name).toBe(vector.openedOn)
      expect(fnv1a(made.mines), name).toBe(vector.layoutDigest)
      expect(made.guessFree, name).toBe(vector.promised)
    }
  })
})

describe("generateField", () => {
  it("is the same board with its numbers worked out", () => {
    const settings = { rows: 9, cols: 9, mines: 10 }
    const { opening, field, guessFree } = generateField(settings, seedFrom(4))
    const board = generateBoard(settings, seedFrom(4))
    expect(field.mines).toEqual(board.mines)
    expect(field.mineCount).toBe(10)
    expect(opening).toBe(board.opening)
    expect(guessFree).toBe(true)
    // the opening always has nothing around it
    expect(field.counts[opening]).toBe(0)
  })

  it("passes on what it was asked for", () => {
    const settings = { rows: 16, cols: 30, mines: 99 }
    const byChance = generateField(settings, seedFrom(4), { opening: 100, guessFree: false })
    expect(byChance.opening).toBe(100)
    expect(byChance.guessFree).toBe(false)
    expect(byChance.field.mines).toEqual(generateBoard(settings, seedFrom(4), { opening: 100, guessFree: false }).mines)
  })
})

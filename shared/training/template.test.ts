import { describe, expect, it } from "vitest"
import { TURNS, coveredAround, templateDrawn, turned, type Template } from "./template.js"

// a template drawn back out, to look at
function draw(template: Template): string[] {
  const rows = Array.from({ length: template.rows }, () => new Array<string>(template.cols).fill("."))
  for (const number of template.numbers) rows[number.row][number.col] = String(number.needs)
  for (const cell of template.covered) rows[cell.row][cell.col] = cell.proven === "mine" ? "*" : cell.proven === "safe" ? "s" : "?"
  return rows.map(row => row.join(""))
}

describe("templateDrawn", () => {
  it("reads the numbers and the covered cells off a drawing, in reading order", () => {
    const template = templateDrawn(["s??*", ".12."], ["abbc", "...."])
    expect(template).toMatchObject({ rows: 2, cols: 4 })
    expect(template.numbers).toEqual([{ row: 1, col: 1, needs: 1 }, { row: 1, col: 2, needs: 2 }])
    expect(template.covered.map(cell => cell.proven)).toEqual(["safe", "nothing", "nothing", "mine"])
    expect(template.covered.map(cell => cell.group)).toEqual(["a", "b", "b", "c"])
  })

  it("refuses a drawing that isn't one", () => {
    expect(() => templateDrawn(["??", "1"])).toThrow(RangeError)
    expect(() => templateDrawn(["?x", "1."])).toThrow(RangeError)
    expect(() => templateDrawn(["??", "1."], ["ab"])).toThrow(RangeError)
  })
})

describe("turned", () => {
  const template = templateDrawn(["??*", "12."])

  it("leaves a template as it was drawn for the first of the eight ways", () => {
    expect(draw(turned(template, 0))).toEqual(["??*", "12."])
  })

  it("turns it through each quarter, and each of those in a mirror", () => {
    expect(draw(turned(template, 1))).toEqual(["1?", "2?", ".*"])
    expect(draw(turned(template, 2))).toEqual([".21", "*??"])
    expect(draw(turned(template, 3))).toEqual(["*.", "?2", "?1"])
    expect(draw(turned(template, 4))).toEqual(["*??", ".21"])
    expect(new Set(Array.from({ length: TURNS }, (_, turn) => draw(turned(template, turn)).join("/"))).size).toBe(TURNS)
  })

  it("keeps the cells in the order they were drawn in, and each number beside the same ones", () => {
    for (let turn = 0; turn < TURNS; turn++) {
      const now = turned(template, turn)
      expect(now.numbers.map(number => number.needs)).toEqual([1, 2])
      expect(now.covered.map(cell => cell.proven)).toEqual(["nothing", "nothing", "mine"])
      expect(now.numbers.map(number => coveredAround(now, number))).toEqual([[0, 1], [0, 1, 2]])
    }
  })
})

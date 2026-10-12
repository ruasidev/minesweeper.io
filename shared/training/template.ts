// A pattern as it is drawn.
//
// A pattern is a handful of numbers and the covered cells around them, and what those numbers prove about those
// cells. It is written down as a drawing, a row to a line:
//
//   "0" to "8"  an uncovered number. The digit is how many mines it still needs: what it shows, less the flags
//               already around it
//   "?"         a covered cell the pattern proves nothing about
//   "*"         a covered cell the pattern proves is a mine
//   "s"         a covered cell the pattern proves is safe
//   "."         no part of the pattern
//
// A drawing shows every covered cell its numbers touch. Whatever else is around a number (a "." beside it, or
// what lies past the edge of the drawing) is therefore not covered on any board the pattern is put on: it is
// uncovered, or flagged, or off the board altogether. That is the whole of what a "wall" is.
//
// A second drawing of the same size may name groups of the covered cells with small letters, for the steps of
// the pattern's explanation to point at. The numbers need no naming: they are "A", "B", "C" in reading order.

export type TemplateNumber = {
  row: number
  col: number
  // how many mines it still needs among the covered cells around it
  needs: number
}

// what the pattern says of a covered cell
export type Proven = "mine" | "safe" | "nothing"

export type TemplateCell = {
  row: number
  col: number
  proven: Proven
  // the letter it goes by in the explanation, if it has one
  group: string | null
}

export type Template = {
  rows: number
  cols: number
  // In the order they are read off the drawing. Turning a template about moves its cells and keeps their order,
  // so the third number of a pattern is its third number whichever way up it is
  numbers: TemplateNumber[]
  covered: TemplateCell[]
}

const PROVEN: Record<string, Proven> = { "?": "nothing", "*": "mine", "s": "safe" }

export function templateDrawn(drawing: readonly string[], groups?: readonly string[]): Template {
  const rows = drawing.length
  const cols = drawing[0].length
  const sameShape = (lines: readonly string[]) => lines.length === rows && lines.every(line => line.length === cols)
  if (!sameShape(drawing) || (groups && !sameShape(groups))) throw new RangeError(`A drawing is as wide on every line: ${drawing.join(" / ")}`)

  const template: Template = { rows, cols, numbers: [], covered: [] }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const mark = drawing[row][col]
      if (mark >= "0" && mark <= "8") template.numbers.push({ row, col, needs: Number(mark) })
      else if (mark in PROVEN) {
        const letter = groups?.[row][col]
        template.covered.push({ row, col, proven: PROVEN[mark], group: letter && letter >= "a" && letter <= "z" ? letter : null })
      } else if (mark !== ".") throw new RangeError(`"${mark}" means nothing in the drawing of a pattern`)
    }
  }
  return template
}

// a pattern can lie on a board any of eight ways: turned through each quarter, and each of those in a mirror
export const TURNS = 8

// The template lying another way: `turn` is 0 to 7, and 0 is as it was drawn
export function turned(template: Template, turn: number): Template {
  const mirrored = turn >= 4
  const quarters = turn % 4
  const place = <T extends { row: number, col: number }>(cell: T): T => {
    let row = cell.row
    let col = mirrored ? template.cols - 1 - cell.col : cell.col
    let height = template.rows
    let width = template.cols
    // a quarter turn clockwise, as often as asked: what was the left-hand column becomes the top row
    for (let quarter = 0; quarter < quarters; quarter++) {
      const from = row
      row = col
      col = height - 1 - from
      const was = height
      height = width
      width = was
    }
    return { ...cell, row, col }
  }
  const sideways = quarters % 2 === 1
  return {
    rows: sideways ? template.cols : template.rows,
    cols: sideways ? template.rows : template.cols,
    numbers: template.numbers.map(place),
    covered: template.covered.map(place),
  }
}

export const touching = (a: { row: number, col: number }, b: { row: number, col: number }): boolean =>
  Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1 && (a.row !== b.row || a.col !== b.col)

// which of a template's covered cells a number of it touches, by their place in `covered`
export function coveredAround(template: Template, number: TemplateNumber): number[] {
  const around: number[] = []
  template.covered.forEach((cell, index) => {
    if (touching(cell, number)) around.push(index)
  })
  return around
}

// the letter a number goes by: "A" for the first, "B" for the second
export const numberLetter = (index: number): string => String.fromCharCode(65 + index)

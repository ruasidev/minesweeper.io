// Where a pattern lies on a position: the other way round from making a round of one.
//
// A shape is on a board wherever its numbers are numbers needing what the shape has them need, and each touches
// the covered cells the shape gives it and no others. Nothing else about the board matters: what the shape proves
// follows from those numbers alone, whatever is around them. That goes for flags too: a pattern is the same
// pattern with flags beside its numbers, except for the ones that are about flags, which aren't there without. This is how to ask of a real game, at a moment when a
// player is stuck, whether one of the patterns that are taught is the way on (scripts/survey-patterns.ts)

import { forEachNeighbour } from "../engine/field.js"
import { CELL_FLAGGED, CELL_HIDDEN, CELL_MINE, numberOn } from "../engine/view.js"
import type { Position } from "./logic.js"
import { PATTERNS, type Pattern, type PatternId } from "./patterns.js"
import { TURNS, coveredAround, turned } from "./template.js"

export type Match = {
  pattern: PatternId
  shape: number
  // where the shape's numbers and its covered cells are on the board, in the order the shape has them
  numbers: number[]
  covered: number[]
  // whether any of those numbers has a flag beside it, and so shows more than the shape has it need
  flagged: boolean
}

// Every place a pattern lies on a position, each once (a shape that looks the same turned about is on the board
// once, not once for every way of looking at it)
export function matchesOf(position: Position, pattern: Pattern): Match[] {
  const { rows, cols, cells } = position
  const matches: Match[] = []
  const seen = new Set<string>()

  pattern.shapes.forEach(({ template: drawn }, shape) => {
    for (let turn = 0; turn < TURNS; turn++) {
      const template = turned(drawn, turn)
      const around = template.numbers.map(number => coveredAround(template, number))
      // every place on the board the shape fits whole: its drawing may hang over the edge, its cells may not
      const placed = [...template.numbers, ...template.covered]
      const rowMin = Math.min(...placed.map(cell => cell.row))
      const rowMax = Math.max(...placed.map(cell => cell.row))
      const colMin = Math.min(...placed.map(cell => cell.col))
      const colMax = Math.max(...placed.map(cell => cell.col))
      for (let down = -rowMin; down < rows - rowMax; down++) {
        for (let over = -colMin; over < cols - colMax; over++) {
          const cellOf = (cell: { row: number, col: number }) => (cell.row + down) * cols + cell.col + over
          const covered = template.covered.map(cellOf)
          if (covered.some(cell => cells[cell] !== CELL_HIDDEN)) continue
          const numbers = template.numbers.map(cellOf)
          let flagged = false
          const fits = numbers.every((at, index) => {
            const shown = numberOn(cells[at])
            if (shown === null) return false
            let flags = 0
            let hidden = 0
            let strays = false
            forEachNeighbour(rows, cols, at, (neighbour) => {
              const cell = cells[neighbour]
              if (cell === CELL_FLAGGED || cell === CELL_MINE) flags++
              else if (cell === CELL_HIDDEN) {
                hidden++
                strays ||= !around[index].some(mine => covered[mine] === neighbour)
              }
            })
            flagged ||= flags > 0
            return !strays && hidden === around[index].length && shown - flags === template.numbers[index].needs
          })
          if (!fits || (pattern.flags === "always" && !flagged)) continue
          const key = `${[...numbers].sort((a, b) => a - b)}|${[...covered].sort((a, b) => a - b)}`
          if (seen.has(key)) continue
          seen.add(key)
          matches.push({ pattern: pattern.id, shape, numbers, covered, flagged })
        }
      }
    }
  })
  return matches
}

// every place any of the patterns lies on a position
export const patternsIn = (position: Position, patterns: readonly Pattern[] = PATTERNS): Match[] =>
  patterns.flatMap(pattern => matchesOf(position, pattern))

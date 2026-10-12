// Every pattern there is to train: what it looks like, what it proves, and how that is explained.
//
// A pattern is data. Its shapes are drawn (see template.ts), and a round of training is a board made around one of
// them, a different board every time (trial.ts). Nothing here is taken on trust: the tests have the solver prove
// that every shape proves exactly the cells it is drawn as proving, by the reasoning it says it takes and by none
// weaker.
//
// They are listed in the order they are learned, easiest first. The names are the ones players use for them.

import type { Reach } from "./logic.js"
import { templateDrawn, type Template } from "./template.js"

export const FAMILIES = {
  counting: { label: "Counting", blurb: "One number at a time: the two rules everything else is built on." },
  pairs: { label: "Pairs", blurb: "Two numbers side by side, and what the cells they share say about the rest." },
  lines: { label: "Lines", blurb: "The same pairs met from both ends of a row of numbers." },
  reduction: { label: "Reduction", blurb: "The same shapes behind flags: take a number's flags off it, and see what is left." },
  holes: { label: "Holes", blurb: "A number that pokes into the covered cells, with one behind it that touches only two of them." },
  triangles: { label: "Triangles", blurb: "Two numbers at a corner, where the cells they share are three in a triangle." },
  advanced: { label: "Advanced", blurb: "Three numbers or more that prove together what no two of them can." },
  endgame: { label: "Endgame", blurb: "The last few mines: what the count of them rules out, when the numbers have nothing more to say." },
} satisfies Record<string, { label: string, blurb: string }>

export type Family = keyof typeof FAMILIES

// One thing said in the explanation of a pattern, with the cells it is said about lit up
export type Step =
  // One of the pattern's numbers ("A" is the first as the shape is drawn) and the covered cells around it. What is
  // said is worked out from the board the pattern is on, where the number may show more than it needs
  | { number: string }
  // Some of its covered cells, and what follows for them: "*" for the ones it proves are mines, "s" for the ones
  // it proves safe, "?" for the rest, or the letters of groups named in the shape
  | { cells: string, says: string }

export type Shape = {
  template: Template
  steps: readonly Step[]
}

export type Pattern = {
  id: PatternId
  name: string
  family: Family
  // the weakest reasoning that finds it
  needs: Reach
  // Whether its numbers have flags beside them. Never, in most: the numbers show exactly what they need, so the
  // shape is there to be seen. Always, where taking the flags off a number is the point
  flags: "never" | "always"
  // what it comes to, in a line
  rule: string
  // None, for a pattern that is about the count of mines: there is no shape to it
  shapes: readonly Shape[]
  // The pattern is about how many mines are left, which its rounds show. What the count settles is either cells
  // that no number touches, or cells the numbers do touch
  counted?: "untouched" | "touched"
}

const shape = (drawing: string[], steps: readonly Step[], groups?: string[]): Shape => ({ template: templateDrawn(drawing, groups), steps })

const A: Step = { number: "A" }
const B: Step = { number: "B" }
const C: Step = { number: "C" }
const D: Step = { number: "D" }

// In the order they are learned: a family at a time, and within a family the ones met most often in a game first
// (`npm run survey:patterns` counts them). A pattern's id is what a player's progress is kept under: it never changes
export const PATTERN_IDS = [
  "allMines", "allSafe",
  "oneOne", "oneTwo", "oneTwoC", "oneOnePlus", "oneTwoPlus", "oneTwoCPlus",
  "oneTwoOne", "oneTwoTwoOne",
  "oneOneR", "oneTwoR", "oneTwoOneR", "oneTwoTwoOneR",
  "holeOne", "holeTwo", "holeThree",
  "triangleOne", "triangleTwo", "triangleThree", "triangleFour", "triangleFive",
  "oneThreeOne", "twoTwoTwo", "oneTwoOneBent", "tPattern", "chain",
  "mineCounting", "combinations",
] as const

export type PatternId = (typeof PATTERN_IDS)[number]

const allMinesSteps = [A, { cells: "*", says: "It needs every cell it has: each one is a mine." }]
const allSafeSteps = [A, { cells: "s", says: "So nothing else around it is a mine." }]

const oneTwoSteps = [
  A,
  B,
  { cells: "?", says: "The 1 allows only one mine in the cells they share." },
  { cells: "*", says: "So the rest of what the other needs is in the cells it has to itself." },
]

const oneTwoCSteps = [
  ...oneTwoSteps,
  { cells: "s", says: "That puts the 1's own mine in the shared cells, and nowhere else." },
]

const oneOneShapes = [
  shape(["??s", "11."], [
    A,
    B,
    { cells: "?", says: "The first 1's mine is in these two, and the second 1 touches both." },
    { cells: "s", says: "So the second 1 has no mine left over for this one." },
  ]),
]

const oneTwoShapes = [shape(["??*", "12."], oneTwoSteps)]
const oneTwoCShapes = [shape(["s??*", ".12."], oneTwoCSteps)]

const oneTwoOneShapes = [
  shape(["s*s*s", ".121."], [
    A,
    B,
    C,
    { cells: "*", says: "The 2 with either 1 is a 1-2: its other mine is past the far end of that 1." },
    { cells: "s", says: "That is both of the 2's mines, and each 1's only one." },
  ]),
  shape(["*s*", "121"], [
    A,
    B,
    C,
    { cells: "*", says: "The 2 with either 1 is a 1-2: its other mine is the cell that 1 doesn't touch." },
    { cells: "s", says: "That is both of the 2's mines." },
  ]),
]

const oneTwoTwoOneSteps = [
  A,
  B,
  C,
  D,
  { cells: "*", says: "Each end is a 1-2: the 2's other mine is the cell its 1 doesn't touch." },
  { cells: "s", says: "Those two mines are all that any of the four needs." },
]
const oneTwoTwoOneShapes = [shape(["ss**ss", ".1221."], oneTwoTwoOneSteps), shape(["s**s", "1221"], oneTwoTwoOneSteps)]

// A hole: the number that pokes in is "A", and the one behind it, which touches only the two cells beside it, "B"
const holeSteps = [
  B,
  { cells: "?", says: "So one of these two is a mine." },
  A,
  { cells: "s", says: "This one touches both of those: its only mine is one of them, and the rest around it are safe." },
]

// A triangle where the second number needs more than the first: what it needs besides is in the cell it has to itself
const triangleSteps = [
  A,
  B,
  { cells: "?", says: "They share these three, and the first number allows only so many mines in them." },
  { cells: "*", says: "So the rest of what the second needs is in what it has to itself." },
  { cells: "s", says: "That puts all of the first number's mines in the shared cells: its others are safe." },
]

const CATALOGUE: Record<PatternId, Omit<Pattern, "id">> = {
  allMines: {
    name: "All mines",
    family: "counting",
    needs: "counting",
    flags: "never",
    rule: "A number with exactly as many covered cells around it as it needs: every one of them is a mine.",
    shapes: [
      shape(["*.", ".1"], allMinesSteps),
      shape(["*", "1"], allMinesSteps),
      shape(["**", "2."], allMinesSteps),
      shape(["*.", "2*"], allMinesSteps),
      shape(["*.*", ".2."], allMinesSteps),
      shape(["***", ".3."], allMinesSteps),
    ],
  },
  allSafe: {
    name: "All safe",
    family: "counting",
    needs: "counting",
    flags: "always",
    rule: "A number that already has all its mines flagged: everything else around it is safe.",
    shapes: [
      shape(["s.", ".0"], allSafeSteps),
      shape(["s", "0"], allSafeSteps),
      shape(["ss", "0."], allSafeSteps),
      shape(["s.", "0s"], allSafeSteps),
      shape(["sss", ".0."], allSafeSteps),
    ],
  },
  oneOne: {
    name: "1-1",
    family: "pairs",
    needs: "pairs",
    flags: "never",
    rule: "Two 1s from a wall: the first 1's mine is in the two cells they share, so the second 1's third cell is safe.",
    shapes: oneOneShapes,
  },
  oneOnePlus: {
    name: "1-1+",
    family: "pairs",
    needs: "pairs",
    flags: "never",
    rule: "A 1-1 where the second 1 touches more cells besides: all of them are safe.",
    shapes: [
      shape(["??s", "11s", "..s"], [
        A,
        B,
        { cells: "?", says: "The first 1's mine is in these two, and the second 1 touches both." },
        { cells: "s", says: "So the second 1 has no mine left over for any of these." },
      ]),
      shape(["??s", "11s"], [
        A,
        B,
        { cells: "?", says: "The first 1's mine is in these two, and the second 1 touches both." },
        { cells: "s", says: "So the second 1 has no mine left over for either of these." },
      ]),
    ],
  },
  oneTwo: {
    name: "1-2",
    family: "pairs",
    needs: "pairs",
    flags: "never",
    rule: "A 1 and a 2 from a wall: the 2 can have only one mine in the cells they share, so its third cell is a mine.",
    shapes: oneTwoShapes,
  },
  oneTwoPlus: {
    name: "1-2+",
    family: "pairs",
    needs: "pairs",
    flags: "never",
    rule: "A 1-2 with a bigger number: all but one of its mines are in the cells it has to itself.",
    shapes: [
      shape(["??*", "13*"], oneTwoSteps),
      shape(["??*", "14*", "..*"], oneTwoSteps),
    ],
  },
  oneTwoC: {
    name: "1-2C",
    family: "pairs",
    needs: "pairs",
    flags: "never",
    rule: "A 1-2 out in the open: the 2's third cell is a mine, and the 1's own third cell is safe.",
    shapes: oneTwoCShapes,
  },
  oneTwoCPlus: {
    name: "1-2C+",
    family: "pairs",
    needs: "pairs",
    flags: "never",
    rule: "A 1-2C with a bigger number: every cell it has to itself is a mine, and the 1's own cell is safe.",
    shapes: [
      shape(["s??*", ".13*"], oneTwoCSteps),
      shape(["s??*", ".14*", "...*"], oneTwoCSteps),
    ],
  },
  oneTwoOne: {
    name: "1-2-1",
    family: "lines",
    needs: "pairs",
    flags: "never",
    rule: "1-2-1 in a row: a mine in front of each 1, and none in front of the 2.",
    shapes: oneTwoOneShapes,
  },
  oneTwoTwoOne: {
    name: "1-2-2-1",
    family: "lines",
    needs: "pairs",
    flags: "never",
    rule: "1-2-2-1 in a row: a mine in front of each 2, and none in front of the 1s.",
    shapes: oneTwoTwoOneShapes,
  },
  // The same four shapes with flags beside their numbers: what a number shows is no longer what it needs, and the
  // shape has to be seen through that
  oneOneR: {
    name: "1-1R",
    family: "reduction",
    needs: "pairs",
    flags: "always",
    rule: "A 1-1 behind flags: take each number's flags off it, and two 1s from a wall are what is left.",
    shapes: oneOneShapes,
  },
  oneTwoR: {
    name: "1-2R",
    family: "reduction",
    needs: "pairs",
    flags: "always",
    rule: "A 1-2 behind flags: take each number's flags off it, and a 1 and a 2 are what is left.",
    shapes: [...oneTwoShapes, ...oneTwoCShapes],
  },
  oneTwoOneR: {
    name: "1-2-1R",
    family: "reduction",
    needs: "pairs",
    flags: "always",
    rule: "A 1-2-1 behind flags: a 2-3-2 with a flag beside each, say.",
    shapes: oneTwoOneShapes,
  },
  oneTwoTwoOneR: {
    name: "1-2-2-1R",
    family: "reduction",
    needs: "pairs",
    flags: "always",
    rule: "A 1-2-2-1 behind flags: take each number's flags off it first.",
    shapes: oneTwoTwoOneShapes,
  },
  holeOne: {
    name: "H1",
    family: "holes",
    needs: "pairs",
    flags: "never",
    rule: "A 1 poking into the covered cells with a 1 behind it: the mine is beside the first, and the cells ahead of it are safe.",
    shapes: [shape(["sss", "?1?", ".1."], holeSteps)],
  },
  holeTwo: {
    name: "H2",
    family: "holes",
    needs: "pairs",
    flags: "never",
    rule: "A hole two cells deep: the mine is beside the 1 behind, and the cells ahead of the 1 in front are safe.",
    shapes: [shape(["sss", ".1.", "?1?"], holeSteps)],
  },
  holeThree: {
    name: "H3",
    family: "holes",
    needs: "pairs",
    flags: "never",
    rule: "A hole round a corner: the mine is one of the two cells both 1s touch, and everything else round the 1 in front is safe.",
    shapes: [shape(["sss", ".1s", ".??", ".1."], holeSteps)],
  },
  triangleOne: {
    name: "T1",
    family: "triangles",
    needs: "pairs",
    flags: "never",
    rule: "Two 1s at a corner that share three cells: the mine is one of the three, and the rest round the outer 1 are safe.",
    shapes: [
      shape(["sss", "?1?", "?1."], [
        B,
        { cells: "?", says: "So one of these three is a mine." },
        A,
        { cells: "s", says: "This one touches all three: its only mine is one of them, and the rest around it are safe." },
      ]),
    ],
  },
  triangleTwo: {
    name: "T2",
    family: "triangles",
    needs: "pairs",
    flags: "never",
    rule: "A 1 and a 2 at a corner that share three cells: the 2's fourth cell is a mine, and the rest round the 1 are safe.",
    shapes: [shape(["sss", "?1?", "?2.", "*.."], triangleSteps)],
  },
  triangleThree: {
    name: "T3",
    family: "triangles",
    needs: "pairs",
    flags: "never",
    rule: "A 2 and a 3 at a corner that share three cells: the 3's fourth cell is a mine, and the rest round the 2 are safe.",
    shapes: [shape(["sss", "?2?", "?3.", "*.."], triangleSteps)],
  },
  triangleFour: {
    name: "T4",
    family: "triangles",
    needs: "pairs",
    flags: "never",
    rule: "A 2 and a 4 side by side that share three cells: the 4's other two are mines, and the rest round the 2 are safe.",
    shapes: [shape(["s??*", "s24.", "s?.*"], triangleSteps)],
  },
  triangleFive: {
    name: "T5",
    family: "triangles",
    needs: "pairs",
    flags: "never",
    rule: "A 1 in a hole with a 2 behind it: the 2's third cell is a mine, and the cells ahead of the 1 are safe.",
    shapes: [
      shape(["sss", ".1.", "?2?", "*.."], [
        A,
        B,
        { cells: "?", says: "They share these two, and the 1 allows only one mine in them." },
        { cells: "*", says: "So the 2's second mine is in the cell it has to itself." },
        { cells: "s", says: "That puts the 1's own mine in the shared cells: the cells ahead of it are safe." },
      ]),
    ],
  },
  oneThreeOne: {
    name: "1-3-1 corner",
    family: "advanced",
    needs: "everything",
    flags: "never",
    rule: "A 3 on a corner between two 1s: each 1 allows one mine on its side, so the corner cell is the 3's third.",
    shapes: [
      shape(["s??*", ".13?", "..1?", "...s"], [
        A,
        { cells: "a", says: "So at most one of these two is a mine." },
        C,
        { cells: "b", says: "And at most one of these two." },
        B,
        { cells: "*", says: "The 3 needs three, and those four cells can give it only two: the corner is its third." },
        { cells: "s", says: "That takes a mine from each pair, which is each 1's only one." },
      ], [".aa.", "...b", "...b", "...."]),
    ],
  },
  twoTwoTwo: {
    name: "2-2-2 corner",
    family: "advanced",
    needs: "everything",
    flags: "never",
    rule: "Three 2s round a corner: each outer 2 puts a mine on its side, which is both of the corner 2's, so the corner cell is safe.",
    shapes: [
      shape(["*??s", ".22?", "..2?", "...*"], [
        A,
        { cells: "a", says: "Two mines in three cells: at least one of them is in these two." },
        C,
        { cells: "b", says: "The same here: at least one in these two." },
        B,
        { cells: "s", says: "That is both of the corner 2's mines, one on each side: its fifth cell is safe." },
        { cells: "*", says: "And with only one mine in each pair, each outer 2 has its second in its end cell." },
      ], [".aa.", "...b", "...b", "...."]),
    ],
  },
  oneTwoOneBent: {
    name: "1>2<1",
    family: "advanced",
    needs: "everything",
    flags: "never",
    rule: "A 2 between two 1s with a covered cell in the row: the 2 takes one mine from each 1, and the rest round the 1s is safe.",
    shapes: [
      shape([".s", "1s", "??", "2?", "1?", ".s"], [
        A,
        { cells: "a", says: "So at most one of these two is a mine." },
        C,
        { cells: "b", says: "And at most one of these two." },
        B,
        { cells: "ab", says: "The 2 touches those four cells and no others: it has one mine in each pair." },
        { cells: "s", says: "Which is each 1's only mine: the rest of what they touch is safe." },
      ], ["..", "..", "aa", ".b", ".b", ".."]),
    ],
  },
  tPattern: {
    name: "T-pattern",
    family: "advanced",
    needs: "everything",
    flags: "never",
    rule: "A 3 and a 2 over two 1s: each has one mine in the row below, which leaves the 3 its corner and the 2 nothing on its far side.",
    shapes: [
      shape(["*??s", ".32s", "?1??", "..1."], [
        C,
        { cells: "ab", says: "So one of these two is a mine." },
        D,
        { cells: "bc", says: "And one of these two." },
        B,
        { cells: "d", says: "One of the 2's mines is in that pair below it, so these two hold one at most." },
        A,
        { cells: "*", says: "The 3 has one below it as well and needs two more. Those two cells give one at most: the corner is a mine." },
        { cells: "s", says: "So they do give one, and that is the last of the 2's." },
      ], [".dd.", "....", "a.bc", "...."]),
    ],
  },
  chain: {
    name: "Dependency chain",
    family: "advanced",
    needs: "pairs",
    flags: "never",
    rule: "A long row of 1s between two walls: worked in from both ends, each cell settles the next.",
    shapes: [
      shape(["*ss*ss*", "1111111"], [
        A,
        B,
        { cells: "b", says: "Each end is a 1-1: the second 1 in has no mine in its third cell." },
        { cells: "c", says: "The 1 in the middle touches both of those and one cell more, which is its mine." },
        { cells: "a", says: "That is the one mine of the 1 on either side of it: its other cell is safe." },
        { cells: "*", says: "Which leaves each end 1 a single cell." },
        { cells: "s", says: "Three mines, and every 1 touches exactly one." },
      ], [".abcba.", "......."]),
    ],
  },
  // The two that are about the count of mines. Neither has a shape: a board near its end is made, and is a round
  // of one or the other by what the count turns out to settle on it (see `draftCounted` and `weigh` in trial.ts)
  mineCounting: {
    name: "Mine counting",
    family: "endgame",
    needs: "everything",
    flags: "never",
    counted: "untouched",
    rule: "The numbers account for every mine that is left: any covered cell that no number touches is safe.",
    shapes: [],
  },
  combinations: {
    name: "Combinations",
    family: "endgame",
    needs: "everything",
    flags: "never",
    counted: "touched",
    rule: "With so few mines left, a cell is settled when the other way round the numbers could not be met with what remains.",
    shapes: [],
  },
}

export const PATTERNS: readonly Pattern[] = PATTERN_IDS.map(id => ({ id, ...CATALOGUE[id] }))

export const patternOf = (id: PatternId): Pattern => ({ id, ...CATALOGUE[id] })

export const isPatternId = (value: unknown): value is PatternId => (PATTERN_IDS as readonly unknown[]).includes(value)

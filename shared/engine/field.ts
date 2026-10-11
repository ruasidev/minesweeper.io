// Where the mines are on a board, and the numbers that follow from them.
//
// Everything about a board is kept flat: one byte per cell, row after row, in a typed array. A cell is known by its
// place in that array (`row * cols + col`), which is what "a cell" means as a number anywhere in the engine. It is
// far less to copy and to walk than an object per cell, and it is the same shape in any language.

// What a board is made from
export type BoardSettings = {
  rows: number
  cols: number
  mines: number
}

// Where the mines are. Never changed once made: a game's field can be shared by everyone playing it
export type Field = {
  readonly rows: number
  readonly cols: number
  readonly mineCount: number
  // one byte per cell: 1 a mine, 0 not
  readonly mines: Uint8Array
  // one byte per cell: how many of the cells around it are mines
  readonly counts: Uint8Array
}

export const cellAt = (cols: number, row: number, col: number): number => row * cols + col
export const rowOf = (cols: number, at: number): number => Math.floor(at / cols)
export const colOf = (cols: number, at: number): number => at % cols

export const isOnBoard = ({ rows, cols }: { rows: number, cols: number }, row: number, col: number): boolean =>
  Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < rows && col >= 0 && col < cols

// Calls `visit` with each of the (up to eight) cells around one, row after row
export function forEachNeighbour(rows: number, cols: number, at: number, visit: (neighbour: number) => void): void {
  const row = rowOf(cols, at)
  const col = at - row * cols
  const top = row > 0 ? row - 1 : row
  const bottom = row < rows - 1 ? row + 1 : row
  const left = col > 0 ? col - 1 : col
  const right = col < cols - 1 ? col + 1 : col
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      const neighbour = r * cols + c
      if (neighbour !== at) visit(neighbour)
    }
  }
}

// The field with its mines where `mines` says: one byte per cell, anything but 0 a mine
export function fieldOf(rows: number, cols: number, mines: Uint8Array): Field {
  if (mines.length !== rows * cols) throw new RangeError(`A ${rows}x${cols} board has ${rows * cols} cells, not ${mines.length}`)
  const counts = new Uint8Array(mines.length)
  let mineCount = 0
  // counted from the mines outwards: there are far fewer of them than there are cells
  const bump = (neighbour: number) => { counts[neighbour]++ }
  for (let at = 0; at < mines.length; at++) {
    if (!mines[at]) continue
    mineCount++
    forEachNeighbour(rows, cols, at, bump)
  }
  return { rows, cols, mineCount, mines, counts }
}

// how many cells of a field are not mines: what there is to uncover
export const safeCells = (field: Field): number => field.rows * field.cols - field.mineCount

// Where the mines are as text, one character per cell, row after row: "1" a mine, "0" not.
// This is how a board is kept with the record of a game, and how it is told to a player once their game is over
export function layoutText(mines: Uint8Array): string {
  const text = new Array<string>(mines.length)
  for (let at = 0; at < mines.length; at++) text[at] = mines[at] ? "1" : "0"
  return text.join("")
}

export function fieldFromLayout(rows: number, cols: number, layout: string): Field {
  const mines = new Uint8Array(rows * cols)
  for (let at = 0; at < mines.length; at++) mines[at] = layout.charCodeAt(at) === 49 /* "1" */ ? 1 : 0
  return fieldOf(rows, cols, mines)
}

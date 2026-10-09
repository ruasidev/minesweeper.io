import type { CSSProperties } from "react"

// How big a board is drawn is carried by the element it is drawn in (BoardViewport), as --cell-size, --cell-gap
// and --cell-step (a cell and the gap after it). Anything laid over a board is placed in those units rather than
// in pixels, so it stays where it belongs while the board is being zoomed

// The box of one cell
export const cellBox = (row: number, col: number): CSSProperties => ({
  top: `calc(var(--cell-step) * ${row})`,
  left: `calc(var(--cell-step) * ${col})`,
  width: "var(--cell-size)",
  height: "var(--cell-size)",
})

// A square centred on the middle of a cell, `cells` cells across (gaps included)
export const boxAround = (row: number, col: number, cells: number): CSSProperties => ({
  top: `calc(var(--cell-step) * ${row} + var(--cell-size) / 2 - var(--cell-step) * ${cells / 2})`,
  left: `calc(var(--cell-step) * ${col} + var(--cell-size) / 2 - var(--cell-step) * ${cells / 2})`,
  width: `calc(var(--cell-step) * ${cells})`,
  height: `calc(var(--cell-step) * ${cells})`,
})

// A dot in the middle of a cell, `share` of the cell across
export const dotIn = (row: number, col: number, share: number): CSSProperties => ({
  top: `calc(var(--cell-step) * ${row} + var(--cell-size) * ${(1 - share) / 2})`,
  left: `calc(var(--cell-step) * ${col} + var(--cell-size) * ${(1 - share) / 2})`,
  width: `calc(var(--cell-size) * ${share})`,
  height: `calc(var(--cell-size) * ${share})`,
})

// The boards games are played on

import type { BoardSettings } from "../engine/field.js"

export type BoardPreset = { id: string, label: string, settings: BoardSettings }

// The classic boards. Any other board is a custom one
export const BOARD_PRESETS: BoardPreset[] = [
  { id: "beginner", label: "Beginner", settings: { rows: 9, cols: 9, mines: 10 } },
  { id: "intermediate", label: "Intermediate", settings: { rows: 16, cols: 16, mines: 40 } },
  { id: "expert", label: "Expert", settings: { rows: 16, cols: 30, mines: 99 } },
]

const [BEGINNER, INTERMEDIATE] = BOARD_PRESETS

export const BEGINNER_BOARD: BoardSettings = BEGINNER.settings
// what a new room starts with
export const DEFAULT_BOARD_SETTINGS: BoardSettings = INTERMEDIATE.settings
// the board every day's challenge is played on
export const DAILY_BOARD_SETTINGS: BoardSettings = INTERMEDIATE.settings

export const sameBoard = (a: BoardSettings, b: BoardSettings): boolean =>
  a.rows === b.rows && a.cols === b.cols && a.mines === b.mines

// the classic board these settings are, if they are one
export const presetOf = (settings: BoardSettings): BoardPreset | undefined =>
  BOARD_PRESETS.find(preset => sameBoard(preset.settings, settings))

// a board's size, the way it is written everywhere: "16 × 30 · 99 mines"
export const boardSize = ({ rows, cols, mines }: BoardSettings): string =>
  `${rows} × ${cols} · ${mines} ${mines === 1 ? "mine" : "mines"}`

// what a board is called: its name if it is one of the classic ones, otherwise its size
export const boardName = (settings: BoardSettings): string => presetOf(settings)?.label ?? boardSize(settings)

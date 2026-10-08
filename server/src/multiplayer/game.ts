import { chordCell, createEmptyBoard, flagCell, populateBoard, revealCell, type Board } from "../../../shared/board.js"
import {
  CELL_FLAGGED, CELL_HIDDEN, CELL_MINE, MINE_COOLDOWN_MS, SECTION_LEVELS, START_COUNTDOWN_MS,
  type BoardSettings, type GameSummary, type PlayerProgress,
} from "../../../shared/protocol.js"

// A board is cut into at most this many sections along its longer side for showing progress to other players.
// A section is never smaller than 2x2 cells: everyone plays the same board, so showing an opponent's
// progress cell by cell would show exactly which cells are safe
const SECTIONS_ALONG_LONG_SIDE = 12
const SECTION_SIZE_MIN = 2

type PlayerGame = {
  board: Board
  // the moment (server clock) this player can play again after uncovering a mine
  blockedUntil: number
  mineHits: number
  finishedMs: number | null
}

// One game in one room. The board, mines included, only ever exists here on the server:
// players are sent what they have uncovered themselves and nothing else
export type Game = {
  settings: BoardSettings
  sectionSize: number
  // the cell the opening click was made on
  start: { row: number, col: number }
  // The moment (server clock) play begins: a short countdown after the game is created,
  // during which players can look at the board but not touch it. Times are measured from here
  startedAt: number
  // by player id
  players: Map<string, PlayerGame>
  // how many cells the opening click uncovered: nobody earned those
  openedAtStart: number
  // the players who left before the game ended, as they stood when they went
  departed: Map<string, Standing>
}

// How one player came out of a game
export type Standing = {
  playerId: string
  finishedMs: number | null
  // how much of what was left to uncover after the opening they uncovered, 0 to 1
  share: number
  mineHits: number
  // how long they were playing
  elapsedMs: number
}

type StartOptions = {
  // where the randomness comes from: Math.random, unless the same board is wanted again (the daily challenge)
  random?: () => number
  // when play begins: after the usual countdown, unless the clock was already started some other time
  startedAt?: number
}

export function startGame(settings: BoardSettings, playerIds: string[], now: number, { random = Math.random, startedAt = now + START_COUNTDOWN_MS }: StartOptions = {}): Game {
  // The first click is made for everyone, on a cell picked at random, and the mines are laid around it
  // exactly as in singleplayer. So every player starts from the same board with the same patch already open
  const row = Math.floor(random() * settings.rows)
  const col = Math.floor(random() * settings.cols)
  const laid = populateBoard(createEmptyBoard(settings.rows, settings.cols), settings.mines, row, col, { excludeAdj: true, random })
  const opened = revealCell(laid, row, col)
  // on a tiny board that one click can already uncover everything
  const finishedMs = opened.status === "won" ? 0 : null

  return {
    settings,
    sectionSize: Math.max(SECTION_SIZE_MIN, Math.ceil(Math.max(settings.rows, settings.cols) / SECTIONS_ALONG_LONG_SIDE)),
    start: { row, col },
    startedAt,
    // boards are never changed in place, so everyone can start from the same one
    players: new Map(playerIds.map(id => [id, { board: opened, blockedUntil: 0, mineHits: 0, finishedMs }])),
    openedAtStart: opened.revealedCount,
    departed: new Map(),
  }
}

function standingOf(game: Game, playerId: string, player: PlayerGame, now: number): Standing {
  const { rows, cols, mines } = game.settings
  const leftToUncover = rows * cols - mines - game.openedAtStart
  return {
    playerId,
    finishedMs: player.finishedMs,
    share: leftToUncover === 0 ? 1 : (player.board.revealedCount - game.openedAtStart) / leftToUncover,
    mineHits: player.mineHits,
    elapsedMs: player.finishedMs ?? Math.max(0, now - game.startedAt),
  }
}

// Takes a player out of the game, remembering how they stood for when it is settled
export function leaveGame(game: Game, playerId: string, now: number) {
  const player = game.players.get(playerId)
  if (!player) return
  game.departed.set(playerId, standingOf(game, playerId, player, now))
  game.players.delete(playerId)
}

// Everyone who took part, best first, each with their place (1 is best; equal results share a place).
// Clearing the board beats not clearing it; among those who cleared it the faster is better,
// and among those who didn't, whoever uncovered more
export function standings(game: Game, now: number): (Standing & { place: number })[] {
  const all = [...game.departed.values(), ...[...game.players].map(([id, player]) => standingOf(game, id, player, now))]
  const better = (a: Standing, b: Standing) =>
    a.finishedMs !== null && b.finishedMs !== null ? a.finishedMs - b.finishedMs
      : a.finishedMs !== null ? -1
      : b.finishedMs !== null ? 1
      : b.share - a.share
  all.sort(better)
  return all.map(standing => ({ ...standing, place: 1 + all.findIndex(other => better(other, standing) === 0) }))
}

// The player, if they are in the game and allowed to act on this cell right now
function actingPlayer(game: Game, playerId: string, row: number, col: number, now: number): PlayerGame | null {
  const player = game.players.get(playerId)
  const onBoard = Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < game.settings.rows && col >= 0 && col < game.settings.cols
  if (!player || !onBoard || now < game.startedAt || player.finishedMs !== null || now < player.blockedUntil) return null
  return player
}

// Uncovers a cell, or chords it if it is already uncovered. Returns whether anything changed
export function reveal(game: Game, playerId: string, row: number, col: number, now: number): boolean {
  const player = actingPlayer(game, playerId, row, col, now)
  if (!player) return false

  const before = player.board
  let after = before.grid[row][col].revealed ? chordCell(before, row, col) : revealCell(before, row, col)
  if (after === before) return false

  if (after.status === "lost") {
    // Uncovering a mine doesn't end the game here. The mine stays uncovered and the player sits out for a moment
    after = { ...after, status: "playing" }
    player.mineHits++
    player.blockedUntil = now + MINE_COOLDOWN_MS
  }
  player.board = after
  if (after.status === "won") player.finishedMs = now - game.startedAt
  return true
}

// Flags or unflags a cell. Returns whether anything changed
export function flag(game: Game, playerId: string, row: number, col: number, now: number): boolean {
  const player = actingPlayer(game, playerId, row, col, now)
  if (!player) return false

  const after = flagCell(player.board, row, col)
  if (after === player.board) return false
  player.board = after
  return true
}

// A player's own board as it is sent to them: one character per cell, row after row
export function boardView(game: Game, playerId: string, now: number): { cells: string, cooldownMs: number } | null {
  const player = game.players.get(playerId)
  if (!player) return null

  const cells = player.board.grid
    .map(row => row.map(cell =>
      cell.flagged ? CELL_FLAGGED
        : !cell.revealed ? CELL_HIDDEN
        : cell.hasMine ? CELL_MINE
        : String(cell.neighborCount)).join(""))
    .join("")
  return { cells, cooldownMs: Math.max(0, player.blockedUntil - now) }
}

function progressOf(game: Game, player: PlayerGame): PlayerProgress {
  const { rows, cols, mines } = game.settings
  const sectionCols = Math.ceil(cols / game.sectionSize)
  const sectionCount = Math.ceil(rows / game.sectionSize) * sectionCols
  const share = player.board.revealedCount / (rows * cols - mines)

  // per section: how many safe cells it has, and how many of those are uncovered
  const safe = new Array<number>(sectionCount).fill(0)
  const uncovered = new Array<number>(sectionCount).fill(0)
  for (const row of player.board.grid) {
    for (const cell of row) {
      if (cell.hasMine) continue
      const section = Math.floor(cell.row / game.sectionSize) * sectionCols + Math.floor(cell.col / game.sectionSize)
      safe[section]++
      if (cell.revealed) uncovered[section]++
    }
  }

  return {
    // A section that is nothing but mines has nothing to uncover. Showing it as done (or never done)
    // would give away where it is, so it just follows the board as a whole
    sections: safe.map((total, section) => Math.floor(SECTION_LEVELS * (total === 0 ? share : uncovered[section] / total))),
    percent: Math.floor(100 * share),
    mineHits: player.mineHits,
    finishedMs: player.finishedMs,
  }
}

// How one player is doing, for whoever needs just theirs
export function progressFor(game: Game, playerId: string): PlayerProgress | null {
  const player = game.players.get(playerId)
  return player ? progressOf(game, player) : null
}

export function summarize(game: Game, now: number): GameSummary {
  return {
    settings: game.settings,
    sectionRows: Math.ceil(game.settings.rows / game.sectionSize),
    sectionCols: Math.ceil(game.settings.cols / game.sectionSize),
    start: game.start,
    elapsedMs: now - game.startedAt,
    progress: Object.fromEntries([...game.players].map(([id, player]) => [id, progressOf(game, player)])),
  }
}
